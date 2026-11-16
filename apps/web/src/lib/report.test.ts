import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateReport } from './validate';
import { evaluate } from './provenance';
import { buildChannels } from './channels';
import type { Report } from '@/types/report';

const load = (name: string): unknown =>
  JSON.parse(readFileSync(resolve(__dirname, '../../public/demo', name), 'utf8'));

describe('reportes DEMO', () => {
  it.each(['report.demo.json', 'report.abstention.json'])('%s valida contra el esquema', (name) => {
    const res = validateReport(load(name));
    expect(res.ok ? [] : res.errors).toEqual([]);
  });

  it('el esquema rechaza una cifra sin campos de procedencia', () => {
    const r = load('report.demo.json') as Report;
    delete (r.dominant as Partial<Report['dominant']>).source;
    expect(validateReport(r).ok).toBe(false);
  });

  it('los reportes simulados van marcados como demo', () => {
    expect((load('report.demo.json') as Report).demo).toBe(true);
    expect((load('report.abstention.json') as Report).demo).toBe(true);
  });

  it('con emociones calibradas el cerebro muestra las 6 dimensiones más altas', () => {
    const r = load('report.demo.json') as Report;
    const ch = buildChannels(r, (f) => evaluate(f));
    expect(ch.mode).toBe('emociones');
    expect(ch.channels).toHaveLength(6);
    const values = ch.channels.map((c) => c.figure.value as number);
    expect([...values].sort((a, b) => b - a)).toEqual(values);
  });

  it('con emociones en abstención el cerebro cae a descriptores medidos', () => {
    const r = load('report.abstention.json') as Report;
    for (const d of r.dimensions) expect(evaluate(d).kind).toBe('abstain');
    const ch = buildChannels(r, (f) => evaluate(f));
    expect(ch.mode).toBe('descriptores');
    expect(ch.channels.every((c) => evaluate(c.figure).kind === 'show')).toBe(true);
  });
});
