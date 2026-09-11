/** Shared domain types for ASCII Motion. */

export type ColorMode = 'mono' | 'original' | 'green' | 'amber' | 'blue' | 'custom';
export type BackgroundMode = 'black' | 'white' | 'transparent';
export type AspectRatioId = 'original' | '16:9' | '9:16' | '1:1' | '4:3';
export type ExportFormat = 'webm' | 'mp4' | 'gif';
export type QualityLevel = 'standard' | 'high' | 'maximum';

export interface EffectSettings {
  crt: boolean;
  scanlines: boolean;
  vhs: boolean;
  noise: boolean;
  flicker: boolean;
  glitch: boolean;
  glow: boolean;
  matrix: boolean;
  dither: boolean;
}

export interface EditorSettings {
  /** Character ramp, ordered densest glyph first. */
  charset: string;
  charsetId: string;
  /** Number of ASCII columns across the output. */
  resolution: number;

  brightness: number; // -100..100
  contrast: number; // -100..100
  gamma: number; // 0.5..2.0
  exposure: number; // -100..100
  sharpness: number; // 0..100
  invert: boolean;

  colorMode: ColorMode;
  customColor: string;
  gradient: boolean;
  gradientFrom: string;
  gradientTo: string;
  background: BackgroundMode;

  fontFamily: string;
  fontSize: number; // px, per character cell height basis
  letterSpacing: number; // -0.3..0.6 in cell-width units
  lineSpacing: number; // 0.8..1.6 multiplier

  aspectRatio: AspectRatioId;
  effects: EffectSettings;
}

export interface ExportSettings {
  format: ExportFormat;
  fps: number;
  quality: QualityLevel;
  /** 'current' uses the live preview size; otherwise a target height in px. */
  resolutionPreset: 'current' | '720p' | '1080p' | 'custom';
  customWidth: number;
  customHeight: number;
  includeAudio: boolean;
}

export interface TrimRange {
  start: number;
  end: number;
}

export interface MediaInfo {
  name: string;
  size: number | null;
  type: string;
  width: number;
  height: number;
  duration: number;
  hasAudio: boolean;
}

export type ExportPhase =
  | 'idle'
  | 'preparing'
  | 'rendering'
  | 'encoding'
  | 'finalizing'
  | 'done'
  | 'error'
  | 'cancelled';

export interface ExportProgressState {
  phase: ExportPhase;
  /** 0..1 */
  progress: number;
  renderedSeconds: number;
  totalSeconds: number;
  message: string;
  etaSeconds: number | null;
}

export interface ExportResult {
  blob: Blob;
  url: string;
  filename: string;
  durationSeconds: number;
  width: number;
  height: number;
  hasAudio: boolean;
  notes: string[];
}
