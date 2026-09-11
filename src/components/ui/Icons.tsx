import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

/** Single stroke system, 1.6px, 24-grid — keeps the chrome visually consistent. */
function Base({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      width={18}
      height={18}
      {...props}
    >
      {children}
    </svg>
  );
}

export const PlayIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M7 4.8 19 12 7 19.2z" fill="currentColor" stroke="none" />
  </Base>
);

export const PauseIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="6.5" y="5" width="3.6" height="14" rx="1" fill="currentColor" stroke="none" />
    <rect x="13.9" y="5" width="3.6" height="14" rx="1" fill="currentColor" stroke="none" />
  </Base>
);

export const RestartIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 12a8 8 0 1 0 2.5-5.8" />
    <path d="M4 4v4h4" />
  </Base>
);

export const VolumeIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 9.5h3l4-3.2v11.4l-4-3.2H5z" />
    <path d="M16 9.2a4 4 0 0 1 0 5.6" />
    <path d="M18.4 6.6a7.5 7.5 0 0 1 0 10.8" />
  </Base>
);

export const MuteIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 9.5h3l4-3.2v11.4l-4-3.2H5z" />
    <path d="m16 9.5 5 5M21 9.5l-5 5" />
  </Base>
);

export const UploadIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 16V4" />
    <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
    <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
  </Base>
);

export const DownloadIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 4v12" />
    <path d="m7.5 11.5 4.5 4.5 4.5-4.5" />
    <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
  </Base>
);

export const CloseIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Base>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="m6 9.5 6 6 6-6" />
  </Base>
);

export const SlidersIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 8h10M18 8h2M4 16h4M12 16h8" />
    <circle cx="16" cy="8" r="2.1" />
    <circle cx="10" cy="16" r="2.1" />
  </Base>
);

export const SparkIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3.5 13.7 9l5.3 1.7-5.3 1.7L12 18l-1.7-5.6L5 10.7 10.3 9z" />
  </Base>
);

export const TrashIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4.5 7h15M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7" />
    <path d="M6.5 7 7.4 19a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
  </Base>
);

export const FilmIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M7 5v14M17 5v14M3 12h18M3 8.5h4M3 15.5h4M17 8.5h4M17 15.5h4" />
  </Base>
);

export const CheckIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Base>
);

export const AlertIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 4.5 21 19.5H3z" />
    <path d="M12 10v4M12 16.8v.2" />
  </Base>
);

export const ScissorsIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="6.5" cy="6.5" r="2.5" />
    <circle cx="6.5" cy="17.5" r="2.5" />
    <path d="M8.7 8.2 20 18M20 6 8.7 15.8" />
  </Base>
);

export const CropIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M6.5 2.5v15h15" />
    <path d="M2.5 6.5h15v15" />
  </Base>
);

export const TypeIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 6.5V5h14v1.5M12 5v14M9 19h6" />
  </Base>
);

export const PaletteIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.6-1-2.6 0-.8.7-1.4 1.6-1.4h1.6a4.5 4.5 0 0 0 4.5-4.5c0-3.8-3.8-6.8-8.5-6.8z" />
    <circle cx="8" cy="11" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="8" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="16" cy="10.5" r="1.1" fill="currentColor" stroke="none" />
  </Base>
);

export const LoopIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M6.5 7.5h11a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3v0a3 3 0 0 1 3-3z" />
    <path d="m9 5 -2.5 2.5L9 10" />
  </Base>
);

export const RestoreIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 11a8 8 0 1 1 2.4 5.7" />
    <path d="M4 5.5V11h5.5" />
  </Base>
);

export const PlusIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 5.5v13M5.5 12h13" />
  </Base>
);

export const MinusIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M5.5 12h13" />
  </Base>
);

export const FitIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" />
  </Base>
);

export const ExpandIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
  </Base>
);

export const CopyIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" />
  </Base>
);

export const MenuIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Base>
);
