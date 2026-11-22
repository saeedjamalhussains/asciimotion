import {
  CaseSensitive,
  Crop,
  Download,
  Film,
  Palette,
  Scissors,
  Sparkles,
  SunMedium,
  Type,
  type LucideIcon,
} from 'lucide-react';

/**
 * The editor's tools. Both layouts show the same tools: the desktop as a
 * vertical strip beside the inspector, the phone as a bottom toolbar that opens
 * each tool in a drawer.
 */
export type ToolId =
  | 'media'
  | 'trim'
  | 'characters'
  | 'type'
  | 'tone'
  | 'colour'
  | 'frame'
  | 'effects'
  | 'export';

export interface ToolMeta {
  id: ToolId;
  label: string;
  icon: LucideIcon;
}

export const TOOL_META: Record<ToolId, ToolMeta> = {
  media: { id: 'media', label: 'Media', icon: Film },
  trim: { id: 'trim', label: 'Trim', icon: Scissors },
  characters: { id: 'characters', label: 'Chars', icon: CaseSensitive },
  type: { id: 'type', label: 'Type', icon: Type },
  tone: { id: 'tone', label: 'Tone', icon: SunMedium },
  colour: { id: 'colour', label: 'Colour', icon: Palette },
  frame: { id: 'frame', label: 'Frame', icon: Crop },
  effects: { id: 'effects', label: 'Effects', icon: Sparkles },
  export: { id: 'export', label: 'Export', icon: Download },
};

/** Full names for panel headings, where there is room. */
export const TOOL_TITLES: Record<ToolId, string> = {
  media: 'Media',
  trim: 'Trim',
  characters: 'Characters',
  type: 'Type',
  tone: 'Tone',
  colour: 'Colour',
  frame: 'Frame',
  effects: 'Effects',
  export: 'Export',
};

/** Media sits in the desktop top bar and trim on its timeline, so neither needs a tab there. */
export const DESKTOP_TOOLS: ToolId[] = [
  'characters',
  'type',
  'tone',
  'colour',
  'frame',
  'effects',
  'export',
];

/** Export is the phone's top-bar button, as in mobile video editors. */
export const MOBILE_TOOLS: ToolId[] = [
  'media',
  'trim',
  'characters',
  'type',
  'tone',
  'colour',
  'frame',
  'effects',
];
