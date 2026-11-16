import { describe, expect, it } from 'vitest';
import { evaluate, missingFields } from './provenance';
import type { Figure } from '@/types/report';

const ok: Figure = {
  id: 'tempo',
  label: 'Pulso',
  value: 120,
  unit: 'BPM',
  source: 'audio',
  measured_at: '2026-11-14T10:00:00Z',
  status: 'medido',
  method: 'librosa.beat v0.10',
  calibration: {
    ref: 'clicks sintéticos',
    metric: 'MAE',
    score: 0.4,
    threshold: 1,
    n: 200,
    passed: true,
    tested_at: '2026-11-01T00:00:00Z',
  },
};

describe('regla de abstención', () => {
  it('muestra una cifra con procedencia completa', () => {
    expect(evaluate(ok)).toEqual({ kind: 'show', value: 120, missing: [] });
  });

  it('se abstiene si la cifra no existe', () => {
    expect(evaluate(null).kind).toBe('abstain');
    expect(evaluate(undefined).kind).toBe('abstain');
  });

  it.each([
    ['source', { source: null }, 'fuente ausente'],
    ['source inválido', { source: 'me lo inventé' }, 'fuente no reconocida'],
    ['measured_at', { measured_at: null }, 'fecha de medición ausente'],
    ['measured_at inválido', { measured_at: 'ayer' }, 'fecha de medición inválida'],
    ['status heurístico', { status: 'heurístico' }, 'no verificable'],
    ['status pendiente', { status: 'pendiente' }, 'no verificable'],
    ['status no_conectado', { status: 'no_conectado' }, 'no verificable'],
    ['calibration', { calibration: null }, 'calibración ausente'],
    ['calibration fallida', { calibration: { ...ok.calibration!, passed: false } }, 'calibración no superada'],
    ['value', { value: null }, 'valor ausente'],
  ] as const)('se abstiene si falla %s', (_name, patch, reason) => {
    const v = evaluate({ ...ok, ...patch } as Figure);
    expect(v.kind).toBe('abstain');
    expect(v.missing.join(' | ')).toContain(reason);
  });

  it('acepta las fuentes con prefijo agente: y modelo:', () => {
    expect(missingFields({ ...ok, source: 'agente:playlists' })).toEqual([]);
    expect(missingFields({ ...ok, source: 'modelo:effnet-av' })).toEqual([]);
  });

  it('no reconoce las fuentes excluidas (Chartmetric y Spotify)', () => {
    expect(evaluate({ ...ok, source: 'chartmetric' }).kind).toBe('abstain');
    expect(evaluate({ ...ok, source: 'spotify' }).kind).toBe('abstain');
  });

  it('enumera todo lo que falta, no solo lo primero', () => {
    const v = evaluate({ ...ok, source: null, calibration: null });
    expect(v.missing).toHaveLength(2);
  });

  it('en modo desarrollo marca como no calibrado, nunca como válido', () => {
    const v = evaluate({ ...ok, status: 'heurístico', calibration: null }, { devMode: true });
    expect(v.kind).toBe('uncalibrated');
    expect(v.missing).toHaveLength(2);
  });

  it('en modo desarrollo tampoco inventa un valor ausente', () => {
    const v = evaluate({ ...ok, value: null, status: 'no_conectado' }, { devMode: true });
    expect(v.kind).toBe('abstain');
  });
});
