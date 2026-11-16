'use client';

import { useReport } from '@/components/ReportContext';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { DemoBadge } from '@/components/ui/ProvenanceChip';
import { DimensionBars, Dominant } from '@/components/neural-scan/SidePanel';
import { DimensionRadar } from './DimensionRadar';
import { EmotionTrajectory } from './EmotionTrajectory';
import { LyricCoherence } from './LyricCoherence';
import { RussellMap } from './RussellMap';

export function EmotionModule() {
  const { report } = useReport();
  return (
    <section aria-labelledby="emotion-title">
      <SectionHeader n={1} title="EMOCIÓN Y TRAYECTORIA" subtitle="Qué emoción expresa la canción y cómo cambia segundo a segundo.">
        {report.demo && <DemoBadge className="!text-xs" />}
      </SectionHeader>
      <h2 id="emotion-title" className="sr-only">Emoción y trayectoria</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <RussellMap />
        <div className="flex flex-col gap-4">
          <Dominant />
          <DimensionRadar />
        </div>
        <DimensionBars />
        <EmotionTrajectory />
        <div className="lg:col-span-2">
          <LyricCoherence />
        </div>
      </div>
    </section>
  );
}
