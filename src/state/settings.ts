import type {
  AspectRatioId,
  BackgroundMode,
  ColorMode,
  EditorSettings,
  ExportSettings,
} from '../types';

export interface CharsetPreset {
  id: string;
  label: string;
  /** Ordered dark -> light. */
  ramp: string;
  hint: string;
}

/**
 * Convention: every ramp is ordered **densest glyph first**.
 *
 * On a dark background the renderer maps a bright source pixel to a dense
 * glyph (index 0); on a white background it flips, so dark pixels get the
 * heavy glyphs. See `characterMapper.ts`.
 */
export const CHARSET_PRESETS: CharsetPreset[] = [
  {
    id: 'standard',
    label: 'Standard',
    ramp: '@#S%?*+;:,. ',
    hint: 'Balanced classic ramp',
  },
  {
    id: 'dense',
    label: 'Dense',
    ramp: '$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,^`\'. ',
    hint: '69 steps of tonal detail',
  },
  { id: 'minimal', label: 'Minimal', ramp: '#:. ', hint: 'Four tones, very graphic' },
  { id: 'binary', label: 'Binary', ramp: '01', hint: 'Only ones and zeroes' },
  { id: 'dots', label: 'Dots', ramp: '•· ', hint: 'Two-weight stipple' },
  { id: 'blocks', label: 'Blocks', ramp: '█▓▒░ ', hint: 'Solid block shading' },
  { id: 'terminal', label: 'Terminal', ramp: '@$#*:. ', hint: 'Classic console glyphs' },
  {
    id: 'braille',
    label: 'Braille',
    // U+2800 block ordered by falling dot count, matching the dense-first convention.
    ramp: '⣿⡿⡟⡏⡇⠇⠃⠁⠀',
    hint: 'Unicode braille density ramp',
  },
  { id: 'custom', label: 'Custom', ramp: '', hint: 'Bring your own ramp' },
];

export interface FontOption {
  id: string;
  label: string;
  stack: string;
}

/**
 * Typefaces offered for the ASCII output — Apple's monospace faces.
 *
 * Referenced by name and by CSS keyword, never bundled: Apple's font licence
 * covers using these faces in interfaces on Apple platforms but not
 * redistributing the files, so serving them as web fonts from this site is not
 * permitted. Read from the machine they are already installed on, no font file
 * is requested over the network.
 *
 * `ui-monospace` is what actually lands on SF Mono in Safari and Chrome on
 * macOS and iOS; the explicit names ahead of it win when someone has installed
 * the developer download from developer.apple.com/fonts. On other platforms
 * these fall through to the system's own monospace.
 *
 * Every option must be monospaced: the renderer measures a single glyph
 * advance and assumes the whole ramp shares it, so a proportional face such as
 * New York would break the character grid.
 */
export const FONT_OPTIONS: FontOption[] = [
  {
    id: 'sf-mono',
    label: 'SF Mono',
    stack: "'SF Mono', ui-monospace, SFMono-Regular, monospace",
  },
  { id: 'menlo', label: 'Menlo', stack: "Menlo, ui-monospace, monospace" },
  { id: 'monaco', label: 'Monaco', stack: "Monaco, ui-monospace, monospace" },
];

export const RESOLUTION_STEPS = [40, 60, 80, 100, 120, 160, 200, 240, 320] as const;

export const COLOR_MODES: { id: ColorMode; label: string; swatch: string }[] = [
  { id: 'mono', label: 'Mono', swatch: '#ffffff' },
  { id: 'original', label: 'Original', swatch: 'linear-gradient(135deg,#f2726b,#e8b565,#5b9df9)' },
  { id: 'green', label: 'Green', swatch: '#3dfd7f' },
  { id: 'amber', label: 'Amber', swatch: '#ffb43d' },
  { id: 'blue', label: 'Blue', swatch: '#63b7ff' },
  { id: 'custom', label: 'Custom', swatch: '#5b9df9' },
];

export const TERMINAL_COLORS: Record<Exclude<ColorMode, 'original' | 'custom'>, string> = {
  mono: '#ffffff',
  green: '#3dfd7f',
  amber: '#ffb43d',
  blue: '#63b7ff',
};

export const BACKGROUND_MODES: { id: BackgroundMode; label: string }[] = [
  { id: 'black', label: 'Black' },
  { id: 'white', label: 'White' },
  { id: 'transparent', label: 'Transparent' },
];

export interface AspectPreset {
  id: AspectRatioId;
  label: string;
  /** Marketing-friendly nickname shown under the label. */
  usage: string;
  ratio: number | null;
}

export const ASPECT_PRESETS: AspectPreset[] = [
  { id: 'original', label: 'Original', usage: 'Source', ratio: null },
  { id: '16:9', label: '16 : 9', usage: 'YouTube', ratio: 16 / 9 },
  { id: '9:16', label: '9 : 16', usage: 'TikTok / Reels', ratio: 9 / 16 },
  { id: '1:1', label: '1 : 1', usage: 'Square', ratio: 1 },
  { id: '4:3', label: '4 : 3', usage: 'Classic', ratio: 4 / 3 },
];

export const EFFECT_META: {
  id: keyof EditorSettings['effects'];
  label: string;
  description: string;
}[] = [
  { id: 'crt', label: 'CRT', description: 'Phosphor mask, vignette and bloom' },
  { id: 'scanlines', label: 'Scanlines', description: 'Horizontal raster lines' },
  { id: 'vhs', label: 'VHS', description: 'Chroma bleed and tracking bands' },
  { id: 'noise', label: 'Noise', description: 'Film-grain speckle' },
  { id: 'flicker', label: 'Flicker', description: 'Unstable frame brightness' },
  { id: 'glitch', label: 'Glitch', description: 'Sliced RGB displacement' },
  { id: 'glow', label: 'Glow', description: 'Soft phosphor bloom' },
  { id: 'matrix', label: 'Matrix', description: 'Falling column highlights' },
  { id: 'dither', label: 'Dither', description: 'Ordered Bayer tone steps' },
];

export const DEFAULT_SETTINGS: EditorSettings = {
  charset: CHARSET_PRESETS[0].ramp,
  charsetId: 'standard',
  resolution: 120,
  brightness: 0,
  contrast: 10,
  gamma: 1,
  exposure: 0,
  sharpness: 0,
  invert: false,
  colorMode: 'mono',
  customColor: '#5b9df9',
  gradient: false,
  gradientFrom: '#5b9df9',
  gradientTo: '#a78bfa',
  background: 'black',
  fontFamily: FONT_OPTIONS[0].stack,
  fontSize: 14,
  letterSpacing: 0,
  lineSpacing: 1,
  aspectRatio: 'original',
  effects: {
    crt: false,
    scanlines: false,
    vhs: false,
    noise: false,
    flicker: false,
    glitch: false,
    glow: false,
    matrix: false,
    dither: false,
  },
};

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  format: 'webm',
  fps: 30,
  quality: 'high',
  resolutionPreset: 'current',
  customWidth: 1280,
  customHeight: 720,
  includeAudio: true,
};

/** Bitrate targets (bits per second) scaled by pixel count. */
export const QUALITY_BITRATE_FACTOR: Record<ExportSettings['quality'], number> = {
  standard: 0.08,
  high: 0.16,
  maximum: 0.3,
};
