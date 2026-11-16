'use client';

import { useMemo, useState } from 'react';
import { useReport } from '@/components/ReportContext';
import { QUADRANTS } from '@/lib/dimensions';
import { Abstention } from '@/components/ui/Abstention';
import { Card } from '@/components/ui/Card';
import { ProvenanceChip } from '@/components/ui/ProvenanceChip';
import type { TribeEdge, TribeNode } from '@/types/report';

const W = 680;
const H = 440;
const KIND_LABEL: Record<TribeNode['kind'], string> = {
  song: 'Canción', tribe: 'Tribu', playlist: 'Playlist', curator: 'Curador', artist: 'Artista vecino',
};

/** Maqueta sin datos: la misma forma de grafo, en gris y sin etiquetas. */
const MOCK_NODES: TribeNode[] = [
  { id: 'song', kind: 'song', label: '', reach: null, quadrant: null, source: null, measured_at: null },
  ...Array.from({ length: 4 }, (_, t) => [
    { id: `t${t}`, kind: 'tribe' as const, label: '', reach: 0.5 + 0.12 * t, quadrant: null, source: null, measured_at: null },
    ...Array.from({ length: 3 }, (_, m) => ({
      id: `t${t}m${m}`, kind: 'playlist' as const, label: '', reach: 0.15 + 0.05 * m, quadrant: null, source: null, measured_at: null,
    })),
  ]).flat(),
];
const MOCK_EDGES: TribeEdge[] = MOCK_NODES.filter((n) => n.id !== 'song').map((n) => ({
  source: n.kind === 'tribe' ? 'song' : n.id.slice(0, 2), target: n.id, similarity: 0.7,
}));

const radius = (n: TribeNode) => (n.kind === 'song' ? 13 : n.kind === 'tribe' ? 12 + 14 * (n.reach ?? 0) : 4 + 9 * (n.reach ?? 0));

/** Disposición por fuerzas, determinista: repulsión entre nodos, muelles en las aristas y la canción fija en el centro. */
function layout(nodes: TribeNode[], edges: TribeEdge[]): Record<string, { x: number; y: number }> {
  const pos = nodes.map((n, i) => {
    const a = (i / Math.max(1, nodes.length)) * Math.PI * 2;
    const r = n.kind === 'song' ? 0 : n.kind === 'tribe' ? 110 : 190;
    return { x: W / 2 + Math.cos(a) * r, y: H / 2 + Math.sin(a) * r * 0.7, vx: 0, vy: 0 };
  });
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  for (let step = 0; step < 320; step++) {
    const cool = 1 - step / 320;
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const dx = pos[i].x - pos[j].x;
        const dy = pos[i].y - pos[j].y;
        const d2 = Math.max(64, dx * dx + dy * dy);
        const f = 2600 / d2;
        const d = Math.sqrt(d2);
        pos[i].vx += (dx / d) * f; pos[i].vy += (dy / d) * f;
        pos[j].vx -= (dx / d) * f; pos[j].vy -= (dy / d) * f;
      }
    }
    for (const e of edges) {
      const a = index.get(e.source);
      const b = index.get(e.target);
      if (a === undefined || b === undefined) continue;
      const rest = nodes[a].kind === 'song' ? 90 + 120 * (1 - e.similarity) : 46 + 50 * (1 - e.similarity);
      const dx = pos[b].x - pos[a].x;
      const dy = pos[b].y - pos[a].y;
      const d = Math.max(1, Math.hypot(dx, dy));
      const f = (d - rest) * 0.06;
      pos[a].vx += (dx / d) * f; pos[a].vy += (dy / d) * f;
      pos[b].vx -= (dx / d) * f; pos[b].vy -= (dy / d) * f;
    }
    pos.forEach((p, i) => {
      if (nodes[i].kind === 'song') {
        p.x = W / 2; p.y = H / 2;
      } else {
        p.x = Math.min(W - 30, Math.max(30, p.x + p.vx * cool));
        p.y = Math.min(H - 26, Math.max(26, p.y + p.vy * cool * 0.8));
      }
      p.vx = 0; p.vy = 0;
    });
  }
  // Redondeo fijo para que el servidor y el navegador pinten lo mismo.
  return Object.fromEntries(nodes.map((n, i) => [n.id, { x: Math.round(pos[i].x * 10) / 10, y: Math.round(pos[i].y * 10) / 10 }]));
}

/** 2.2 · Red agéntica: grafo de tribus, playlists, curadores y artistas vecinos alrededor de la canción. */
export function TribeGraph() {
  const { report, judge } = useReport();
  const graph = report.tribe_graph;
  const verdict = judge(graph.provenance);
  const live = verdict.kind !== 'abstain' && graph.nodes.length > 1;
  const nodes = live ? graph.nodes : MOCK_NODES;
  const edges = live ? graph.edges : MOCK_EDGES;
  const pos = useMemo(() => layout(nodes, edges), [nodes, edges]);
  const [active, setActive] = useState<TribeNode | null>(null);
  const color = (n: TribeNode) => (!live ? '#5b6787' : n.kind === 'song' ? '#ffffff' : n.quadrant ? QUADRANTS[n.quadrant].color : '#7f8db0');

  return (
    <Card title="2.2 · Red agéntica">
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={live ? 'Grafo de tribus alrededor de la canción' : 'Vista previa del grafo, sin datos'}>
          {edges.map((e) => {
            const a = pos[e.source];
            const b = pos[e.target];
            if (!a || !b) return null;
            return <line key={`${e.source}-${e.target}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={live ? '#3fd0ff' : '#5b6787'} strokeOpacity={live ? 0.15 + 0.5 * e.similarity : 0.3} strokeWidth={live ? 0.6 + 1.6 * e.similarity : 1} />;
          })}
          {nodes.map((n) => {
            const p = pos[n.id];
            const r = radius(n);
            return (
              <g
                key={n.id}
                tabIndex={live ? 0 : undefined}
                onMouseEnter={() => live && setActive(n)}
                onFocus={() => live && setActive(n)}
                className={live ? 'cursor-pointer outline-none' : undefined}
              >
                {n.kind === 'song' && <circle cx={p.x} cy={p.y} r={r + 8} fill="none" stroke={color(n)} strokeOpacity={0.35} />}
                <circle cx={p.x} cy={p.y} r={r} fill={color(n)} fillOpacity={n.kind === 'tribe' ? 0.3 : live ? 0.85 : 0.5} stroke={color(n)} strokeWidth={active?.id === n.id ? 2.5 : 1} />
                {live && (n.kind === 'tribe' || n.kind === 'song') && (
                  <text x={p.x} y={p.y + r + 12} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="#d7def0">
                    {n.label.length > 26 ? `${n.label.slice(0, 25)}…` : n.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {!live && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
            <span className="rounded border border-lab-dim/60 bg-lab-bg/85 px-3 py-1.5 font-mono text-sm font-semibold tracking-[0.3em] text-lab-text">
              VISTA PREVIA SIN DATOS
            </span>
            <div className="max-w-md">
              <Abstention missing={verdict.kind === 'abstain' ? verdict.missing : ['el grafo no tiene nodos']} />
            </div>
          </div>
        )}
      </div>

      {live && (
        <>
          <p className="mt-2 min-h-10 rounded border border-lab-border bg-lab-bg/60 px-3 py-2 font-mono text-[0.7rem] text-lab-text" aria-live="polite">
            {active ? (
              <>
                <b>{active.label}</b> · {KIND_LABEL[active.kind]}
                {active.quadrant && <> · <span style={{ color: QUADRANTS[active.quadrant].color }}>{QUADRANTS[active.quadrant].label}</span></>}
                <span className="text-lab-dim"> · fuente: {active.source ?? 'sin fuente'} · fecha: {active.measured_at?.slice(0, 10) ?? 'sin fecha'}</span>
              </>
            ) : (
              <span className="text-lab-dim">Pasa el cursor por un nodo para ver su fuente y su fecha.</span>
            )}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[0.62rem] text-lab-dim">
            <span>Tamaño = alcance · color = cuadrante dominante · grosor de la línea = similitud</span>
            <ProvenanceChip figure={graph.provenance} verdict={verdict} demo={report.demo} />
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer font-mono text-[0.66rem] tracking-wider text-lab-dim">VER COMO TABLA</summary>
            <table className="mt-2 w-full border-collapse font-mono text-[0.68rem] text-lab-text">
              <thead>
                <tr className="text-left text-lab-dim">
                  <th className="py-0.5 font-normal">Nodo</th><th className="font-normal">Tipo</th><th className="font-normal">Cuadrante</th><th className="font-normal">Fuente</th><th className="font-normal">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {graph.nodes.map((n) => (
                  <tr key={n.id} className="border-t border-lab-border/60">
                    <td className="py-0.5">{n.label}</td><td>{KIND_LABEL[n.kind]}</td>
                    <td>{n.quadrant ? QUADRANTS[n.quadrant].label : '—'}</td><td>{n.source ?? '—'}</td><td>{n.measured_at?.slice(0, 10) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </Card>
  );
}
