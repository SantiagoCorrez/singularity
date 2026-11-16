'use client';

import { useReport } from '@/components/ReportContext';
import { DIMENSION_BY_ID, QUADRANTS } from '@/lib/dimensions';
import { usePlaybackEngine, usePlaybackState } from '@/lib/playback/usePlayback';
import { Abstention } from '@/components/ui/Abstention';
import { Card } from '@/components/ui/Card';
import { DemoBadge, ProvenanceChip, UncalibratedBadge } from '@/components/ui/ProvenanceChip';
import { fmtTime } from '@/components/player/Timeline';
import type { Quadrant } from '@/types/report';

const qLabel = (q: string) => QUADRANTS[q as Quadrant]?.label ?? q;

/** 1.3 · Trayectoria emocional: dimensión dominante por tramo y giros emocionales. */
export function EmotionTrajectory() {
  const { report, judge } = useReport();
  const engine = usePlaybackEngine();
  const { sectionIndex } = usePlaybackState();
  const structure = judge(report.series.structure);
  const emotion = judge(report.series.emotion);
  const dur = report.track.duration_s;
  const hasEmotion = emotion.kind !== 'abstain';

  if (structure.kind === 'abstain') {
    return (
      <Card title="1.3 · Trayectoria emocional">
        <Abstention missing={structure.missing} />
      </Card>
    );
  }

  return (
    <Card title="1.3 · Trayectoria emocional">
      <ol className="flex gap-1" aria-label="Tramos de la canción">
        {report.sections.map((s, i) => {
          const dom = hasEmotion && s.dominant ? DIMENSION_BY_ID[s.dominant] : undefined;
          const q = hasEmotion && s.quadrant ? QUADRANTS[s.quadrant] : undefined;
          const color = dom?.color ?? '#7f8db0';
          return (
            <li key={s.id} style={{ flexGrow: s.t1 - s.t0, flexBasis: 0 }} className="min-w-0">
              <button
                type="button"
                onClick={() => engine.seek(s.t0)}
                aria-current={i === sectionIndex ? 'true' : undefined}
                title={`${s.label} · ${fmtTime(s.t0)}–${fmtTime(s.t1)}`}
                className={`block h-full w-full rounded border px-1.5 py-2 text-left transition-colors ${i === sectionIndex ? 'border-white/70' : 'border-lab-border'}`}
                style={{ background: `${color}${dom ? '26' : '14'}` }}
              >
                <span className="block truncate font-mono text-[0.6rem] uppercase tracking-wider text-lab-dim">{s.label}</span>
                <span className="block truncate text-xs font-semibold" style={{ color }}>
                  {dom ? dom.label : '—'}
                </span>
                {q && <span className="mt-1 block h-1 rounded-sm" style={{ background: q.color }} title={q.label} />}
                {!hasEmotion && (
                  <span className="mt-1 block h-1 rounded-sm bg-accent-cyan" style={{ opacity: 0.2 + 0.8 * s.energy }} title="energía relativa" />
                )}
                <span className="mt-1 block font-mono text-[0.58rem] text-lab-dim">{fmtTime(s.t0)}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <ProvenanceChip figure={report.series.structure} verdict={structure} demo={report.demo} />
        <span className="text-[0.68rem] text-lab-dim">Los límites de tramo se miden; los nombres (intro, coro…) salen de reglas y son orientativos.</span>
      </div>

      <div className="mt-4 border-t border-lab-border pt-3">
        <div className="label-mono mb-1.5">Giros emocionales</div>
        {!hasEmotion ? (
          <Abstention missing={emotion.missing} />
        ) : report.turns.length === 0 ? (
          <p className="text-xs text-lab-dim">Sin cambios de cuadrante ni saltos mayores de 0,4 entre tramos.</p>
        ) : (
          <>
            <ul className="space-y-1">
              {report.turns.map((t, i) => (
                <li key={i}>
                  <button type="button" onClick={() => engine.seek(t.t)} className="flex w-full items-baseline gap-2 text-left text-xs hover:text-white">
                    <span className="w-9 shrink-0 font-mono tabular-nums text-accent-cyan">{fmtTime(t.t)}</span>
                    {t.kind === 'quadrant' ? (
                      <span className="text-lab-text">
                        Cambio de cuadrante: <b style={{ color: QUADRANTS[t.from as Quadrant]?.color }}>{qLabel(t.from)}</b> →{' '}
                        <b style={{ color: QUADRANTS[t.to as Quadrant]?.color }}>{qLabel(t.to)}</b>
                      </span>
                    ) : (
                      <span className="text-lab-text">
                        Salto de {t.delta !== null && t.delta > 0 ? '+' : '−'}
                        {Math.abs(t.delta ?? 0).toFixed(2).replace('.', ',')} en {t.kind === 'valence' ? 'valencia' : 'activación'}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center gap-1.5">
              {emotion.kind === 'uncalibrated' && <UncalibratedBadge />}
              {report.demo && <DemoBadge />}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
