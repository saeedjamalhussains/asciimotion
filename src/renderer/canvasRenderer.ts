/**
 * Canvas plumbing shared by the live preview and the exporter: works with
 * both `HTMLCanvasElement` (main thread) and `OffscreenCanvas` (worker).
 *
 * Glyphs are rasterised once into an atlas and then blitted per cell. That
 * turns a 200x120 grid from 24 000 `fillText` calls into 24 000 `drawImage`
 * blits of a cached bitmap, which is roughly an order of magnitude cheaper and
 * keeps the grid off the DOM entirely.
 */

export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function createCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(Math.max(1, width), Math.max(1, height));
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  return canvas;
}

export function get2d(canvas: AnyCanvas, options?: CanvasRenderingContext2DSettings): Ctx2D {
  const ctx = canvas.getContext('2d', options) as Ctx2D | null;
  if (!ctx) throw new Error('This browser could not create a 2D canvas context.');
  return ctx;
}

export function resizeCanvas(canvas: AnyCanvas, width: number, height: number): boolean {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  if (canvas.width === w && canvas.height === h) return false;
  canvas.width = w;
  canvas.height = h;
  return true;
}

/** `ctx.filter` is unavailable in a few engines; probe once. */
let filterSupport: boolean | null = null;
export function supportsCanvasFilter(): boolean {
  if (filterSupport !== null) return filterSupport;
  try {
    const ctx = get2d(createCanvas(2, 2));
    ctx.filter = 'blur(1px)';
    filterSupport = ctx.filter === 'blur(1px)';
  } catch {
    filterSupport = false;
  }
  return filterSupport;
}

const advanceCache = new Map<string, number>();
let measureCtx: Ctx2D | null = null;

/** Typical monospace advance, used when the font cannot be measured. */
export const DEFAULT_ADVANCE_RATIO = 0.6;

/**
 * Advance width of a monospace glyph, expressed per 1px of font size.
 *
 * Falls back to a sane default if no canvas is available (a non-DOM context)
 * or the measurement comes back nonsensical, so geometry is always computable.
 */
export function measureAdvanceRatio(fontFamily: string): number {
  const cached = advanceCache.get(fontFamily);
  if (cached !== undefined) return cached;

  let ratio = DEFAULT_ADVANCE_RATIO;
  try {
    if (!measureCtx) measureCtx = get2d(createCanvas(8, 8));
    measureCtx.font = `100px ${fontFamily}`;
    const width = measureCtx.measureText('MMMMMMMMMM').width / 10 / 100;
    if (Number.isFinite(width) && width > 0.1) ratio = width;
  } catch {
    /* No canvas here — keep the default. */
  }

  advanceCache.set(fontFamily, ratio);
  return ratio;
}

export interface GridGeometry {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  fontPx: number;
  width: number;
  height: number;
  /** Scale applied to the authored font size to respect the pixel budget. */
  scale: number;
}

export interface GeometryInput {
  cols: number;
  fontSize: number;
  letterSpacing: number;
  lineSpacing: number;
  fontFamily: string;
  /** Aspect ratio (w/h) of the cropped source region. */
  sourceRatio: number;
  /** Hard pixel budget for the rendered raster. */
  maxWidth: number;
  maxHeight: number;
  /** Force exact output dimensions (export). */
  targetWidth?: number;
  targetHeight?: number;
}

/**
 * Derives the character grid and the raster size.
 *
 * Row count compensates for the monospace cell being taller than it is wide,
 * so the ASCII output keeps the source's perceived proportions. Because the
 * raster is `cols * cellW` by `rows * cellH`, changing the font size scales
 * the output without ever distorting it.
 */
export function computeGeometry(input: GeometryInput): GridGeometry {
  const cols = Math.max(8, Math.round(input.cols));
  const advanceRatio = measureAdvanceRatio(input.fontFamily);
  const spacingFactor = Math.max(0.35, 1 + input.letterSpacing);
  const lineFactor = Math.max(0.6, input.lineSpacing);

  // Design-space cell size, before fitting to the pixel budget.
  const designCellW = input.fontSize * advanceRatio * spacingFactor;
  const designCellH = input.fontSize * lineFactor;

  const ratio =
    Number.isFinite(input.sourceRatio) && input.sourceRatio > 0 ? input.sourceRatio : 16 / 9;

  /** Row count that best preserves `ratio` for a given cell size. */
  const bestRows = (cellW: number, cellH: number): number => {
    const ideal = (cols * cellW) / (cellH * ratio);
    const low = Math.max(4, Math.floor(ideal));
    const high = Math.max(4, Math.ceil(ideal));
    if (low === high) return low;
    const errorFor = (rows: number) => Math.abs((cols * cellW) / (rows * cellH) - ratio);
    return errorFor(low) <= errorFor(high) ? low : high;
  };

  /**
   * Integer cells keep glyph blits and the colour upscale pixel-aligned, but
   * rounding also changes the cell's own aspect. Searching one pixel either
   * side of the ideal cell height — and both candidate row counts — recovers
   * the source proportions almost exactly; without it a 16:9 clip at 120
   * columns comes out around 6% too wide.
   */
  const bestGrid = (cellW: number, idealCellH: number): { cellH: number; rows: number } => {
    let best: { cellH: number; rows: number; score: number } | null = null;
    const base = Math.max(1, Math.round(idealCellH));
    for (const cellH of [base - 1, base, base + 1]) {
      if (cellH < 1) continue;
      const ideal = (cols * cellW) / (cellH * ratio);
      for (const rows of [Math.max(4, Math.floor(ideal)), Math.max(4, Math.ceil(ideal))]) {
        const aspectError = Math.abs((cols * cellW) / (rows * cellH) - ratio) / ratio;
        // Small bias towards the authored line spacing.
        const cellPenalty = (0.15 * Math.abs(cellH - idealCellH)) / idealCellH;
        const score = aspectError + cellPenalty;
        if (!best || score < best.score) best = { cellH, rows, score };
      }
    }
    return best ?? { cellH: base, rows: bestRows(cellW, base) };
  };

  const fit = (rows: number): number => {
    const designW = cols * designCellW;
    const designH = rows * designCellH;
    let scale: number;
    if (input.targetWidth && input.targetHeight) {
      scale = Math.min(input.targetWidth / designW, input.targetHeight / designH);
    } else {
      scale = Math.min(1, input.maxWidth / designW, input.maxHeight / designH);
    }
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
  };

  let scale = fit(bestRows(designCellW, designCellH));
  let cellW = Math.max(1, Math.round(designCellW * scale));
  let grid = bestGrid(cellW, designCellH * scale);

  // One correction pass: the new row count can push the raster past its budget.
  const refined = fit(grid.rows);
  if (refined < scale * 0.995) {
    scale = refined;
    cellW = Math.max(1, Math.round(designCellW * scale));
    grid = bestGrid(cellW, designCellH * scale);
  }

  return {
    cols,
    rows: grid.rows,
    cellW,
    cellH: grid.cellH,
    fontPx: Math.max(1, input.fontSize * scale),
    width: cols * cellW,
    height: grid.rows * grid.cellH,
    scale,
  };
}

export interface GlyphAtlas {
  canvas: AnyCanvas;
  cellW: number;
  cellH: number;
  columns: number;
  count: number;
  key: string;
}

/**
 * White-on-transparent glyph sheet. Colour is applied later with a single
 * `source-in` composite, so one atlas serves every colour mode.
 */
export function buildGlyphAtlas(
  chars: string[],
  fontPx: number,
  fontFamily: string,
  cellW: number,
  cellH: number,
): GlyphAtlas {
  const count = Math.max(1, chars.length);
  const maxRowWidth = 4096;
  const columns = Math.max(1, Math.min(count, Math.floor(maxRowWidth / cellW) || 1));
  const rows = Math.ceil(count / columns);

  const canvas = createCanvas(columns * cellW, rows * cellH);
  const ctx = get2d(canvas, { willReadFrequently: false });
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = `${fontPx}px ${fontFamily}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < count; i += 1) {
    const cx = (i % columns) * cellW + cellW / 2;
    const cy = Math.floor(i / columns) * cellH + cellH / 2;
    const glyph = chars[i];
    if (glyph && glyph !== ' ') ctx.fillText(glyph, cx, cy);
  }

  return {
    canvas,
    cellW,
    cellH,
    columns,
    count,
    key: `${chars.join('')}|${fontPx.toFixed(2)}|${fontFamily}|${cellW}x${cellH}`,
  };
}
