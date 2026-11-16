'use client';

import { useReport } from '@/components/ReportContext';
import { COHERENCE_LABELS, coherenceLabel } from '@/lib/coherence';
import { Abstention } from '@/components/ui/Abstention';
import { Card } from '@/components/ui/Card';
import { Figure } from '@/components/ui/Figure';

/** Barra divergente en [-1, 1] con el cero en el centro. */
function Diverging({ value, color, label }: { value: number; color: string; label: string }) {
  const w = Math.min(50, Math.abs(value) * 50);
  return (
    <div className="grid grid-cols-[3rem_1fr_2.6rem] items-center gap-2">
      <span className="font-mono text-[0.62rem] text-lab-dim">{label}</span>
      <span className="relative h-2 rounded-sm bg-lab-bg">
        <span className="absolute inset-y-0 left-1/2 w-px bg-lab-dim/50" />
        <span className="absolute inset-y-0 rounded-sm" style={{ background: color, width: `${w}%`, left: value >= 0 ? '50%' : `${50 - w}%` }} />
      </span>
      <span className="text-right font-mono text-[0.66rem] tabular-nums text-lab-text">
        {value > 0 ? '+' : value < 0 ? '−' : ''}{Math.abs(value).toFixed(2)}
      </span>
    </div>
  );
}

/** 1.4 · Coherencia letra ↔ sonido. */
export function LyricCoherence() {
  const { report, judge } = useReport();
  const { coherence, lyrics } = report;
  const title = '1.4 · Coherencia letra ↔ sonido';

  if (!coherence || !lyrics) {
    return (
      <Card title={title}>
        <Abstention
          missing={[
            !lyrics
              ? 'esta pista no tiene letra'
              : lyrics.provenance.value === null
                ? `letra sin analizar: ${lyrics.provenance.method ?? 'analizador no disponible'}`
                : 'faltan las emociones del audio para comparar con la letra',
          ]}
        />
      </Card>
    );
  }
  const overall = judge(coherence.overall);
  const audioOk = judge(report.series.emotion).kind !== 'abstain';
  const lyricsOk = judge(lyrics.provenance).kind !== 'abstain';
  const tag = overall.kind !== 'abstain' ? COHERENCE_LABELS[coherenceLabel(Number(overall.value))] : undefined;

  return (
    <Card title={title}>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <Figure figure={coherence.overall} size="lg" color={tag?.color} />
        {tag && (
          <div>
            <div className="label-mono">Lectura</div>
            <div className="mt-1 font-mono text-sm font-semibold tracking-wider" style={{ color: tag.color }}>{tag.label}</div>
            <div className="font-mono text-[0.6rem] text-lab-dim">{tag.range}</div>
          </div>
        )}
      </div>
      <div className="mt-3">
        <Figure figure={coherence.explanation} />
      </div>

      <div className="mt-4 border-t border-lab-border pt-3">
        <div className="label-mono mb-2">Audio frente a letra, por tramo</div>
        {!audioOk || !lyricsOk ? (
          <Abstention missing={(!audioOk ? judge(report.series.emotion) : judge(lyrics.provenance)).missing} />
        ) : (
          <ul className="space-y-3">
            {report.sections.map((s) => {
              const l = lyrics.sections.find((x) => x.section_id === s.id);
              const c = coherence.sections.find((x) => x.section_id === s.id);
              if (!l || !c || s.valence === null || s.arousal === null) return null;
              const t = COHERENCE_LABELS[c.label];
              return (
                <li key={s.id}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="text-xs text-lab-text">
                      {s.label} <span className="text-lab-dim">· letra: {l.theme}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[0.66rem]" style={{ color: t.color }}>{c.score} % · {t.label}</span>
                  </div>
                  <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                    <div className="space-y-1">
                      <div className="font-mono text-[0.58rem] uppercase tracking-wider text-lab-dim">Valencia</div>
                      <Diverging value={s.valence} color="#3fd0ff" label="audio" />
                      <Diverging value={l.valence} color="#ff4fd8" label="letra" />
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-[0.58rem] uppercase tracking-wider text-lab-dim">Activación</div>
                      <Diverging value={s.arousal} color="#3fd0ff" label="audio" />
                      <Diverging value={l.arousal} color="#ff4fd8" label="letra" />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
