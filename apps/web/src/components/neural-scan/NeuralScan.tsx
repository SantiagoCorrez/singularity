'use client';

import { useMemo, useRef, useState } from 'react';
import { useReport } from '@/components/ReportContext';
import { buildChannels } from '@/lib/channels';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { DemoBadge } from '@/components/ui/ProvenanceChip';
import { BrainScene, type SceneStats } from './BrainScene';
import { EmotionLabels } from './EmotionLabels';
import { SidePanel } from './SidePanel';
import { TextAlternative } from './TextAlternative';
import { useReducedMotion } from './useReducedMotion';
import type { BrainScene as Scene } from './scene/createBrainScene';

export function NeuralScan() {
  const { report, judge } = useReport();
  const reducedMotion = useReducedMotion();
  const channelSet = useMemo(() => buildChannels(report, judge), [report, judge]);
  const sceneRef = useRef<Scene | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState<SceneStats | null>(null);

  return (
    <section aria-labelledby="neural-scan-title">
      <SectionHeader n={3} title="NEURAL SCAN" subtitle="Las emociones de la canción, en tiempo real mientras suena." color="#ff4fd8">
        {report.demo && <DemoBadge className="!text-xs" />}
      </SectionHeader>
      <h2 id="neural-scan-title" className="sr-only">Neural Scan</h2>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <div ref={containerRef} className="scan-bg relative overflow-hidden rounded-lg border border-lab-border">
            <div className="relative aspect-square sm:aspect-[4/3] xl:aspect-[16/11]">
              <BrainScene
                channelSet={channelSet}
                reducedMotion={reducedMotion}
                sceneRef={sceneRef}
                onReady={setReady}
                onStats={setStats}
              />
              <p className="absolute left-3 top-3 rounded border border-accent-yellow/50 bg-lab-bg/80 px-2 py-1 font-mono text-[0.62rem] tracking-wider text-accent-yellow">
                VISUALIZACIÓN ILUSTRATIVA · las zonas son una metáfora visual, no un mapa neurocientífico
              </p>
              <p className="absolute inset-x-3 bottom-2 flex flex-wrap justify-between gap-x-4 font-mono text-[0.6rem] text-lab-dim">
                <span>
                  {channelSet.mode === 'emociones'
                    ? 'Brillo de cada zona = valor de la dimensión × energía del audio'
                    : 'Emociones en abstención: el cerebro muestra descriptores medidos y calibrados'}
                </span>
                <span>
                  {reducedMotion ? 'escena estática (movimiento reducido)' : stats ? `${stats.count.toLocaleString('es-ES')} partículas · ${stats.fps} fps` : ''}
                </span>
              </p>
            </div>
            {channelSet.channels.length > 0 && (
              <EmotionLabels channelSet={channelSet} sceneRef={sceneRef} ready={ready} containerRef={containerRef} />
            )}
          </div>
          <TextAlternative channelSet={channelSet} />
        </div>
        <SidePanel />
      </div>
    </section>
  );
}
