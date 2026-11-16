'use client';

import type { Figure as FigureT } from '@/types/report';
import { useReport } from '@/components/ReportContext';
import { Abstention } from './Abstention';
import { ProvenanceChip } from './ProvenanceChip';

export function formatValue(v: number | string): string {
  if (typeof v === 'string') return v;
  return v.toLocaleString('es-ES', { maximumFractionDigits: 1 }).replace('-', '−');
}

/** Única vía para pintar una cifra suelta: valor + procedencia, o abstención. */
export function Figure({
  figure,
  label,
  format = formatValue,
  color,
  size = 'md',
}: {
  figure: FigureT | null | undefined;
  label?: string;
  format?: (v: number | string) => string;
  color?: string;
  size?: 'md' | 'lg';
}) {
  const { judge, report } = useReport();
  const verdict = judge(figure);
  const name = label ?? figure?.label ?? 'Cifra';
  // Una frase (lectura, recomendación, lista) se lee como texto, no como una cifra grande.
  const prose = verdict.kind !== 'abstain' && typeof verdict.value === 'string' && verdict.value.length > 22;

  return (
    <div className="min-w-0">
      <div className="label-mono">{name}</div>
      {verdict.kind === 'abstain' || !figure ? (
        <div className="mt-1">
          <Abstention missing={verdict.missing} />
        </div>
      ) : (
        <>
          <div
            className={prose ? 'mt-0.5 text-sm leading-snug' : `mt-0.5 font-mono font-semibold leading-tight ${size === 'lg' ? 'text-3xl' : 'text-lg'}`}
            style={{ color: color ?? '#e9eefb' }}
          >
            {format(verdict.value)}
            {figure.unit && format === formatValue && <span className="ml-1 text-xs font-normal text-lab-dim">{figure.unit}</span>}
          </div>
          <div className="mt-1">
            <ProvenanceChip figure={figure} verdict={verdict} demo={report.demo} />
          </div>
        </>
      )}
    </div>
  );
}
