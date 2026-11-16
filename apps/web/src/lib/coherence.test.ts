import { describe, expect, it } from 'vitest';
import { coherence, coherenceLabel, detectTurns } from './coherence';

const dims = { triunfo: 80, poder: 70, tristeza: 10 };

describe('coherencia letra ↔ sonido', () => {
  it('vale 100 cuando audio y letra coinciden', () => {
    const v = { valence: 0.5, arousal: 0.7, dims };
    expect(coherence(v, v)).toBe(100);
  });

  it('baja cuando la letra va por otro lado', () => {
    const audio = { valence: 0.6, arousal: 0.8, dims };
    const near = { valence: 0.5, arousal: 0.7, dims: { triunfo: 75, poder: 60, tristeza: 15 } };
    const far = { valence: -0.7, arousal: -0.4, dims: { triunfo: 5, poder: 10, tristeza: 90 } };
    expect(coherence(audio, near)).toBeGreaterThanOrEqual(75);
    expect(coherence(audio, far)).toBeLessThan(50);
    expect(coherence(audio, far)).toBe(coherence(far, audio));
    // Mismo caso y mismo resultado que apps/api/tests/test_lyrics.py: las dos implementaciones deben coincidir.
    expect(coherence({ valence: 0.6, arousal: 0.8, dims }, { valence: -0.7, arousal: -0.4, dims: { triunfo: 5, poder: 10, tristeza: 90 } })).toBe(29);
  });

  it('usa solo valencia y activación si no hay dimensiones', () => {
    expect(coherence({ valence: 1, arousal: 1, dims: {} }, { valence: -1, arousal: -1, dims: {} })).toBe(0);
  });

  it('etiqueta por umbrales', () => {
    expect(coherenceLabel(75)).toBe('COHERENTE');
    expect(coherenceLabel(74)).toBe('TENSION_CREATIVA');
    expect(coherenceLabel(50)).toBe('TENSION_CREATIVA');
    expect(coherenceLabel(49)).toBe('CONTRASTE_DELIBERADO');
  });
});

describe('giros emocionales', () => {
  it('marca cambios de cuadrante y saltos > 0,4', () => {
    const turns = detectTurns([
      { t0: 0, valence: 0.2, arousal: -0.3, quadrant: 'CHILL' },
      { t0: 10, valence: 0.3, arousal: 0.3, quadrant: 'FIESTA' },
      { t0: 20, valence: 0.35, arousal: 0.5, quadrant: 'FIESTA' },
    ]);
    expect(turns.map((t) => [t.t, t.kind])).toEqual([[10, 'quadrant'], [10, 'arousal']]);
  });

  it('no inventa giros si falta la emoción de un tramo', () => {
    expect(detectTurns([
      { t0: 0, valence: null, arousal: null, quadrant: null },
      { t0: 10, valence: 0.3, arousal: 0.3, quadrant: 'FIESTA' },
    ])).toEqual([]);
  });
});
