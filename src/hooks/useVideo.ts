import { useCallback, useEffect, useRef, useState } from 'react';
import type { TrimRange } from '../types';
import type { FrameSource } from '../video/frameSource';

export const PLAYBACK_RATES = [0.25, 0.5, 1, 1.5, 2] as const;

export interface VideoTransport {
  playing: boolean;
  muted: boolean;
  volume: number;
  rate: number;
  ended: boolean;
  loop: boolean;
  toggle(): void;
  play(): void;
  pause(): void;
  restart(): void;
  seek(time: number): void;
  step(deltaSeconds: number): void;
  setMuted(value: boolean): void;
  setVolume(value: number): void;
  setRate(value: number): void;
  setLoop(value: boolean): void;
  /** Reads the live position without triggering a React render. */
  getTime(): number;
}

/**
 * Transport controls for any `FrameSource`.
 *
 * Only coarse state (playing, muted, volume, rate) lives in React. The
 * playhead position is read imperatively by the timeline inside its own
 * animation frame, so a playing video never re-renders the component tree.
 */
export function useVideo(source: FrameSource | null, trim: TrimRange): VideoTransport {
  const [playing, setPlaying] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [rate, setRateState] = useState(1);
  const [ended, setEnded] = useState(false);
  const [loop, setLoopState] = useState(false);
  const trimRef = useRef(trim);
  trimRef.current = trim;
  // Read inside interval and event callbacks that outlive a given render.
  const loopRef = useRef(loop);
  loopRef.current = loop;

  useEffect(() => {
    if (!source) {
      setPlaying(false);
      setEnded(false);
      return;
    }
    setPlaying(!source.paused);
    setMutedState(source.muted);
    setVolumeState(source.volume);
    setRateState(source.playbackRate);
    setEnded(false);

    const offPlay = source.on('play', () => {
      setPlaying(true);
      setEnded(false);
    });
    const offPause = source.on('pause', () => setPlaying(false));
    const offEnded = source.on('ended', () => {
      // A clip whose out-point is the very end finishes on its own before the
      // polling interval can catch it, so looping has to be handled here too.
      if (loopRef.current) {
        source.currentTime = trimRef.current.start;
        void source.play().catch(() => setPlaying(false));
        return;
      }
      setPlaying(false);
      setEnded(true);
    });
    const offVolume = source.on('volumechange', () => {
      setMutedState(source.muted);
      setVolumeState(source.volume);
    });
    const offRate = source.on('ratechange', () => setRateState(source.playbackRate));

    return () => {
      offPlay();
      offPause();
      offEnded();
      offVolume();
      offRate();
    };
  }, [source]);

  /**
   * Playback stops at the trim out-point, or wraps back to the in-point when
   * looping. A short polling interval is enough here and costs far less than a
   * per-frame React update.
   */
  useEffect(() => {
    if (!source || !playing) return;
    const id = window.setInterval(() => {
      const { start, end } = trimRef.current;
      if (source.currentTime >= end - 0.01) {
        if (loopRef.current) {
          // Seeking alone keeps playback running, so the loop is seamless.
          source.currentTime = start;
        } else {
          source.pause();
          source.currentTime = end;
        }
      } else if (source.currentTime < start - 0.05) {
        source.currentTime = start;
      }
    }, 40);
    return () => window.clearInterval(id);
  }, [source, playing]);

  const play = useCallback(() => {
    if (!source) return;
    const { start, end } = trimRef.current;
    if (source.currentTime >= end - 0.02 || source.currentTime < start) {
      source.currentTime = start;
    }
    void source.play().catch(() => setPlaying(false));
  }, [source]);

  const pause = useCallback(() => source?.pause(), [source]);

  const toggle = useCallback(() => {
    if (!source) return;
    if (source.paused) play();
    else source.pause();
  }, [source, play]);

  const restart = useCallback(() => {
    if (!source) return;
    source.currentTime = trimRef.current.start;
    setEnded(false);
    void source.play().catch(() => undefined);
  }, [source]);

  const seek = useCallback(
    (time: number) => {
      if (!source) return;
      const { start, end } = trimRef.current;
      source.currentTime = Math.max(start, Math.min(end, time));
      setEnded(false);
    },
    [source],
  );

  const step = useCallback(
    (delta: number) => {
      if (!source) return;
      seek(source.currentTime + delta);
    },
    [source, seek],
  );

  const setMuted = useCallback(
    (value: boolean) => {
      if (!source) return;
      source.muted = value;
      setMutedState(value);
    },
    [source],
  );

  const setVolume = useCallback(
    (value: number) => {
      if (!source) return;
      source.volume = value;
      setVolumeState(value);
      if (value > 0 && source.muted) {
        source.muted = false;
        setMutedState(false);
      }
    },
    [source],
  );

  const setRate = useCallback(
    (value: number) => {
      if (!source) return;
      source.playbackRate = value;
      setRateState(value);
    },
    [source],
  );

  const setLoop = useCallback((value: boolean) => setLoopState(value), []);

  const getTime = useCallback(() => source?.currentTime ?? 0, [source]);

  return {
    playing,
    muted,
    volume,
    rate,
    ended,
    loop,
    toggle,
    play,
    pause,
    restart,
    seek,
    step,
    setMuted,
    setVolume,
    setRate,
    setLoop,
    getTime,
  };
}
