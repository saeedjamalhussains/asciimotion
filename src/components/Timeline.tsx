import { useCallback, useEffect, useRef, useState } from 'react';
import type { TimelineState } from '../hooks/useTimeline';
import { PLAYBACK_RATES, type VideoTransport } from '../hooks/useVideo';
import type { FrameSource } from '../video/frameSource';
import { buildTicks, ratioFromPointer } from '../video/timeline';
import { startFrameLoop } from '../utils/frameLoop';
import { MIN_TRIM_DURATION } from '../video/trim';
import { cn } from '@/lib/utils';
import { formatTime } from '../utils/formatTime';
import { TrimControls } from './TrimControls';
import { IconButton } from './controls/IconButton';
import { LoopIcon, MuteIcon, PauseIcon, PlayIcon, RestartIcon, VolumeIcon } from './ui/Icons';

interface TimelineProps {
  source: FrameSource;
  transport: VideoTransport;
  timeline: TimelineState;
}

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
  const progressRef = useRef<HTMLDivElement>(null);
  const timeLabelRef = useRef<HTMLSpanElement>(null);
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
        if (progressRef.current) progressRef.current.style.width = percent;
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
      const ratio = ratioFromPointer(clientX, track.getBoundingClientRect());
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
  const ticks = buildTicks(duration, 10);

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

  return (
    <div className="shrink-0 overflow-hidden rounded-[10px] bg-card">
      {/* -------------------------------------------------------- Scrubber */}
      <div className="px-3 pt-3 pb-1">
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
            'relative h-14 w-full cursor-pointer touch-none rounded-[8px] border border-border bg-background select-none',
            dragging && 'cursor-grabbing',
          )}
        >
          {/* Ruler */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-full">
            {ticks.map((tick) => {
              const ratio = duration > 0 ? tick / duration : 0;
              if (ratio > 1) return null;
              return (
                <div
                  key={tick}
                  className="absolute top-0 flex h-full flex-col justify-start"
                  style={{ left: `${ratio * 100}%` }}
                >
                  <span className="block h-2 w-px bg-input" />
                  <span className="mt-0.5 -translate-x-1/2 pl-px font-mono text-[9px] text-faint">
                    {formatTime(tick)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Regions outside the trim selection */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 rounded-l-[7px] bg-background/70"
            style={{ width: `${startRatio * 100}%` }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 rounded-r-[7px] bg-background/70"
            style={{ width: `${(1 - endRatio) * 100}%` }}
          />

          {/* Selected region */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 border-x border-primary/70 bg-primary/[0.07]"
            style={{ left: `${startRatio * 100}%`, width: `${(endRatio - startRatio) * 100}%` }}
          />

          {/* Progress + playhead */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 bg-primary/[0.10]"
            ref={progressRef}
            style={{ width: '0%' }}
          />
          <div
            aria-hidden="true"
            ref={playheadRef}
            className="pointer-events-none absolute inset-y-0 z-10 w-px bg-primary"
            style={{ left: '0%' }}
          >
            <span className="absolute -top-px -left-[4px] h-[9px] w-[9px] rounded-[2px] bg-primary" />
          </div>

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
            className="absolute inset-y-0 z-20 -ml-[7px] w-[14px] cursor-ew-resize touch-none"
            style={{ left: `${startRatio * 100}%` }}
          >
            <span className="absolute inset-y-1 left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-primary shadow-[0_0_0_1px_rgba(0,0,0,0.6)]" />
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
            className="absolute inset-y-0 z-20 -ml-[7px] w-[14px] cursor-ew-resize touch-none"
            style={{ left: `${endRatio * 100}%` }}
          >
            <span className="absolute inset-y-1 left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-primary shadow-[0_0_0_1px_rgba(0,0,0,0.6)]" />
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------- Transport */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 pt-2 pb-2.5">
        <div className="flex items-center gap-1">
          <IconButton
            label={transport.playing ? 'Pause' : 'Play'}
            onClick={transport.toggle}
            size="lg"
            className="border border-input bg-secondary text-foreground hover:bg-accent"
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

        <div className="font-mono tabular text-[12.5px] whitespace-nowrap">
          <span ref={timeLabelRef} className="text-foreground">
            {formatTime(0)}
          </span>
          <span className="px-1 text-faint">/</span>
          <span className="text-muted-foreground">{formatTime(duration)}</span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {source.info.hasAudio ? (
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
                  'overflow-hidden transition-[width,opacity] duration-200',
                  showVolume ? 'w-[92px] opacity-100' : 'w-0 opacity-0',
                )}
              >
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={transport.muted ? 0 : transport.volume}
                  aria-label="Volume"
                  aria-valuetext={`${Math.round(transport.volume * 100)} percent`}
                  onChange={(event) => transport.setVolume(Number(event.target.value))}
                  onBlur={() => setShowVolume(false)}
                  className="am-slider !h-6 w-[84px]"
                  style={{
                    ['--am-fill' as string]: `${(transport.muted ? 0 : transport.volume) * 100}%`,
                  }}
                />
              </div>
            </div>
          ) : (
            <span className="hidden font-mono text-[10.5px] tracking-wide text-faint uppercase sm:inline">
              no audio
            </span>
          )}

          <div className="flex items-center rounded-[7px] border border-border bg-background p-0.5">
            {PLAYBACK_RATES.map((rate) => (
              <button
                key={rate}
                type="button"
                aria-pressed={transport.rate === rate}
                onClick={() => transport.setRate(rate)}
                className={cn(
                  'rounded-[5px] px-1.5 py-1 font-mono text-[10.5px] transition-colors',
                  transport.rate === rate
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:text-fg-dim',
                )}
              >
                {rate}×
              </button>
            ))}
          </div>
        </div>

        <div className="w-full border-t border-border pt-2.5">
          <TrimControls
            trim={trim}
            duration={duration}
            trimmed={timeline.trimmed}
            getTime={transport.getTime}
            onSetStart={timeline.setStart}
            onSetEnd={timeline.setEnd}
            onReset={timeline.reset}
          />
        </div>
      </div>
    </div>
  );
}
