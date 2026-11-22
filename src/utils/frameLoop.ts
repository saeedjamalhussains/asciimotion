/**
 * A render loop that keeps working when `requestAnimationFrame` doesn't.
 *
 * Browsers suspend rAF entirely while a document is hidden, and some embedded
 * contexts report `visibilityState: 'hidden'` even though the page is being
 * presented. A pure rAF loop therefore risks never painting a first frame at
 * all. This scheduler uses rAF while the page is visible — the right thing for
 * smooth playback — and falls back to a slow timer while it is hidden, where
 * the callback's own dirty-checking keeps the cost near zero.
 */

export interface FrameLoop {
  stop(): void;
}

export function startFrameLoop(
  callback: (now: number) => void,
  hiddenIntervalMs = 250,
): FrameLoop {
  let rafId = 0;
  let timerId = 0;
  let stopped = false;

  const cancel = () => {
    if (rafId) cancelAnimationFrame(rafId);
    if (timerId) window.clearTimeout(timerId);
    rafId = 0;
    timerId = 0;
  };

  const run = (now: number) => {
    rafId = 0;
    timerId = 0;
    if (stopped) return;
    try {
      callback(now);
    } catch {
      // A single bad frame must not kill the loop.
    }
    schedule();
  };

  function schedule(): void {
    if (stopped) return;
    if (typeof document !== 'undefined' && document.hidden) {
      timerId = window.setTimeout(() => run(performance.now()), hiddenIntervalMs);
    } else {
      rafId = requestAnimationFrame(run);
    }
  }

  // Switching back to a visible tab should resume at full rate immediately.
  const onVisibilityChange = () => {
    cancel();
    schedule();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  schedule();

  return {
    stop() {
      stopped = true;
      cancel();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    },
  };
}
