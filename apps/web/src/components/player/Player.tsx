'use client';

import { useEffect, useRef } from 'react';
import { useReport } from '@/components/ReportContext';
import { usePlaybackEngine, usePlaybackState } from '@/lib/playback/usePlayback';
import { DemoBadge } from '@/components/ui/ProvenanceChip';
import { Timeline, fmtTime } from './Timeline';

export function Player() {
  const { report } = useReport();
  const engine = usePlaybackEngine();
  const { playing, error } = usePlaybackState();
  const timeRef = useRef<HTMLSpanElement>(null);

  useEffect(
    () =>
      engine.onFrame((t) => {
        if (timeRef.current) timeRef.current.textContent = fmtTime(t);
      }),
    [engine],
  );

  return (
    <div className="rounded-lg border border-lab-border bg-lab-card/95 p-3 shadow-[0_-8px_30px_rgba(0,0,0,0.6)] backdrop-blur">
      <div className="mb-3 flex items-center gap-3">
        <button
          type="button"
          onClick={engine.toggle}
          aria-label={playing ? 'Pausar' : 'Reproducir'}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent-cyan text-accent-cyan transition-colors hover:bg-accent-cyan/15"
        >
          <span aria-hidden className="font-mono text-sm">{playing ? '❚❚' : '▶'}</span>
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-lab-text">{report.track.title}</span>
            {report.demo && <DemoBadge />}
          </div>
          <div className="truncate text-xs text-lab-dim">{report.track.artist}</div>
        </div>
        <div className="ml-auto font-mono text-sm tabular-nums text-lab-text">
          <span ref={timeRef}>0:00</span>
          <span className="text-lab-dim"> / {fmtTime(report.track.duration_s)}</span>
        </div>
      </div>
      <Timeline />
      {error && <p className="mt-2 font-mono text-xs text-accent-red" role="alert">{error}</p>}
    </div>
  );
}
