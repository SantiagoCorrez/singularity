// Coherencia letra ↔ sonido = 1 − distancia normalizada entre el vector del audio y el de la letra.
// La distancia combina, a partes iguales:
//   · la distancia euclídea en el plano valencia × activación, dividida por su máximo (2·√2);
//   · 1 − similitud coseno entre los perfiles de 13 dimensiones.
// El backend debe usar exactamente la misma definición cuando calcule la coherencia real.

export type EmotionVector = { valence: number; arousal: number; dims: Record<string, number> };
export type CoherenceLabel = 'COHERENTE' | 'TENSION_CREATIVA' | 'CONTRASTE_DELIBERADO';

export const COHERENCE_LABELS: Record<CoherenceLabel, { label: string; color: string; range: string }> = {
  COHERENTE: { label: 'COHERENTE', color: '#39e58c', range: '≥ 75 %' },
  TENSION_CREATIVA: { label: 'TENSIÓN CREATIVA', color: '#ffd23f', range: '50–75 %' },
  CONTRASTE_DELIBERADO: { label: 'CONTRASTE DELIBERADO', color: '#ff4fd8', range: '< 50 %' },
};

/** Coherencia en porcentaje, 0–100. */
export function coherence(audio: EmotionVector, lyric: EmotionVector): number {
  const dVA = Math.hypot(audio.valence - lyric.valence, audio.arousal - lyric.arousal) / (2 * Math.SQRT2);

  const keys = Object.keys(audio.dims).filter((k) => k in lyric.dims);
  let dot = 0;
  let na = 0;
  let nl = 0;
  for (const k of keys) {
    dot += audio.dims[k] * lyric.dims[k];
    na += audio.dims[k] ** 2;
    nl += lyric.dims[k] ** 2;
  }
  // Sin dimensiones comparables, solo cuenta el plano valencia × activación.
  const d = na > 0 && nl > 0 ? 0.5 * dVA + 0.5 * (1 - dot / Math.sqrt(na * nl)) : dVA;
  return Math.round(Math.max(0, Math.min(1, 1 - d)) * 100);
}

export function coherenceLabel(score: number): CoherenceLabel {
  if (score >= 75) return 'COHERENTE';
  if (score >= 50) return 'TENSION_CREATIVA';
  return 'CONTRASTE_DELIBERADO';
}

export type Turn = { t: number; kind: 'quadrant' | 'valence' | 'arousal'; from: string; to: string; delta: number | null };

/** Giros entre tramos consecutivos: cambio de cuadrante o salto > 0,4 en valencia o activación. */
export function detectTurns(
  sections: { t0: number; valence: number | null; arousal: number | null; quadrant: string | null }[],
): Turn[] {
  const turns: Turn[] = [];
  for (let i = 1; i < sections.length; i++) {
    const a = sections[i - 1];
    const b = sections[i];
    if (a.valence === null || b.valence === null || a.arousal === null || b.arousal === null) continue;
    if (a.quadrant && b.quadrant && a.quadrant !== b.quadrant) {
      turns.push({ t: b.t0, kind: 'quadrant', from: a.quadrant, to: b.quadrant, delta: null });
    }
    for (const axis of ['valence', 'arousal'] as const) {
      const delta = b[axis]! - a[axis]!;
      if (Math.abs(delta) > 0.4) {
        turns.push({ t: b.t0, kind: axis, from: a[axis]!.toFixed(2), to: b[axis]!.toFixed(2), delta: Math.round(delta * 1000) / 1000 });
      }
    }
  }
  return turns;
}
