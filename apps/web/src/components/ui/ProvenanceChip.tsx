import type { Figure } from '@/types/report';
import type { Verdict } from '@/lib/provenance';

const STATUS_COLOR: Record<string, string> = {
  medido: '#39e58c',
  verificado: '#3fd0ff',
  'heurístico': '#ffd23f',
  pendiente: '#7f8db0',
  no_conectado: '#ff4f6d',
};

export function provenanceTitle(f: Figure): string {
  const c = f.calibration;
  const cal = c
    ? `Calibración: ${c.metric} ${c.score} (umbral ${c.threshold}, n=${c.n}, ${c.passed ? 'superada' : 'no superada'}) · ${c.ref} · ${c.tested_at.slice(0, 10)}`
    : 'Calibración: ausente';
  return `Método: ${f.method ?? '—'}\n${cal}`;
}

export function DemoBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`rounded-sm border border-accent-magenta/60 bg-accent-magenta/10 px-1 font-mono text-[0.6rem] font-bold tracking-[0.18em] text-accent-magenta ${className}`}
    >
      DEMO
    </span>
  );
}

export function UncalibratedBadge() {
  return (
    <span className="rounded-sm border border-accent-yellow/60 bg-accent-yellow/10 px-1 font-mono text-[0.6rem] font-bold tracking-[0.12em] text-accent-yellow">
      NO CALIBRADO
    </span>
  );
}

/** Fuente · estado · fecha. El método y la calibración van en el tooltip. */
export function ProvenanceChip({
  figure,
  verdict,
  demo,
  compact = false,
}: {
  figure: Figure;
  verdict: Verdict;
  demo: boolean;
  compact?: boolean;
}) {
  const color = STATUS_COLOR[figure.status] ?? '#7f8db0';
  const date = figure.measured_at ? figure.measured_at.slice(0, 10) : 'sin fecha';
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" title={provenanceTitle(figure)}>
      <span className="inline-flex items-center gap-1 rounded-sm border border-lab-border bg-lab-bg/60 px-1.5 py-px font-mono text-[0.6rem] text-lab-dim">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        {compact ? figure.status : `${figure.source ?? 'sin fuente'} · ${figure.status} · ${date}`}
      </span>
      {verdict.kind === 'uncalibrated' && <UncalibratedBadge />}
      {demo && <DemoBadge />}
    </span>
  );
}
