import { useRef } from 'react';
import { ACCEPT_ATTRIBUTE } from '../utils/fileHandling';

/** A hidden file input and the function that opens it. Render `input` once. */
export function useFilePicker(onPick: (file: File) => void) {
  const inputRef = useRef<HTMLInputElement>(null);

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPT_ATTRIBUTE}
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) onPick(file);
        event.target.value = '';
      }}
    />
  );

  return { input, open: () => inputRef.current?.click() };
}
