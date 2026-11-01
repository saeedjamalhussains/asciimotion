import { useCallback, useEffect, useRef, useState } from 'react';
import type { TimelineState } from '../hooks/useTimeline';
import { PLAYBACK_RATES, type VideoTransport } from '../hooks/useVideo';
import type { FrameSource } from '../video/frameSource';
import { buildTicks, formatTick, ratioFromPointer, tickInterval } from '../video/timeline';
import { startFrameLoop } from '../utils/frameLoop';
import { MIN_TRIM_DURATION } from '../video/trim';
import { cn } from '@/lib/utils';
import { formatTime } from '../utils/formatTime';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { TrimControls } from './TrimControls';
import { IconButton } from './controls/IconButton';
import { LoopIcon, MuteIcon, PauseIcon, PlayIcon, RestartIcon, VolumeIcon } from './ui/Icons';

interface TimelineProps {
  source: FrameSource;
  transport: VideoTransport;
  timeline: TimelineState;
}

const RULER_TICKS = 6;

type DragTarget = 'playhead' | 'start' | 'end' | null;

/**
 * Transport bar and scrubber.
 *
 * The playhead is updated imperatively from an animation frame — writing the
 * position into React state sixty times a second would re-render the editor
 * for no visual gain.
 */
export function Timeline({ source, transport, timeline }: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const timeLabelRef = useRef<HTMLSpanElement>(null);
  /** Where on the handle it was grabbed, so taking hold of it does not nudge it. */
  const grabOffsetRef = useRef(0);
  const [dragging, setDragging] = useState<DragTarget>(null);
  const draggingRef = useRef<DragTarget>(null);
  const [showVolume, setShowVolume] = useState(false);

  const { duration, trim } = timeline;
  const trimRef = useRef(trim);
  trimRef.current = trim;

  // --- Imperative playhead loop -------------------------------------------
  useEffect(() => {
    let lastRatio = -1;
    let lastLabel = '';

    const tick = () => {
      if (duration <= 0) return;
      const time = source.currentTime;
      const ratio = Math.max(0, Math.min(1, time / duration));
      if (Math.abs(ratio - lastRatio) > 0.0002) {
        lastRatio = ratio;
        const percent = `${ratio * 100}%`;
        if (playheadRef.current) playheadRef.current.style.left = percent;
        trackRef.current?.setAttribute('aria-valuenow', time.toFixed(2));
      }
      const label = formatTime(time);
      if (label !== lastLabel && timeLabelRef.current) {
        lastLabel = label;
        timeLabelRef.current.textContent = label;
      }
    };

    const loop = startFrameLoop(tick);
    return () => loop.stop();
  }, [source, duration]);

  // --- Pointer dragging ----------------------------------------------------
  const applyPointer = useCallback(
    (clientX: number, target: DragTarget) => {
      const track = trackRef.current;
      if (!track || duration <= 0) return;
      const ratio = ratioFromPointer(clientX - grabOffsetRef.current, track.getBoundingClientRect());
      const time = ratio * duration;
      if (target === 'start') {
        timeline.setStart(Math.min(time, trimRef.current.end - MIN_TRIM_DURATION));
      } else if (target === 'end') {
        timeline.setEnd(Math.max(time, trimRef.current.start + MIN_TRIM_DURATION));
      } else {
        transport.seek(time);
      }
    },
    [duration, timeline, transport],
  );

  const beginDrag = (event: React.PointerEvent, target: DragTarget) => {
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    grabOffsetRef.current = 0;
    if (target === 'start' || target === 'end') {
      const rect = event.currentTarget.getBoundingClientRect();
      grabOffsetRef.current = event.clientX - (rect.left + rect.width / 2);
    }
    draggingRef.current = target;
    setDragging(target);
    applyPointer(event.clientX, target);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: PointerEvent) => {
      event.preventDefault();
      applyPointer(event.clientX, draggingRef.current);
    };
    const onUp = () => {
      draggingRef.current = null;
      setDragging(null);
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, applyPointer]);

  const startRatio = duration > 0 ? trim.start / duration : 0;
  const endRatio = duration > 0 ? trim.end / duration : 1;
  const ticks = buildTicks(duration, RULER_TICKS);
  const tickSpacing = tickInterval(duration, RULER_TICKS);
  const cycleRate = () => {
    const index = PLAYBACK_RATES.indexOf(transport.rate as (typeof PLAYBACK_RATES)[number]);
    transport.setRate(PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length]);
  };

  const onTrackKeyDown = (event: React.KeyboardEvent) => {
    const step = event.shiftKey ? 1 : 1 / 30;
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        transport.step(-step);
        break;
      case 'ArrowRight':
        event.preventDefault();
        transport.step(step);
        break;
      case 'Home':
        event.preventDefault();
        transport.seek(trim.start);
        break;
      case 'End':
        event.preventDefault();
        transport.seek(trim.end);
        break;
      case ' ':
      case 'k':
        event.preventDefault();
        transport.toggle();
        break;
      default:
        break;
    }
  };

  const handleKey = (event: React.KeyboardEvent, target: 'start' | 'end') => {
    const step = event.shiftKey ? 1 : 0.05;
    let delta = 0;
    if (event.key === 'ArrowLeft') delta = -step;
    else if (event.key === 'ArrowRight') delta = step;
    else return;
    event.preventDefault();
    if (target === 'start') timeline.setStart(trim.start + delta);
    else timeline.setEnd(trim.end + delta);
  };

  const handleBar = cn(
    'absolute inset-y-0.5 left-1/2 w-1 -translate-x-1/2 rounded-full transition-colors',
    timeline.trimmed ? 'bg-trim' : 'bg-white/50',
  );

  return (
    <div className="glass rounded-2xl p-2">
      {/* -------------------------------------------------------- Scrubber */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Playhead"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={0}
        aria-valuetext={`${formatTime(source.currentTime)} of ${formatTime(duration)}`}
        onKeyDown={onTrackKeyDown}
        onPointerDown={(event) => beginDrag(event, 'playhead')}
        className={cn(
          'relative mx-1.5 h-9 cursor-pointer touch-none rounded-md bg-black/35 select-none pointer-coarse:h-11',
          dragging && 'cursor-grabbing',
        )}
      >
        {/* Ruler */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {ticks.map((tick) => {
            const ratio = duration > 0 ? tick / duration : 0;
            // The ends are the clip's own edges; a label there would only clip.
            if (ratio <= 0.02 || ratio >= 0.98) return null;
            return (
              <div
                key={tick}
                className="absolute inset-y-0 flex items-center"
                style={{ left: `${ratio * 100}%` }}
              >
                <span className="tabular -translate-x-1/2 text-caption text-muted-foreground">
                  {formatTick(tick, tickSpacing)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Regions outside the trim selection */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 rounded-l-md bg-black/50"
          style={{ width: `${startRatio * 100}%` }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 rounded-r-md bg-black/50"
          style={{ width: `${(1 - endRatio) * 100}%` }}
        />

        {/* Selected region */}
        {timeline.trimmed && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 border-y-2 border-trim"
            style={{ left: `${startRatio * 100}%`, width: `${(endRatio - startRatio) * 100}%` }}
          />
        )}

        {/* Playhead */}
        <div
          aria-hidden="true"
          ref={playheadRef}
          className="pointer-events-none absolute -inset-y-0.5 z-10 -ml-px w-0.5 rounded-full bg-white shadow-[0_0_3px_rgb(0_0_0/0.8)]"
          style={{ left: '0%' }}
        />

        {/* Trim handles */}
        <button
          type="button"
          role="slider"
          aria-label="Trim start"
          aria-valuemin={0}
          aria-valuemax={trim.end}
          aria-valuenow={trim.start}
          aria-valuetext={`Start at ${formatTime(trim.start)}`}
          onPointerDown={(event) => beginDrag(event, 'start')}
          onKeyDown={(event) => handleKey(event, 'start')}
          className="absolute inset-y-0 z-20 -ml-2.5 w-5 cursor-ew-resize touch-none pointer-coarse:-ml-4 pointer-coarse:w-8"
          style={{ left: `${startRatio * 100}%` }}
        >
          <span className={handleBar} />
        </button>
        <button
          type="button"
          role="slider"
          aria-label="Trim end"
          aria-valuemin={trim.start}
          aria-valuemax={duration}
          aria-valuenow={trim.end}
          aria-valuetext={`End at ${formatTime(trim.end)}`}
          onPointerDown={(event) => beginDrag(event, 'end')}
          onKeyDown={(event) => handleKey(event, 'end')}
          className="absolute inset-y-0 z-20 -ml-2.5 w-5 cursor-ew-resize touch-none pointer-coarse:-ml-4 pointer-coarse:w-8"
          style={{ left: `${endRatio * 100}%` }}
        >
          <span className={handleBar} />
        </button>
      </div>

      {/* ------------------------------------------------------- Transport */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1.5">
        <div className="flex items-center">
          <IconButton
            label={transport.playing ? 'Pause' : 'Play'}
            onClick={transport.toggle}
            size="lg"
            className="text-foreground"
          >
            {transport.playing ? <PauseIcon /> : <PlayIcon />}
          </IconButton>
          <IconButton label="Restart" onClick={transport.restart}>
            <RestartIcon />
          </IconButton>
          <IconButton
            label={transport.loop ? 'Looping the selected range' : 'Loop the selected range'}
            active={transport.loop}
            onClick={() => transport.setLoop(!transport.loop)}
          >
            <LoopIcon />
          </IconButton>
        </div>

        <div className="tabular whitespace-nowrap">
          <span ref={timeLabelRef} className="text-foreground">
            {formatTime(0)}
          </span>
          <span className="px-1 text-fg-dim">/</span>
          <span className="text-fg-dim">{formatTime(duration)}</span>
        </div>

        <div className="am-trim-row order-last w-full sm:order-none sm:w-auto">
          <TrimControls
            trim={trim}
            trimmed={timeline.trimmed}
            getTime={transport.getTime}
            onSetStart={timeline.setStart}
            onSetEnd={timeline.setEnd}
            onReset={timeline.reset}
          />
        </div>

        <div className="ml-auto flex items-center gap-0.5">
          {source.info.hasAudio && (
            <div
              className="relative flex items-center"
              onMouseEnter={() => setShowVolume(true)}
              onMouseLeave={() => setShowVolume(false)}
            >
              <IconButton
                label={transport.muted ? 'Unmute' : 'Mute'}
                onClick={() => transport.setMuted(!transport.muted)}
                onFocus={() => setShowVolume(true)}
              >
                {transport.muted || transport.volume === 0 ? <MuteIcon /> : <VolumeIcon />}
              </IconButton>
              <div
                className={cn(
                  'overflow-hidden transition-[width,opacity] duration-200 ease-apple',
                  showVolume ? 'w-22 opacity-100' : 'w-0 opacity-0',
                )}
              >
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={[transport.muted ? 0 : transport.volume]}
                  aria-label="Volume"
                  aria-valuetext={`${Math.round(transport.volume * 100)} percent`}
                  onValueChange={([next]) => transport.setVolume(next)}
                  onBlur={() => setShowVolume(false)}
                  className="mx-1 w-20"
                />
              </div>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            aria-label={`Playback speed ${transport.rate} times. Press to change.`}
            title="Playback speed"
            onClick={cycleRate}
            className="tabular min-w-11"
          >
            {transport.rate}×
          </Button>
        </div>
      </div>
    </div>
  );
}
