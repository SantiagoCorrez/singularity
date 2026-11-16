// Regla única del visor. Toda cifra que se pinta pasa por evaluate().
import type { Figure } from '@/types/report';

export type Verdict =
  /** Procedencia completa: se muestra. */
  | { kind: 'show'; value: number | string; missing: [] }
  /** Solo en modo desarrollo: hay valor pero le falta procedencia. Se marca "NO CALIBRADO". */
  | { kind: 'uncalibrated'; value: number | string; missing: string[] }
  /** Abstención: no se muestra ningún valor; missing dice qué faltó. */
  | { kind: 'abstain'; missing: string[] };

const VERIFIABLE = new Set(['medido', 'verificado']);
const SOURCE_RE =
  /^(audio|letra|youtube|tiktok|google_trends|panel_oyentes|agente:.+|modelo:.+)$/;

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/** Lista lo que le falta a una cifra para poder mostrarse. Vacía = procedencia válida. */
export function missingFields(f: Partial<Figure> | null | undefined): string[] {
  if (!f) return ['cifra ausente'];
  const missing: string[] = [];

  if (f.value === null || f.value === undefined || f.value === '' ||
      (typeof f.value === 'number' && !Number.isFinite(f.value))) {
    missing.push('valor ausente');
  }
  if (!f.source) missing.push('fuente ausente');
  else if (!SOURCE_RE.test(f.source)) missing.push(`fuente no reconocida ("${f.source}")`);

  if (!f.measured_at) missing.push('fecha de medición ausente');
  else if (Number.isNaN(Date.parse(f.measured_at))) missing.push('fecha de medición inválida');

  if (!f.status) missing.push('estado ausente');
  else if (!VERIFIABLE.has(f.status)) missing.push(`estado "${f.status}" no verificable`);

  const c = f.calibration;
  if (!c) missing.push('calibración ausente');
  else if (c.passed !== true) {
    missing.push(`calibración no superada (${c.metric} ${fmt(c.score)}, umbral ${fmt(c.threshold)})`);
  }
  return missing;
}

export function evaluate(
  f: Partial<Figure> | null | undefined,
  opts: { devMode?: boolean } = {},
): Verdict {
  const missing = missingFields(f);
  if (missing.length === 0) return { kind: 'show', value: f!.value as number | string, missing: [] };
  const hasValue = !missing.includes('valor ausente') && !missing.includes('cifra ausente');
  if (opts.devMode && hasValue) {
    return { kind: 'uncalibrated', value: f!.value as number | string, missing };
  }
  return { kind: 'abstain', missing };
}

/** true si la cifra puede usarse para pintar algo (mostrada o, en desarrollo, no calibrada). */
export function usable(v: Verdict): v is Exclude<Verdict, { kind: 'abstain' }> {
  return v.kind !== 'abstain';
}
