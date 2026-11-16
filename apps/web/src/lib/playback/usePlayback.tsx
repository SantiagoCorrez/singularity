'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { Report } from '@/types/report';
import { PlaybackClock } from './clock';
import { sectionIndexAt, windowIndexAt } from './energy';

export type PlaybackState = {
  playing: boolean;
  /** false hasta que el usuario reproduce o salta por primera vez. */
  started: boolean;
  windowIndex: number;
  sectionIndex: number;
  error: string | null;
};

type FrameCb = (t: number, state: PlaybackState) => void;

export type PlaybackEngine = {
  duration: number;
  now: () => number;
  toggle: () => void;
  seek: (t: number) => void;
  /** Se llama una vez por frame, con el tiempo del reloj único. */
  onFrame: (cb: FrameCb) => () => void;
  subscribe: (cb: () => void) => () => void;
  getState: () => PlaybackState;
};

const INITIAL: PlaybackState = { playing: false, started: false, windowIndex: 0, sectionIndex: 0, error: null };
const Ctx = createContext<PlaybackEngine | null>(null);

export function PlaybackProvider({ report, children }: { report: Report; children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clockRef = useRef<PlaybackClock | null>(null);
  const stateRef = useRef<PlaybackState>(INITIAL);
  const frameCbs = useRef(new Set<FrameCb>());
  const storeCbs = useRef(new Set<() => void>());

  const engine = useMemo<PlaybackEngine>(() => {
    const set = (patch: Partial<PlaybackState>) => {
      stateRef.current = { ...stateRef.current, ...patch };
      storeCbs.current.forEach((cb) => cb());
    };
    return {
      duration: report.track.duration_s,
      now: () => clockRef.current?.now() ?? 0,
      toggle: () => {
        const a = audioRef.current;
        if (!a) return;
        if (a.paused) {
          set({ started: true });
          a.play().catch((e: unknown) => set({ error: `No se pudo reproducir el audio: ${String(e)}` }));
        } else a.pause();
      },
      seek: (t) => {
        const a = audioRef.current;
        if (!a) return;
        a.currentTime = Math.max(0, Math.min(report.track.duration_s - 0.05, t));
        set({ started: true });
      },
      onFrame: (cb) => {
        frameCbs.current.add(cb);
        return () => void frameCbs.current.delete(cb);
      },
      subscribe: (cb) => {
        storeCbs.current.add(cb);
        return () => void storeCbs.current.delete(cb);
      },
      getState: () => stateRef.current,
    };
  }, [report]);

  useEffect(() => {
    const audio = new Audio(report.track.audio_url);
    audio.preload = 'auto';
    audioRef.current = audio;
    clockRef.current = new PlaybackClock(audio);
    stateRef.current = INITIAL;

    const set = (patch: Partial<PlaybackState>) => {
      stateRef.current = { ...stateRef.current, ...patch };
      storeCbs.current.forEach((cb) => cb());
    };
    const onPlay = () => set({ playing: true });
    const onPause = () => set({ playing: false });
    const onError = () => set({ error: 'No se pudo cargar el audio de la pista.' });
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onPause);
    audio.addEventListener('error', onError);

    let raf = 0;
    const loop = () => {
      const t = clockRef.current!.now();
      const wi = windowIndexAt(report.windows, t);
      const si = sectionIndexAt(report.sections, t);
      if (wi !== stateRef.current.windowIndex || si !== stateRef.current.sectionIndex) {
        set({ windowIndex: wi, sectionIndex: si });
      }
      const s = stateRef.current;
      frameCbs.current.forEach((cb) => cb(t, s));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      audio.pause();
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onPause);
      audio.removeEventListener('error', onError);
      audio.src = '';
    };
  }, [report]);

  return <Ctx.Provider value={engine}>{children}</Ctx.Provider>;
}

export function usePlaybackEngine(): PlaybackEngine {
  const e = useContext(Ctx);
  if (!e) throw new Error('usePlaybackEngine fuera de PlaybackProvider');
  return e;
}

/** Estado discreto (cambia pocas veces por segundo). Para animar, usa engine.onFrame. */
export function usePlaybackState(): PlaybackState {
  const e = usePlaybackEngine();
  return useSyncExternalStore(e.subscribe, e.getState, () => INITIAL);
}
