'use client';

import { useReport } from '@/components/ReportContext';
import { DIMENSION_BY_ID, DIMENSIONS } from '@/lib/dimensions';
import { usePlaybackState } from '@/lib/playback/usePlayback';
import { Abstention } from '@/components/ui/Abstention';
import { Card } from '@/components/ui/Card';

const S = 340;
const C = S / 2;
const R = 112;
// Redondeo fijo: el servidor y el navegador no dan los mismos decimales en seno y coseno.
const rx = (angle: number, r: number) => Math.round((C + Math.cos(angle) * r) * 10) / 10;
const ry = (angle: number, r: number) => Math.round((C + Math.sin(angle) * r) * 10) / 10;

/** 1.2 · Radar de 13 dimensiones. Cada eje se abstiene por separado. */
export function DimensionRadar() {
  const { report, judge } = useReport();
  const { windowIndex, started } = usePlaybackState();
  const live = started && judge(report.series.emotion).kind !== 'abstain';

  const axes = DIMENSIONS.map((d, i) => {
    const figure = report.dimensions.find((f) => f.id === d.id);
    const verdict = judge(figure);
    const angle = (i / DIMENSIONS.length) * Math.PI * 2 - Math.PI / 2;
    const ok = verdict.kind !== 'abstain';
    const global = ok ? Number(verdict.value) : 0;
    return { d, ok, angle, global, now: ok && live ? (report.windows[windowIndex]?.dims[d.id] ?? global) : global, verdict };
  });
  const usableCount = axes.filter((a) => a.ok).length;
  const at = (angle: number, r: number) => `${rx(angle, r)},${ry(angle, r)}`;
  const poly = (key: 'global' | 'now') => axes.map((a) => at(a.angle, (a[key] / 100) * R)).join(' ');
  const dominant = judge(report.dominant);
  const color = dominant.kind !== 'abstain' ? (DIMENSION_BY_ID[String(dominant.value)]?.color ?? '#3fd0ff') : '#3fd0ff';

  return (
    <Card
      title="1.2 · Radar de 13 dimensiones"
      aside={usableCount > 0 ? <span className="font-mono text-[0.6rem] text-lab-dim">{live ? 'relleno: global · línea: ventana actual' : 'valor global'}</span> : undefined}
    >
      <div className="relative mx-auto max-w-[26rem]">
        <svg viewBox={`0 0 ${S} ${S}`} className="w-full" role="img" aria-label="Radar de las 13 dimensiones emocionales">
          {[0.25, 0.5, 0.75, 1].map((k) => (
            <polygon key={k} points={axes.map((a) => at(a.angle, R * k)).join(' ')} fill="none" stroke="#17213a" />
          ))}
          {axes.map((a) => (
            <g key={a.d.id}>
              <line
                x1={C} y1={C}
                x2={rx(a.angle, R)} y2={ry(a.angle, R)}
                stroke={a.ok ? '#2a3860' : '#7f8db0'} strokeDasharray={a.ok ? undefined : '2 4'} strokeOpacity={a.ok ? 1 : 0.5}
              />
              <text
                x={rx(a.angle, R + 14)}
                y={ry(a.angle, R + 14) + 3}
                textAnchor={Math.abs(Math.cos(a.angle)) < 0.2 ? 'middle' : Math.cos(a.angle) > 0 ? 'start' : 'end'}
                fill={a.ok ? a.d.color : '#7f8db0'}
                fontSize="9.5"
                fontFamily="var(--font-mono)"
              >
                {a.d.label}{a.ok ? '' : ' —'}
              </text>
            </g>
          ))}
          {usableCount >= 3 && (
            <>
              <polygon points={poly('global')} fill={color} fillOpacity={0.22} stroke={color} strokeWidth={1.5} />
              {live && <polygon points={poly('now')} fill="none" stroke="#fff" strokeWidth={1.2} strokeDasharray="3 3" />}
              {axes.filter((a) => a.ok).map((a) => (
                <circle key={a.d.id} cx={rx(a.angle, (a.global / 100) * R)} cy={ry(a.angle, (a.global / 100) * R)} r={2.6} fill={a.d.color} />
              ))}
            </>
          )}
        </svg>
        {usableCount === 0 && (
          <div className="absolute inset-x-6 top-1/2 -translate-y-1/2">
            <Abstention missing={axes[0].verdict.missing} />
          </div>
        )}
      </div>
      <p className="mt-1 text-[0.7rem] leading-snug text-lab-dim">
        Adaptación propia del espacio de 13 dimensiones de Cowen et al. (2020, PNAS); las categorías originales difieren.
        {usableCount > 0 && usableCount < DIMENSIONS.length && ` ${DIMENSIONS.length - usableCount} dimensiones en abstención (eje punteado).`}
      </p>
    </Card>
  );
}
