import type { MediaInfo } from '../types';
import { createCanvas, get2d, type AnyCanvas, type Ctx2D } from '../renderer/canvasRenderer';
import { ClockSource, type FrameSource } from './frameSource';

/**
 * The "Try demo" clip.
 *
 * It is generated procedurally at runtime rather than shipped as a video file,
 * which keeps the bundle small and makes it deterministic — scrubbing and
 * exporting produce identical frames.
 */

const WIDTH = 960;
const HEIGHT = 540;
const DURATION = 12;

const RING_COUNT = 26;
const SEGMENTS = 44;
const TUBE = 0.42;
const RADIUS = 1.15;

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

function rotate(p: Vec3, ax: number, ay: number, az: number): Vec3 {
  let { x, y, z } = p;
  let s = Math.sin(ax);
  let c = Math.cos(ax);
  [y, z] = [y * c - z * s, y * s + z * c];
  s = Math.sin(ay);
  c = Math.cos(ay);
  [x, z] = [x * c + z * s, -x * s + z * c];
  s = Math.sin(az);
  c = Math.cos(az);
  [x, y] = [x * c - y * s, x * s + y * c];
  return { x, y, z };
}

export class DemoFrameSource extends ClockSource implements FrameSource {
  readonly kind = 'demo' as const;
  readonly element = null;
  readonly info: MediaInfo = {
    name: 'demo-clip',
    size: null,
    type: 'demo/procedural',
    width: WIDTH,
    height: HEIGHT,
    duration: DURATION,
    hasAudio: false,
  };

  private canvas: AnyCanvas;
  private ctx: Ctx2D;

  constructor() {
    super();
    this.canvas = createCanvas(WIDTH, HEIGHT);
    this.ctx = get2d(this.canvas);
    this.renderAt(0);
  }

  get duration(): number {
    return DURATION;
  }

  get image(): CanvasImageSource {
    return this.canvas as CanvasImageSource;
  }

  get volume(): number {
    return 0;
  }
  set volume(_value: number) {}
  get muted(): boolean {
    return true;
  }
  set muted(_value: boolean) {}

  protected renderAt(time: number): void {
    drawDemoFrame(this.ctx, WIDTH, HEIGHT, time);
    this.token += 1;
  }

  dispose(): void {
    this.stopClock();
    this.emitter.clear();
    this.canvas.width = 1;
    this.canvas.height = 1;
  }
}

/**
 * Draws one frame of the demo scene. Exported so the landing-page hero can
 * reuse the exact same visual without instantiating a full media source.
 */
export function drawDemoFrame(ctx: Ctx2D, width: number, height: number, time: number): void {
  const t = time;
  const cx = width / 2;
  const cy = height / 2;

  // --- Background: three drifting luminance blobs on a dark field. ---
  ctx.fillStyle = '#05070a';
  ctx.fillRect(0, 0, width, height);

  // Kept deliberately dim: the background sets a tonal field for the ramp,
  // while the torus stays the subject.
  const blobs: [number, number, number, string][] = [
    [
      cx + Math.cos(t * 0.55) * width * 0.32,
      cy + Math.sin(t * 0.41) * height * 0.3,
      width * 0.38,
      'rgba(70, 190, 255, 0.26)',
    ],
    [
      cx + Math.cos(t * 0.33 + 2.1) * width * 0.36,
      cy + Math.sin(t * 0.62 + 1.2) * height * 0.28,
      width * 0.32,
      'rgba(255, 140, 90, 0.2)',
    ],
    [
      cx + Math.cos(t * 0.78 + 4.4) * width * 0.24,
      cy + Math.sin(t * 0.29 + 3.3) * height * 0.34,
      width * 0.28,
      'rgba(140, 255, 200, 0.18)',
    ],
  ];

  ctx.globalCompositeOperation = 'lighter';
  for (const [bx, by, radius, color] of blobs) {
    const gradient = ctx.createRadialGradient(bx, by, 0, bx, by, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.globalCompositeOperation = 'source-over';

  // --- Foreground: a rotating wireframe torus with depth shading. ---
  const ax = t * 0.62 + 0.5;
  const ay = t * 0.85;
  const az = Math.sin(t * 0.4) * 0.5;
  const scale = Math.min(width, height) * 0.34;
  const camera = 4.2;

  ctx.lineWidth = Math.max(1.35, width / 520);
  ctx.lineJoin = 'round';

  const project = (p: Vec3) => {
    const depth = camera / (camera - p.z);
    return { x: cx + p.x * scale * depth, y: cy + p.y * scale * depth, depth };
  };

  for (let ring = 0; ring < RING_COUNT; ring += 1) {
    const u = (ring / RING_COUNT) * Math.PI * 2;
    ctx.beginPath();
    let sumDepth = 0;
    for (let seg = 0; seg <= SEGMENTS; seg += 1) {
      const v = (seg / SEGMENTS) * Math.PI * 2;
      const r = RADIUS + TUBE * Math.cos(v);
      const point = rotate(
        { x: r * Math.cos(u), y: r * Math.sin(u), z: TUBE * Math.sin(v) },
        ax,
        ay,
        az,
      );
      const { x, y, depth } = project(point);
      sumDepth += depth;
      if (seg === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    // Rings nearer the camera are brighter, which gives the ramp a full
    // tonal range to work with rather than a flat outline.
    const meanDepth = sumDepth / (SEGMENTS + 1);
    const shade = Math.max(0, Math.min(1, (meanDepth - 0.76) / 0.58));
    ctx.strokeStyle = `rgba(${205 + shade * 50}, ${232 + shade * 23}, 255, ${0.14 + shade * 0.86})`;
    ctx.stroke();
  }

  // --- A bright core that sweeps the tonal range for the ASCII ramp. ---
  const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
  const coreRadius = scale * (0.16 + pulse * 0.07);
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius);
  core.addColorStop(0, 'rgba(255,255,255,0.95)');
  core.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, width, height);

  // --- Drifting specks add fine detail for dense character ramps. ---
  for (let i = 0; i < 90; i += 1) {
    const seed = i * 12.9898;
    const speed = 0.15 + ((i * 37) % 11) / 22;
    const px = ((Math.sin(seed) * 0.5 + 0.5 + t * speed * 0.06) % 1) * width;
    const py = ((Math.cos(seed * 1.7) * 0.5 + 0.5 + t * speed * 0.02) % 1) * height;
    const size = 1 + ((i * 17) % 5) * 0.6;
    ctx.fillStyle = `rgba(255,255,255,${0.12 + ((i * 23) % 7) / 28})`;
    ctx.fillRect(px, py, size, size);
  }
  ctx.globalCompositeOperation = 'source-over';

  // --- Gentle vignette so edges fall into the darkest ramp steps. ---
  const vignette = ctx.createRadialGradient(
    cx,
    cy,
    Math.min(width, height) * 0.25,
    cx,
    cy,
    Math.max(width, height) * 0.72,
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.8)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

export function createDemoSource(): DemoFrameSource {
  return new DemoFrameSource();
}
