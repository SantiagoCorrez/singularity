'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useReport } from '@/components/ReportContext';
import { QUADRANTS } from '@/lib/dimensions';
import { usePlaybackEngine, usePlaybackState } from '@/lib/playback/usePlayback';
import { Abstention } from '@/components/ui/Abstention';

const MARK: Record<string, { glyph: string; color: string }> = {
  intro: { glyph: '▸', color: '#3fd0ff' },
  climax: { glyph: '★', color: '#ffd23f' },
  chill: { glyph: '✦', color: '#ff4fd8' },
};
const BINS = 160;

export function fmtTime(t: number): string {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Línea de tiempo: por cuadrante de cada tramo o, si las emociones se abstienen, por energía. */
export function Timeline() {
  const { report, judge } = useReport();
  const engine = usePlaybackEngine();
  const { sectionIndex } = usePlaybackState();
  const trackRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const dur = report.track.duration_s;

  const emotion = judge(report.series.emotion);
  const energy = judge(report.series.energy);
  const byQuadrant = emotion.kind !== 'abstain';
  const byEnergy = !byQuadrant && energy.kind !== 'abstain';
  const structureOk = judge(report.series.structure).kind !== 'abstain';

  const bins = useMemo(() => {
    const rms = report.envelope.rms;
    return Array.from({ length: BINS }, (_, i) => {
      const a = Math.floor((i / BINS) * rms.length);
      const b = Math.max(a + 1, Math.floor(((i + 1) / BINS) * rms.length));
      let m = 0;
      for (let k = a; k < b; k++) m = Math.max(m, rms[k]);
      return m;
    });
  }, [report]);

  // Cada marca depende de la cifra que la respalda.
  const markers = report.markers.filter((m) =>
    m.kind === 'chill' ? byQuadrant : m.kind === 'climax' ? judge(report.descriptors.climax).kind !== 'abstain' : energy.kind !== 'abstain',
  );

  useEffect(
    () =>
      engine.onFrame((t) => {
        if (headRef.current) headRef.current.style.left = `${(Math.min(dur, t) / dur) * 100}%`;
        trackRef.current?.setAttribute('aria-valuenow', String(Math.round(t)));
        trackRef.current?.setAttribute('aria-valuetext', fmtTime(t));
      }),
    [engine, dur],
  );

  const seekFromX = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    engine.seek(((clientX - r.left) / r.width) * dur);
  };

  return (
    <div>
      <div className="relative pt-5">
        {markers.map((m) => (
          <button
            key={`${m.kind}-${m.t}`}
            type="button"
            onClick={() => engine.seek(m.t)}
            title={`${m.label} · ${fmtTime(m.t)}`}
            aria-label={`Saltar a ${m.label}, ${fmtTime(m.t)}`}
            className="absolute top-0 -translate-x-1/2 font-mono text-xs leading-none"
            style={{ left: `${(m.t / dur) * 100}%`, color: MARK[m.kind].color }}
          >
            {MARK[m.kind].glyph}
          </button>
        ))}
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label="Posición en la pista"
          aria-valuemin={0}
          aria-valuemax={Math.round(dur)}
          aria-valuenow={0}
          className="relative h-10 cursor-pointer overflow-hidden rounded border border-lab-border bg-lab-bg"
          onClick={(e) => seekFromX(e.clientX)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') engine.seek(engine.now() + 5);
            else if (e.key === 'ArrowLeft') engine.seek(engine.now() - 5);
            else if (e.key === ' ' || e.key === 'Enter') engine.toggle();
            else return;
            e.preventDefault();
          }}
        >
          {byQuadrant &&
            report.sections.map((s, i) => (
              <div
                key={s.id}
                className="absolute inset-y-0 flex items-center overflow-hidden border-r border-lab-bg px-1.5"
                style={{
                  left: `${(s.t0 / dur) * 100}%`,
                  width: `${((s.t1 - s.t0) / dur) * 100}%`,
                  background: s.quadrant ? QUADRANTS[s.quadrant].color : '#7f8db0',
                  opacity: i === sectionIndex ? 1 : 0.6,
                }}
              >
                <span className="truncate font-mono text-[0.6rem] font-semibold uppercase tracking-wider text-[#060912]">
                  {s.label}
                </span>
              </div>
            ))}
          {byEnergy && structureOk &&
            report.sections.slice(1).map((s) => (
              <div key={`sep-${s.id}`} className="pointer-events-none absolute inset-y-0 z-[1] w-px bg-lab-text/40" style={{ left: `${(s.t0 / dur) * 100}%` }} />
            ))}
          {byEnergy && (
            <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${BINS} 1`} preserveAspectRatio="none" aria-hidden>
              {bins.map((v, i) => (
                <rect key={i} x={i} y={1 - v} width={0.8} height={v} fill="#3fd0ff" fillOpacity={0.25 + 0.65 * v} />
              ))}
            </svg>
          )}
          {markers.map((m) => (
            <div
              key={`tick-${m.kind}-${m.t}`}
              className="pointer-events-none absolute inset-y-0 w-px"
              style={{ left: `${(m.t / dur) * 100}%`, background: MARK[m.kind].color, opacity: 0.9 }}
            />
          ))}
          <div ref={headRef} className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_8px_#fff]" style={{ left: 0 }} />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[0.62rem] text-lab-dim">
        {byQuadrant &&
          (Object.keys(QUADRANTS) as (keyof typeof QUADRANTS)[]).map((q) => (
            <span key={q} className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm" style={{ background: QUADRANTS[q].color }} />
              {QUADRANTS[q].label}
            </span>
          ))}
        {byEnergy && <span>Coloreada por energía: los cuadrantes están en abstención.</span>}
        {markers.length > 0 && (
          <span className="ml-auto">
            {[...new Set(markers.map((m) => m.kind))].map((k) => (
              <span key={k} className="ml-3" style={{ color: MARK[k].color }}>
                {MARK[k].glyph} {k === 'climax' ? 'clímax' : k === 'chill' ? 'escalofrío' : 'intro'}
              </span>
            ))}
          </span>
        )}
      </div>
      {!byQuadrant && !byEnergy && (
        <div className="mt-2">
          <Abstention missing={energy.missing} compact />
        </div>
      )}
    </div>
  );
}
