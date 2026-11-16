'use client';

import { useReport } from '@/components/ReportContext';
import { Abstention } from '@/components/ui/Abstention';
import { Card } from '@/components/ui/Card';
import { Figure } from '@/components/ui/Figure';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { DemoBadge } from '@/components/ui/ProvenanceChip';
import { QUADRANTS } from '@/lib/dimensions';
import { TribeGraph } from './TribeGraph';

const STATUS: Record<string, { label: string; color: string }> = {
  ok: { label: 'respondió', color: '#39e58c' },
  no_conectado: { label: 'no conectado', color: '#ff4f6d' },
  error: { label: 'falló', color: '#ffd23f' },
};
const th = 'border-b border-lab-border px-2 py-1 text-left font-mono text-[0.6rem] font-normal uppercase tracking-wider text-lab-dim';
const td = 'border-b border-lab-border/50 px-2 py-1.5 align-top text-xs text-lab-text';

/** 2.3 · Activación tribal, en el orden del reporte: afinidad × crecimiento. */
function TribalActivation() {
  const { report, judge } = useReport();
  const graph = judge(report.tribe_graph.provenance);
  return (
    <Card title="2.3 · Activación tribal" aside={<span className="font-mono text-[0.6rem] text-lab-dim">orden: afinidad × crecimiento</span>}>
      {report.tribes.length === 0 ? (
        <Abstention missing={graph.kind === 'abstain' ? graph.missing : ['no se encontró ninguna tribu']} />
      ) : (
        <ol className="space-y-4">
          {report.tribes.map((t, i) => (
            <li key={t.id} className="border-b border-lab-border/60 pb-4 last:border-0 last:pb-0">
              <div className="mb-2 flex items-baseline gap-2">
                <span className="font-mono text-xs text-accent-yellow">{i + 1}</span>
                <span className="text-sm font-semibold text-lab-text">{t.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 2xl:grid-cols-4">
                <Figure figure={t.affinity} />
                <Figure figure={t.size} />
                <Figure figure={t.growth_90d} format={(v) => (typeof v === 'number' ? `${v > 0 ? '+' : ''}${v.toLocaleString('es-ES')} %` : v)} />
                <Figure figure={t.emotion} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/** 2.4 · Panel de estado: qué fuente respondió, con qué latencia y de qué fecha son sus datos. */
function SwarmStatus() {
  const { report } = useReport();
  const up = report.swarm.filter((r) => r.status === 'ok').length;
  return (
    <Card title="2.4 · Estado del enjambre" aside={<span className="font-mono text-[0.6rem] text-lab-dim">{up} de {report.swarm.length} fuentes respondieron</span>}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>Agente</th><th className={th}>Fuente</th><th className={th}>Estado</th>
              <th className={th}>Latencia</th><th className={th}>Fecha de los datos</th><th className={th}>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {report.swarm.map((r, i) => (
              <tr key={i}>
                <td className={td}>{r.label}</td>
                <td className={`${td} font-mono`}>{r.tool}</td>
                <td className={`${td} whitespace-nowrap font-mono`} style={{ color: STATUS[r.status].color }}>
                  <span aria-hidden className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: STATUS[r.status].color }} />
                  {STATUS[r.status].label}
                </td>
                <td className={`${td} whitespace-nowrap font-mono tabular-nums`}>{r.latency_ms === null ? '—' : `${Math.round(r.latency_ms)} ms`}</td>
                <td className={`${td} font-mono`}>{r.data_date?.slice(0, 10) ?? '—'}</td>
                <td className={`${td} text-lab-dim`}>{r.detail}{report.demo && <DemoBadge className="ml-2" />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** 2.4 · Agentes: cada afirmación es una cifra con su fuente y su fecha. */
function Agents() {
  const { report } = useReport();
  const findings = report.agents.filter((a) => a.kind !== 'perspective');
  const views = report.agents.filter((a) => a.kind === 'perspective');
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {findings.map((a) => (
          <Card key={a.id} title={`Agente ${a.label}`}>
            <div className="space-y-3">
              {a.findings.map((f) => (
                <Figure key={f.id} figure={f} />
              ))}
            </div>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {views.map((a) => (
          <Card key={a.id} title={`Perspectiva · ${a.label}`}>
            <div className="space-y-3">
              <Figure figure={a.score} size="lg" color="#ffd23f" />
              <Figure figure={a.reading} />
              <Figure figure={a.recommendation} />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

/** 2.5 · ADN del artista: memoria de todas sus pistas. */
function ArtistDna() {
  const { report, judge } = useReport();
  const dna = report.artist_dna;
  const showEmotion = judge(dna.evolution).kind !== 'abstain';
  return (
    <Card title="2.5 · ADN del artista">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Figure figure={dna.consistency} />
        <Figure figure={dna.evolution} />
        <Figure figure={dna.recurring_tribes} />
        <Figure figure={dna.gaps} />
      </div>
      {dna.tracks.length > 0 && (
        <div className="mt-4 border-t border-lab-border pt-3">
          <div className="label-mono mb-1.5">Pistas en la memoria ({dna.tracks.length})</div>
          <ul className="space-y-1">
            {dna.tracks.map((t) => (
              <li key={t.track_id} className="flex flex-wrap items-baseline gap-x-3 text-xs text-lab-text">
                <span className="font-mono text-lab-dim">{t.analyzed_at.slice(0, 10)}</span>
                <span>{t.title}</span>
                {showEmotion && t.quadrant && (
                  <span className="font-mono text-[0.66rem]" style={{ color: QUADRANTS[t.quadrant].color }}>{QUADRANTS[t.quadrant].label}</span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[0.68rem] text-lab-dim">Orden de análisis, no de publicación. El artista se identifica por su nombre.</p>
        </div>
      )}
    </Card>
  );
}

export function TribesModule() {
  const { report } = useReport();
  return (
    <section aria-labelledby="tribes-title">
      <SectionHeader n={2} title="TRIBUS AGÉNTICAS" subtitle="A qué comunidades de oyentes le habla la canción, y qué hacer con eso." color="#ffd23f">
        {report.demo && <DemoBadge className="!text-xs" />}
      </SectionHeader>
      <h2 id="tribes-title" className="sr-only">Tribus agénticas</h2>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <TribeGraph />
          <TribalActivation />
        </div>
        <SwarmStatus />
        <Agents />
        <ArtistDna />
      </div>
    </section>
  );
}
