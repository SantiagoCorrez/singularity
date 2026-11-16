'use client';

import { useEffect, useRef } from 'react';
import { useReport } from '@/components/ReportContext';
import { QUADRANTS, quadrantOf } from '@/lib/dimensions';
import { sampleWindows } from '@/lib/playback/energy';
import { usePlaybackEngine } from '@/lib/playback/usePlayback';
import { Abstention } from '@/components/ui/Abstention';
import { Card } from '@/components/ui/Card';
import { Figure } from '@/components/ui/Figure';
import { fmtTime } from '@/components/player/Timeline';

const S = 320;
const C = S / 2;
const R = 128;
const px = (v: number) => C + v * R;
const py = (a: number) => C - a * R;
const signed = (v: number | string) => (typeof v === 'number' ? `${v > 0 ? '+' : ''}${v.toFixed(2).replace('-', '−')}` : v);

/** 1.1 · Mapa de Russell: punto global, trayectoria por ventanas y punto sincronizado con el reproductor. */
export function RussellMap() {
  const { report, judge } = useReport();
  const engine = usePlaybackEngine();
  const dotRef = useRef<SVGCircleElement>(null);

  const vV = judge(report.russell.valence);
  const vA = judge(report.russell.arousal);
  const series = judge(report.series.emotion);
  const hasGlobal = vV.kind !== 'abstain' && vA.kind !== 'abstain';
  const hasSeries = series.kind !== 'abstain';
  const pts = hasSeries
    ? report.windows.filter((w) => w.valence !== null && w.arousal !== null).map((w) => ({ t: (w.t0 + w.t1) / 2, v: w.valence!, a: w.arousal! }))
    : [];
  const gv = hasGlobal ? Number(vV.value) : 0;
  const ga = hasGlobal ? Number(vA.value) : 0;
  const gq = QUADRANTS[quadrantOf(gv, ga)];

  useEffect(() => {
    if (!hasSeries) return;
    return engine.onFrame((t) => {
      const dot = dotRef.current;
      if (!dot) return;
      dot.setAttribute('cx', px(sampleWindows(report.windows, t, (w) => w.valence ?? 0)).toFixed(1));
      dot.setAttribute('cy', py(sampleWindows(report.windows, t, (w) => w.arousal ?? 0)).toFixed(1));
    });
  }, [engine, report, hasSeries]);

  const quads = [
    { q: 'DEFIANCE', x: C - R, y: C - R },
    { q: 'FIESTA', x: C, y: C - R },
    { q: 'NOSTALGICA', x: C - R, y: C },
    { q: 'CHILL', x: C, y: C },
  ] as const;

  return (
    <Card title="1.1 · Mapa de Russell">
      <div className="relative mx-auto max-w-[26rem]">
        <svg viewBox={`0 0 ${S} ${S}`} className="w-full" role="img" aria-label="Mapa de valencia y activación">
          <defs>
            <radialGradient id="russell-halo">
              <stop offset="0%" stopColor={gq.color} stopOpacity="0.55" />
              <stop offset="100%" stopColor={gq.color} stopOpacity="0" />
            </radialGradient>
          </defs>
          {quads.map(({ q, x, y }) => (
            <g key={q} opacity={hasGlobal || hasSeries ? 1 : 0.35}>
              <rect x={x} y={y} width={R} height={R} fill={QUADRANTS[q].color} fillOpacity={0.07} />
              <text
                x={x + (x < C ? 8 : R - 8)}
                y={y + (y < C ? 16 : R - 8)}
                textAnchor={x < C ? 'start' : 'end'}
                fill={QUADRANTS[q].color}
                fontSize="10"
                fontFamily="var(--font-mono)"
                letterSpacing="1.5"
              >
                {QUADRANTS[q].label}
              </text>
            </g>
          ))}
          <rect x={C - R} y={C - R} width={2 * R} height={2 * R} fill="none" stroke="#17213a" />
          <line x1={C - R} y1={C} x2={C + R} y2={C} stroke="#2a3860" />
          <line x1={C} y1={C - R} x2={C} y2={C + R} stroke="#2a3860" />
          <g fill="#7f8db0" fontSize="9" fontFamily="var(--font-mono)">
            <text x={C - R} y={S - 6}>oscuro</text>
            <text x={C} y={S - 6} textAnchor="middle">VALENCIA</text>
            <text x={C + R} y={S - 6} textAnchor="end">brillante</text>
            <text x={10} y={C} textAnchor="middle" transform={`rotate(-90 10 ${C})`}>ACTIVACIÓN</text>
            <text x={10} y={C + R} transform={`rotate(-90 10 ${C + R})`}>calmado</text>
            <text x={10} y={C - R} textAnchor="end" transform={`rotate(-90 10 ${C - R})`}>explosivo</text>
          </g>

          {pts.slice(1).map((p, i) => (
            <line
              key={i}
              x1={px(pts[i].v)} y1={py(pts[i].a)} x2={px(p.v)} y2={py(p.a)}
              stroke="#e9eefb" strokeWidth={1.4} strokeLinecap="round"
              strokeOpacity={0.12 + 0.78 * ((i + 1) / (pts.length - 1))}
            />
          ))}
          {hasGlobal && (
            <>
              <circle cx={px(gv)} cy={py(ga)} r={30} fill="url(#russell-halo)" />
              <circle cx={px(gv)} cy={py(ga)} r={6} fill={gq.color} stroke="#060912" strokeWidth={1.5} />
            </>
          )}
          {hasSeries && pts.length > 0 && (
            <circle ref={dotRef} cx={px(pts[0].v)} cy={py(pts[0].a)} r={4.5} fill="#fff" stroke="#3fd0ff" strokeWidth={2} />
          )}
        </svg>
        {!hasGlobal && !hasSeries && (
          <div className="absolute inset-x-6 top-1/2 -translate-y-1/2">
            <Abstention missing={vV.missing} />
          </div>
        )}
      </div>

      <p className="mt-1 text-[0.7rem] text-lab-dim">
        Punto de color: valor global (media ponderada por energía). Línea: trayectoria por ventanas de 5 s, más opaca
        hacia el final. Punto blanco: instante que suena.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Figure figure={report.russell.valence} format={signed} />
        <Figure figure={report.russell.arousal} format={signed} />
      </div>

      {hasSeries && (
        <details className="mt-3">
          <summary className="cursor-pointer font-mono text-[0.66rem] tracking-wider text-lab-dim">VER COMO TABLA</summary>
          <table className="mt-2 w-full border-collapse font-mono text-[0.68rem] text-lab-text">
            <thead>
              <tr className="text-left text-lab-dim">
                <th className="py-0.5 font-normal">Instante</th>
                <th className="py-0.5 font-normal">Valencia</th>
                <th className="py-0.5 font-normal">Activación</th>
                <th className="py-0.5 font-normal">Cuadrante</th>
              </tr>
            </thead>
            <tbody>
              {pts.map((p) => (
                <tr key={p.t} className="border-t border-lab-border/60">
                  <td className="py-0.5">{fmtTime(p.t)}</td>
                  <td>{signed(p.v)}</td>
                  <td>{signed(p.a)}</td>
                  <td>{QUADRANTS[quadrantOf(p.v, p.a)].label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </Card>
  );
}
