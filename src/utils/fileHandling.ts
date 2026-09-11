/**
 * File selection helpers, working on the `File` object the browser hands us
 * from an <input> or a drop event.
 */

export const ACCEPTED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
  'video/ogg',
  'video/x-m4v',
  'image/gif',
];

export const ACCEPT_ATTRIBUTE = 'video/*,.mp4,.webm,.mov,.m4v,.mkv,.ogv,.gif,image/gif';

export const SUPPORTED_LABEL = 'MP4 · WebM · MOV · GIF';

/** 2 GB — beyond this most browsers will fail to decode reliably. */
export const SOFT_SIZE_LIMIT = 2 * 1024 * 1024 * 1024;

export function isProbablySupportedFile(file: File): boolean {
  if (file.type && (file.type.startsWith('video/') || file.type === 'image/gif')) return true;
  return /\.(mp4|webm|mov|m4v|mkv|ogv|ogg|gif|avi)$/i.test(file.name);
}

export interface FileRejection {
  reason: string;
  hint: string;
}

export function validateFile(file: File): FileRejection | null {
  if (!isProbablySupportedFile(file)) {
    return {
      reason: `“${file.name}” doesn’t look like a video.`,
      hint: 'Try an MP4, WebM, MOV or GIF file.',
    };
  }
  if (file.size === 0) {
    return { reason: 'That file is empty.', hint: 'Pick a different file and try again.' };
  }
  if (file.size > SOFT_SIZE_LIMIT) {
    return {
      reason: 'That file is larger than 2 GB.',
      hint: 'Browsers rarely decode files this large. Try a shorter or smaller clip.',
    };
  }
  return null;
}

/** Extracts the first supported video file from a drop event. */
export function fileFromDataTransfer(dt: DataTransfer): File | null {
  if (dt.files && dt.files.length > 0) {
    for (const file of Array.from(dt.files)) {
      if (isProbablySupportedFile(file)) return file;
    }
    return dt.files[0] ?? null;
  }
  if (dt.items) {
    for (const item of Array.from(dt.items)) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) return file;
      }
    }
  }
  return null;
}

/** Triggers a browser download for a locally generated Blob URL. */
export function downloadObjectUrl(url: string, filename: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export function sanitizeFilenameStem(name: string): string {
  const stem = name.replace(/\.[^.]+$/, '');
  const cleaned = stem
    .normalize('NFKD')
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
  return cleaned.slice(0, 48) || 'export';
}

export function buildExportFilename(sourceName: string, extension: string): string {
  return `ascii-motion-${sanitizeFilenameStem(sourceName)}.${extension}`;
}
