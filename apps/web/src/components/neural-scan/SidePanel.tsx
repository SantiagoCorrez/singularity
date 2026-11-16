'use client';

import { useEffect, useRef } from 'react';
import { useReport } from '@/components/ReportContext';
import { DIMENSION_BY_ID, DIMENSIONS, QUADRANTS } from '@/lib/dimensions';
import { bandsAt } from '@/lib/playback/energy';
import { usePlaybackEngine, usePlaybackState } from '@/lib/playback/usePlayback';
import { Abstention } from '@/components/ui/Abstention';
import { Card } from '@/components/ui/Card';
import { Figure } from '@/components/ui/Figure';
import { DemoBadge, ProvenanceChip, UncalibratedBadge, provenanceTitle } from '@/components/ui/ProvenanceChip';

export function Dominant() {
  const { report, judge } = useReport();
  const { sectionIndex } = usePlaybackState();
  const f = report.dominant;
  const verdict = judge(f);
  const meta = verdict.kind !== 'abstain' ? DIMENSION_BY_ID[String(verdict.value)] : undefined;
  const value = report.dimensions.find((d) => d.id === meta?.id);
  const valueVerdict = judge(value);

  const emotion = judge(report.series.emotion);
  const section = report.sections[sectionIndex];
  const q = section?.quadrant ? QUADRANTS[section.quadrant] : undefined;

  return (
    <Card title="Emoción dominante">
      {verdict.kind === 'abstain' || !meta ? (
        <Abstention missing={verdict.kind === 'abstain' ? verdict.missing : ['dimensión no reconocida']} />
      ) : (
        <>
          <div className="flex items-baseline gap-3">
            <span
              className="font-mono text-4xl font-bold tracking-[0.08em]"
              style={{ color: meta.color, textShadow: `0 0 24px ${meta.color}66` }}
            >
              {meta.label.toUpperCase()}
            </span>
            {valueVerdict.kind !== 'abstain' && (
              <span className="font-mono text-xl text-lab-text">{valueVerdict.value} %</span>
            )}
          </div>
          <div className="mt-2">
            <ProvenanceChip figure={f} verdict={verdict} demo={report.demo} />
          </div>
        </>
      )}

      <div className="mt-4 border-t border-lab-border pt-3">
        <div className="label-mono">Cuadrante del tramo actual</div>
        {emotion.kind === 'abstain' || !q ? (
          <div className="mt-1">
            <Abstention missing={emotion.missing} />
          </div>
        ) : (
          <div className="mt-1 flex flex-wrap items-center gap-2" aria-live="polite">
            <span className="h-3 w-3 rounded-sm" style={{ background: q.color }} aria-hidden />
            <span className="font-mono text-lg font-semibold" style={{ color: q.color }}>{q.label}</span>
            <span className="text-xs text-lab-dim">
              {section.label} · {q.hint}
            </span>
            {emotion.kind === 'uncalibrated' && <UncalibratedBadge />}
            {report.demo && <DemoBadge />}
          </div>
        )}
      </div>
    </Card>
  );
}

export function DimensionBars() {
  const { report, judge } = useReport();
  const { windowIndex, started } = usePlaybackState();
  const live = started && judge(report.series.emotion).kind !== 'abstain';
  const rows = DIMENSIONS.map((d) => {
    const figure = report.dimensions.find((f) => f.id === d.id);
    return { d, figure, verdict: judge(figure) };
  });
  // Solo se ordenan por valor las que se muestran; las que se abstienen van al final en
  // orden fijo, para no revelar con el orden un valor que no se enseña.
  const val = (r: (typeof rows)[number]) => (r.verdict.kind === 'abstain' ? -1 : Number(r.figure?.value ?? -1));
  rows.sort((a, b) => val(b) - val(a));

  return (
    <Card
      title="13 dimensiones"
      aside={<span className="font-mono text-[0.6rem] text-lab-dim">{live ? 'ventana actual' : 'valor global'}</span>}
    >
      <ul className="space-y-1.5">
        {rows.map(({ d, figure, verdict }) => {
          if (verdict.kind === 'abstain' || !figure) {
            return (
              <li key={d.id} className="grid grid-cols-[5.5rem_1fr] items-center gap-2">
                <span className="truncate text-xs text-lab-dim">{d.label}</span>
                <Abstention missing={verdict.missing} compact />
              </li>
            );
          }
          const v = Math.round(live ? (report.windows[windowIndex]?.dims[d.id] ?? Number(verdict.value)) : Number(verdict.value));
          return (
            <li key={d.id} className="grid grid-cols-[5.5rem_1fr_2.2rem] items-center gap-2" title={provenanceTitle(figure)}>
              <span className="truncate text-xs text-lab-text">{d.label}</span>
              <span className="h-2 overflow-hidden rounded-sm bg-lab-bg">
                <span
                  className="block h-full rounded-sm transition-[width] duration-500"
                  style={{ width: `${v}%`, background: d.color, opacity: verdict.kind === 'uncalibrated' ? 0.55 : 1 }}
                />
              </span>
              <span className="text-right font-mono text-xs tabular-nums text-lab-text">{v}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[0.68rem] leading-snug text-lab-dim">
        Adaptación propia del espacio de 13 dimensiones de Cowen et al. (2020, PNAS); las categorías originales difieren.
      </p>
      {rows[0]?.figure && rows[0].verdict.kind !== 'abstain' && (
        <div className="mt-2">
          <ProvenanceChip figure={rows[0].figure} verdict={rows[0].verdict} demo={report.demo} />
        </div>
      )}
    </Card>
  );
}

function Bands() {
  const { report, judge } = useReport();
  const engine = usePlaybackEngine();
  const verdict = judge(report.series.energy);
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  const ok = verdict.kind !== 'abstain';

  useEffect(() => {
    if (!ok) return;
    return engine.onFrame((t) => {
      const b = bandsAt(report.envelope, t);
      [b.low, b.mid, b.high].forEach((v, i) => {
        const el = refs.current[i];
        if (el) el.style.transform = `scaleX(${v.toFixed(3)})`;
      });
    });
  }, [engine, report, ok]);

  const bands = [
    { label: 'Graves', hint: '< 250 Hz', color: '#ff4f6d' },
    { label: 'Medios', hint: '250 Hz – 4 kHz', color: '#ffd23f' },
    { label: 'Agudos', hint: '> 4 kHz', color: '#3fd0ff' },
  ];
  return (
    <Card title="Bandas de energía">
      {!ok ? (
        <Abstention missing={verdict.missing} />
      ) : (
        <>
          <ul className="space-y-2">
            {bands.map((b, i) => (
              <li key={b.label} className="grid grid-cols-[5.5rem_1fr] items-center gap-2">
                <span className="text-xs text-lab-text">
                  {b.label} <span className="block text-[0.6rem] text-lab-dim">{b.hint}</span>
                </span>
                <span className="h-2.5 overflow-hidden rounded-sm bg-lab-bg">
                  <span
                    ref={(el) => void (refs.current[i] = el)}
                    className="block h-full origin-left rounded-sm"
                    style={{ background: b.color, transform: 'scaleX(0)' }}
                  />
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[0.68rem] text-lab-dim">Relativas al máximo de cada banda en la pista.</p>
          <div className="mt-2">
            <ProvenanceChip figure={report.series.energy} verdict={verdict} demo={report.demo} />
          </div>
        </>
      )}
    </Card>
  );
}

export function SidePanel() {
  const { report } = useReport();
  const d = report.descriptors;
  return (
    <aside className="flex flex-col gap-4" aria-label="Panel del Neural Scan">
      <Card title="Resumen medido">
        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
          <Figure figure={d.loudness} />
          <Figure figure={d.tempo} />
          <Figure figure={d.key} />
          <Figure figure={d.climax} format={(v) => (typeof v === 'number' ? `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, '0')}` : v)} />
        </div>
      </Card>
      <Dominant />
      <DimensionBars />
      <Bands />
      <Card title="Estado de los embeddings">
        <Figure figure={report.embeddings} label="Modelo y versión" />
      </Card>
    </aside>
  );
}
