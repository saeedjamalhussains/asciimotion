import { useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, type ReactNode, type Ref } from 'react';
import {
  projectMomentum,
  rubberband,
  Spring,
  SPRING_DEFAULT,
  SPRING_MOMENTUM,
} from '../utils/spring';

export interface ControlsSheetHandle {
  /** Raises the sheet all the way, for jumping to controls further down. */
  expand(): void;
}

interface ControlsSheetProps {
  /** Receives how much of the viewport the sheet takes from the preview. */
  onInset(pixels: number): void;
  viewportRef: Ref<HTMLDivElement>;
  handleRef: Ref<ControlsSheetHandle>;
  children: ReactNode;
}

const TAP_SLOP = 6;
/** Movement before a touch on the content is treated as pulling the sheet down. */
const PULL_SLOP = 10;
const VELOCITY_WINDOW_MS = 100;
/** Below this a release is a placement, not a throw, so it earns no bounce. */
const MOMENTUM_THRESHOLD = 300;
/** Coalesced pointer events can report absurd speeds; a real flick stays under this. */
const MAX_VELOCITY = 4000;

/** Indexes into the resting points; the middle one is only ever reached by position. */
const PEEK = 0;
const FULL = 2;

interface Drag {
  startY: number;
  startVisible: number;
  moved: boolean;
  samples: { y: number; time: number }[];
}

function nearestIndex(points: number[], value: number): number {
  let best = 0;
  points.forEach((point, index) => {
    if (Math.abs(point - value) < Math.abs(points[best] - value)) best = index;
  });
  return best;
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The control rail on small screens: a sheet that tracks the finger 1:1, can be
 * caught mid-flight, and lands where the flick was heading.
 *
 * It has no scrim. Up to the middle resting point the preview shrinks to stay in
 * view, so a slider can be moved while watching what it does.
 *
 * Resting points are measured from the laid-out sheet rather than assumed, so
 * they follow the reader's text size and the device's safe areas.
 */
export function ControlsSheet({ onInset, viewportRef, handleRef, children }: ControlsSheetProps) {
  const contentId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const grabberRef = useRef<HTMLButtonElement>(null);
  const safeBottomRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const springRef = useRef<Spring | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const pointsRef = useRef<number[]>([0, 0, 0]);
  const safeRef = useRef(0);
  const detentRef = useRef(PEEK);

  const onInsetRef = useRef(onInset);
  onInsetRef.current = onInset;

  const measure = () => {
    const full = sheetRef.current?.offsetHeight ?? 0;
    const safe = safeBottomRef.current?.offsetHeight ?? 0;
    const peek = (grabberRef.current?.offsetHeight ?? 0) + safe;
    safeRef.current = safe;
    pointsRef.current = [peek, Math.min(Math.round(window.innerHeight * 0.5), full), full];
  };

  const apply = (visible: number) => {
    const [peek, half, full] = pointsRef.current;
    const sheet = sheetRef.current;
    if (sheet) sheet.style.transform = `translate3d(0, ${full - visible}px, 0)`;
    onInsetRef.current(Math.max(peek, Math.min(visible, half)));
  };

  const settleAt = (detent: number, velocity = 0, animate = true) => {
    const spring = springRef.current;
    if (!spring) return;
    detentRef.current = detent;
    const target = pointsRef.current[detent];
    const scroller = scrollerRef.current;
    if (scroller) {
      // Everything below the fold must stay reachable by scrolling.
      scroller.style.paddingBottom = `${pointsRef.current[FULL] - target + safeRef.current}px`;
      // Off-screen controls must not take focus or be read out.
      scroller.inert = detent === PEEK;
    }
    grabberRef.current?.setAttribute('aria-expanded', String(detent !== PEEK));
    if (!animate || reducedMotion()) spring.set(target);
    else spring.to(target, Math.abs(velocity) > MOMENTUM_THRESHOLD ? SPRING_MOMENTUM : SPRING_DEFAULT, velocity);
  };

  // Layout effect, so the sheet is never painted before it is in position.
  useLayoutEffect(() => {
    measure();
    const spring = new Spring(pointsRef.current[PEEK], apply);
    springRef.current = spring;
    settleAt(PEEK, 0, false);

    const onResize = () => {
      measure();
      if (!dragRef.current) settleAt(detentRef.current, 0, false);
    };
    // The observer catches text-size changes, which fire no window resize.
    const observer = new ResizeObserver(onResize);
    if (sheetRef.current) observer.observe(sheetRef.current);
    if (grabberRef.current) observer.observe(grabberRef.current);
    window.addEventListener('resize', onResize);
    return () => {
      spring.stop();
      observer.disconnect();
      window.removeEventListener('resize', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- set up once; reads refs only.
  }, []);

  useImperativeHandle(handleRef, () => ({ expand: () => settleAt(FULL) }), []);

  const beginDrag = (y: number, time: number, moved = false) => {
    const spring = springRef.current;
    if (!spring) return;
    // Catches a moving sheet exactly where it is on screen.
    spring.stop();
    dragRef.current = {
      startY: y,
      startVisible: spring.value,
      moved,
      samples: [{ y, time }],
    };
  };

  const moveDrag = (y: number, time: number) => {
    const drag = dragRef.current;
    const spring = springRef.current;
    if (!drag || !spring) return;
    if (Math.abs(y - drag.startY) > TAP_SLOP) drag.moved = true;
    if (!drag.moved) return;

    drag.samples.push({ y, time });
    if (drag.samples.length > 8) drag.samples.shift();

    const [low, , high] = pointsRef.current;
    const raw = drag.startVisible + (drag.startY - y);
    const height = window.innerHeight;
    let visible = raw;
    if (raw > high) visible = high + rubberband(raw - high, height);
    else if (raw < low) visible = low + rubberband(raw - low, height);
    spring.set(visible);
  };

  const endDrag = (time: number) => {
    const drag = dragRef.current;
    const spring = springRef.current;
    dragRef.current = null;
    if (!drag || !spring) return;

    if (!drag.moved) {
      settleAt((nearestIndex(pointsRef.current, spring.value) + 1) % pointsRef.current.length);
      return;
    }

    const recent = drag.samples.filter((sample) => time - sample.time <= VELOCITY_WINDOW_MS);
    const first = recent[0];
    const last = recent[recent.length - 1];
    const elapsed = first && last ? last.time - first.time : 0;
    // Positive is upwards, matching the visible height it feeds.
    const measured = elapsed > 0 ? ((first.y - last.y) / elapsed) * 1000 : 0;
    const velocity = Math.max(-MAX_VELOCITY, Math.min(measured, MAX_VELOCITY));
    settleAt(nearestIndex(pointsRef.current, spring.value + projectMomentum(velocity)), velocity);
  };

  // Pulling down on content already scrolled to the top moves the sheet instead.
  // Native listeners, because React's touch handlers cannot prevent scrolling.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let start: { y: number; time: number } | null = null;

    const onTouchStart = (event: TouchEvent) => {
      const target = event.target as HTMLElement;
      const claimed = target.closest('[data-slot="slider"], input');
      start =
        event.touches.length === 1 && scroller.scrollTop <= 0 && !claimed
          ? { y: event.touches[0].clientY, time: event.timeStamp }
          : null;
    };
    const onTouchMove = (event: TouchEvent) => {
      const y = event.touches[0].clientY;
      if (start && !dragRef.current) {
        const pull = y - start.y;
        // Scrolling up belongs to the content, for the rest of this touch.
        if (pull < -PULL_SLOP) start = null;
        // Already past the slop: however short from here, this is never a tap.
        else if (pull > PULL_SLOP) beginDrag(y, event.timeStamp, true);
      }
      if (dragRef.current) {
        event.preventDefault();
        moveDrag(y, event.timeStamp);
      }
    };
    const onTouchEnd = (event: TouchEvent) => {
      start = null;
      if (dragRef.current) endDrag(event.timeStamp);
    };

    scroller.addEventListener('touchstart', onTouchStart, { passive: true });
    scroller.addEventListener('touchmove', onTouchMove, { passive: false });
    scroller.addEventListener('touchend', onTouchEnd);
    scroller.addEventListener('touchcancel', onTouchEnd);
    return () => {
      scroller.removeEventListener('touchstart', onTouchStart);
      scroller.removeEventListener('touchmove', onTouchMove);
      scroller.removeEventListener('touchend', onTouchEnd);
      scroller.removeEventListener('touchcancel', onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- set up once; reads refs only.
  }, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const count = pointsRef.current.length;
    const current = detentRef.current;
    let next: number;
    if (event.key === 'ArrowUp') next = Math.min(current + 1, count - 1);
    else if (event.key === 'ArrowDown') next = Math.max(current - 1, 0);
    else if (event.key === 'Enter' || event.key === ' ') next = (current + 1) % count;
    else return;
    event.preventDefault();
    settleAt(next);
  };

  return (
    <div
      ref={sheetRef}
      className="fixed inset-x-0 bottom-0 z-30 flex h-[calc(100dvh-3rem-env(safe-area-inset-top))] flex-col rounded-t-2xl bg-card shadow-[inset_0_0.5px_0_rgb(255_255_255/0.14),0_-8px_32px_rgb(0_0_0/0.5)] will-change-transform after:absolute after:inset-x-0 after:top-full after:h-[50vh] after:bg-card"
    >
      {/* Reads the safe area, which CSS knows and script does not. */}
      <div
        ref={safeBottomRef}
        aria-hidden="true"
        className="pointer-events-none absolute w-0 h-[env(safe-area-inset-bottom)]"
      />
      <button
        ref={grabberRef}
        type="button"
        aria-label="Controls. Press to resize."
        aria-controls={contentId}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          beginDrag(event.clientY, event.timeStamp);
        }}
        onPointerMove={(event) => moveDrag(event.clientY, event.timeStamp)}
        onPointerUp={(event) => endDrag(event.timeStamp)}
        onPointerCancel={(event) => endDrag(event.timeStamp)}
        onKeyDown={onKeyDown}
        className="flex h-[3.25rem] shrink-0 cursor-grab touch-none flex-col items-center gap-1.5 rounded-t-2xl pt-2 font-semibold select-none focus-visible:-outline-offset-2 active:cursor-grabbing"
      >
        <span aria-hidden="true" className="h-1 w-9 rounded-full bg-input" />
        Controls
      </button>
      <div
        id={contentId}
        ref={(node) => {
          scrollerRef.current = node;
          if (typeof viewportRef === 'function') viewportRef(node);
          else if (viewportRef) viewportRef.current = node;
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-border"
      >
        {children}
      </div>
    </div>
  );
}
