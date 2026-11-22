import type { SVGProps } from 'react';

/**
 * The ASCII Motion mark: a play arrow set on a 5×5 character grid, its cells
 * fading towards the tail like a density ramp — glyphs, in motion.
 *
 * `public/favicon.svg` draws the same cells on a tile; keep the two in step.
 */

/** Cells of the arrow as [column, row]: rows 1, 3, 5, 3, 1 cells wide. */
const CELLS: [number, number][] = [
  [0, 0],
  [0, 1], [1, 1], [2, 1],
  [0, 2], [1, 2], [2, 2], [3, 2], [4, 2],
  [0, 3], [1, 3], [2, 3],
  [0, 4],
];

/** Ink per column, densest at the leading edge. */
const COLUMN_OPACITY = [0.3, 0.5, 0.7, 0.86, 1];

const CELL = 4;
const STEP = 5;

export function LogoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {CELLS.map(([col, row]) => (
        <rect
          key={`${col}-${row}`}
          x={col * STEP}
          y={row * STEP}
          width={CELL}
          height={CELL}
          fill="currentColor"
          opacity={COLUMN_OPACITY[col]}
        />
      ))}
    </svg>
  );
}
