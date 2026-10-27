# ASCII Motion

**Turn video into animated ASCII art, entirely in your browser.**

Drop in a clip, tune the character ramp and tone curve, add CRT or VHS effects,
and export back out as MP4, WebM, or GIF. No upload, no server, no account —
the video never leaves your machine.

![License](https://img.shields.io/badge/license-GPL--3.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React%2019-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)

<!-- A screen recording belongs here — it is the whole pitch for this project.
     Record a few seconds of the editor, drag the file into any GitHub issue to
     get a hosted URL, then paste it:   ![Demo](URL)   -->

## Features

- **Video in, ASCII out.** Full timeline with trim, scrubbing, and live preview
  at the real output resolution.
- **Eight character ramps** — Standard, Detailed (70 glyphs), Minimal, Binary,
  Dots, Blocks, Terminal, Braille — plus custom ramps of your own.
- **Ordered dithering** with an 8×8 Bayer matrix, which recovers tonal steps
  that a short ramp would otherwise crush.
- **Full tone control**: brightness, contrast, gamma, exposure, sharpness, invert.
- **Color modes**: monochrome, original source color, green/amber/blue phosphor,
  custom, or a two-stop gradient. Black, white, or transparent background.
- **Nine effects**: CRT, scanlines, VHS, noise, flicker, glitch, glow, matrix, dither.
- **Export to MP4, WebM, or GIF** at 720p, 1080p, or a custom size, with optional
  audio passthrough and live progress with ETA.

## Quick start

Requires Node.js 20+.

```bash
git clone https://github.com/saeedjamalhussains/asciimotion.git
cd asciimotion
npm install
npm run dev
```

Open http://localhost:5173, drop in a video, and start tuning.

## How it works

Each frame is downsampled to a grid of character cells and reduced to luminance.
A 256-entry lookup table maps each cell's luma onto an index in the active
character ramp, so the per-cell cost is a single array read. Ramps are authored
densest-glyph-first, and the mapping inverts on a white background — on dark,
a bright pixel wants the heaviest glyph because more ink means more light; on
white, ink is dark and the relationship flips.

Effects run as a post-processing pass driven purely by the integer frame index,
using a seeded `mulberry32` PRNG. That means a preview frame and the exported
frame at the same timestamp are pixel-identical — what you scrub past is exactly
what you get in the file. Effects that would otherwise strobe (noise, glitch)
advance on a slower deterministic clock unless flicker is turned on.

Encoding happens in-browser via `mp4-muxer`, `webm-muxer`, and `gifenc`, with
codec support probed at runtime so unsupported formats are disabled rather than
failing mid-export.

## Scripts

```bash
npm run dev        # dev server
npm run build      # typecheck + production build
npm run test       # node:test suite
npm run lint       # oxlint
npm run typecheck  # tsc
npm run check      # typecheck + lint + test
```

## Built with

React 19 · TypeScript · Vite · Tailwind CSS v4 · Radix UI · mp4-muxer · webm-muxer · gifenc

## License

GPL-3.0-only. See [LICENSE](LICENSE).
