'use client';

import { useReport } from '@/components/ReportContext';
import type { ChannelSet } from '@/lib/channels';
import { DIMENSION_BY_ID, QUADRANTS } from '@/lib/dimensions';
import { fmtTime } from '@/components/player/Timeline';

const th = 'border-b border-lab-border px-2 py-1 text-left font-mono text-[0.62rem] uppercase tracking-wider text-lab-dim';
const td = 'border-b border-lab-border/60 px-2 py-1 text-xs text-lab-text';

/** Alternativa en tabla a la escena 3D y a la línea de tiempo. Aplica la misma regla de abstención. */
export function TextAlternative({ channelSet }: { channelSet: ChannelSet }) {
  const { report, judge } = useReport();
  const emotion = judge(report.series.emotion);
  const state = (kind: string) => (kind === 'uncalibrated' ? 'NO CALIBRADO' : 'válida');

  return (
    <details className="rounded-lg border border-lab-border bg-lab-card p-4">
      <summary className="cursor-pointer font-mono text-xs tracking-[0.16em] text-lab-text">
        VER LA ESCENA COMO TABLA
      </summary>

      <table className="mt-3 w-full border-collapse">
        <caption className="mb-1 text-left text-xs text-lab-dim">
          {channelSet.mode === 'emociones'
            ? 'Lo que muestra el cerebro: las dimensiones emocionales más altas (valor global).'
            : 'Lo que muestra el cerebro: descriptores medidos, porque las dimensiones emocionales están en abstención.'}
        </caption>
        <thead>
          <tr>
            <th className={th}>Etiqueta</th>
            <th className={th}>Valor</th>
            <th className={th}>Fuente</th>
            <th className={th}>Estado</th>
            <th className={th}>Fecha</th>
            <th className={th}>Procedencia</th>
          </tr>
        </thead>
        <tbody>
          {channelSet.channels.map((c) => (
            <tr key={c.key}>
              <td className={td}>{c.label}</td>
              <td className={`${td} font-mono`}>{c.text(0, false)}</td>
              <td className={`${td} font-mono`}>{c.figure.source}</td>
              <td className={`${td} font-mono`}>{c.figure.status}</td>
              <td className={`${td} font-mono`}>{c.figure.measured_at?.slice(0, 10)}</td>
              <td className={`${td} font-mono`}>{state(c.verdict.kind)}{report.demo ? ' · DEMO' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="mt-5 w-full border-collapse">
        <caption className="mb-1 text-left text-xs text-lab-dim">Tramos de la pista.</caption>
        <thead>
          <tr>
            <th className={th}>Tramo</th>
            <th className={th}>Inicio</th>
            <th className={th}>Fin</th>
            <th className={th}>Cuadrante</th>
            <th className={th}>Dimensión dominante</th>
          </tr>
        </thead>
        <tbody>
          {report.sections.map((s) => (
            <tr key={s.id}>
              <td className={td}>{s.label}</td>
              <td className={`${td} font-mono`}>{fmtTime(s.t0)}</td>
              <td className={`${td} font-mono`}>{fmtTime(s.t1)}</td>
              <td className={`${td} font-mono`}>
                {emotion.kind === 'abstain' || !s.quadrant ? 'ABSTENCIÓN' : QUADRANTS[s.quadrant].label}
              </td>
              <td className={td}>
                {emotion.kind === 'abstain' ? 'ABSTENCIÓN' : (DIMENSION_BY_ID[s.dominant ?? '']?.label ?? s.dominant ?? '—')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {emotion.kind === 'abstain' && (
        <p className="mt-2 font-mono text-[0.66rem] text-lab-dim">Motivo de la abstención: {emotion.missing.join(' · ')}</p>
      )}
    </details>
  );
}
