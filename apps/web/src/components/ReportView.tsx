'use client';

import Link from 'next/link';
import type { Report } from '@/types/report';
import { PlaybackProvider } from '@/lib/playback/usePlayback';
import { ReportProvider, useReport } from './ReportContext';
import { EmotionModule } from './emotion/EmotionModule';
import { NeuralScan } from './neural-scan/NeuralScan';
import { Player } from './player/Player';
import { TribesModule } from './tribes/TribesModule';

const VARIANTS = [
  { id: 'demo', label: 'Demo · emociones calibradas' },
  { id: 'abstention', label: 'Demo · emociones en abstención' },
];

function Header({ id }: { id: string }) {
  const { report, devMode, setDevMode } = useReport();
  return (
    <header className="mb-6">
      {report.demo && (
        <div className="mb-4 rounded border border-accent-magenta/50 bg-accent-magenta/10 px-3 py-2 font-mono text-xs text-accent-magenta" role="status">
          <strong className="tracking-[0.2em]">DEMO</strong> · Todas las cifras de esta página son simuladas, incluidas sus
          calibraciones. No describen ninguna canción real.
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-[0.4em] text-accent-cyan">SINGULARITY</p>
          <h1 className="mt-1 text-2xl font-semibold text-lab-text">{report.track.title}</h1>
          <p className="text-sm text-lab-dim">{report.track.artist}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <nav className="flex overflow-hidden rounded border border-lab-border font-mono text-[0.68rem]" aria-label="Reportes">
            {VARIANTS.map((v) => (
              <Link
                key={v.id}
                href={`/report/${v.id}`}
                aria-current={v.id === id ? 'page' : undefined}
                className={`px-3 py-1.5 ${v.id === id ? 'bg-accent-cyan/15 text-accent-cyan' : 'text-lab-dim hover:text-lab-text'}`}
              >
                {v.label}
              </Link>
            ))}
            <Link href="/upload" className="border-l border-lab-border px-3 py-1.5 text-accent-green hover:bg-accent-green/10">
              Subir un WAV
            </Link>
          </nav>
          <label className="flex cursor-pointer items-center gap-2 font-mono text-[0.68rem] text-lab-dim">
            <input type="checkbox" checked={devMode} onChange={(e) => setDevMode(e.target.checked)} className="accent-[#ffd23f]" />
            Modo desarrollo (muestra lo no calibrado)
          </label>
        </div>
      </div>
    </header>
  );
}

export function ReportView({ report, id }: { report: Report; id: string }) {
  return (
    <ReportProvider report={report}>
      <PlaybackProvider report={report}>
        <main className="mx-auto max-w-[88rem] px-4 pb-44 pt-6 sm:px-6">
          <Header id={id} />
          <div className="flex flex-col gap-12">
            <EmotionModule />
            <TribesModule />
            <NeuralScan />
          </div>
        </main>
        {/* Un solo reproductor, siempre a mano: todas las vistas leen su reloj. */}
        <div className="fixed inset-x-0 bottom-0 z-40 px-2 pb-2 sm:px-6">
          <div className="mx-auto max-w-[88rem]">
            <Player />
          </div>
        </div>
      </PlaybackProvider>
    </ReportProvider>
  );
}
