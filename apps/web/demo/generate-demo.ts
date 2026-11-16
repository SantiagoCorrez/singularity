// Genera los datos DEMO de la Fase 1:
//   public/demo/track.demo.wav          pista sintética (120 BPM, La menor por construcción)
//   public/demo/report.demo.json        reporte simulado con procedencia completa
//   public/demo/report.abstention.json  variante con las emociones en abstención
// Las emociones y las calibraciones son SIMULADAS. Solo la envolvente de energía se
// calcula de verdad sobre el WAV sintético, para que el latido cuadre con el sonido.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIMENSIONS, quadrantOf } from '../src/lib/dimensions';
import { validateReport } from '../src/lib/validate';
import { coherence, coherenceLabel, detectTurns } from '../src/lib/coherence';
import type { Calibration, Figure, Report } from '../src/types/report';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/demo');
const SR = 22050;
const DUR = 64;
const NOW = '2026-11-14T12:00:00Z';
const TAU = Math.PI * 2;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261114);

// ---------- Estructura de la pista ----------
type Sec = {
  id: string; label: string; t0: number; t1: number; level: number; v: number; a: number;
  mods: Record<string, number>;
};
const SECTIONS: Sec[] = [
  { id: 'intro', label: 'Intro', t0: 0, t1: 8, level: 0.25, v: 0.18, a: -0.38,
    mods: { ensonacion: 2.2, nostalgia: 1.8, belleza: 1.4, triunfo: 0.35, poder: 0.4, diversion: 0.4 } },
  { id: 'estrofa', label: 'Estrofa', t0: 8, t1: 20, level: 0.55, v: 0.28, a: 0.2,
    mods: { rebeldia: 1.1, triunfo: 0.8, asombro: 0.8 } },
  { id: 'pre-coro', label: 'Pre-coro', t0: 20, t1: 26, level: 0.68, v: -0.2, a: 0.48,
    mods: { tension: 2.1, ansiedad: 1.9, triunfo: 0.6, diversion: 0.6 } },
  { id: 'coro-1', label: 'Coro', t0: 26, t1: 40, level: 1, v: 0.58, a: 0.8,
    mods: { triunfo: 1.2, poder: 1.15, diversion: 1.2, asombro: 1.2 } },
  { id: 'puente', label: 'Puente', t0: 40, t1: 48, level: 0.32, v: -0.32, a: -0.28,
    mods: { nostalgia: 2.4, tristeza: 3, ternura: 2.2, ensonacion: 1.8, triunfo: 0.3, poder: 0.35, diversion: 0.3 } },
  { id: 'coro-2', label: 'Coro final', t0: 48, t1: 58, level: 1, v: 0.64, a: 0.9,
    mods: { triunfo: 1.3, poder: 1.2, diversion: 1.25, asombro: 1.35 } },
  { id: 'outro', label: 'Outro', t0: 58, t1: 64, level: 0.28, v: 0.22, a: -0.42,
    mods: { ensonacion: 2, belleza: 1.5, ternura: 1.6, triunfo: 0.5, poder: 0.4, diversion: 0.4 } },
];
const BASE: Record<string, number> = {
  triunfo: 70, poder: 64, diversion: 58, asombro: 50, belleza: 45, rebeldia: 42, tension: 36,
  erotismo: 32, ensonacion: 27, nostalgia: 24, ternura: 20, ansiedad: 17, tristeza: 11,
};
// Letra simulada por tramo. La estrofa contrasta a propósito con el audio.
const LYRICS: Record<string, { v: number; a: number; theme: string; mods: Record<string, number> }> = {
  intro: { v: 0.1, a: -0.4, theme: "un recuerdo que vuelve", mods: { ensonacion: 2.2, nostalgia: 2, triunfo: 0.3, poder: 0.4, diversion: 0.4 } },
  estrofa: { v: -0.55, a: -0.25, theme: "una pérdida", mods: { tristeza: 6, nostalgia: 2.8, triunfo: 0.15, diversion: 0.15, poder: 0.3, asombro: 0.3 } },
  "pre-coro": { v: -0.3, a: 0.4, theme: "la duda antes de decidir", mods: { tension: 2, ansiedad: 2.4, triunfo: 0.5, diversion: 0.4 } },
  "coro-1": { v: 0.6, a: 0.75, theme: "levantarse y seguir", mods: { triunfo: 1.25, poder: 1.2, diversion: 0.9, asombro: 1.1 } },
  puente: { v: -0.4, a: -0.35, theme: "lo que se quedó atrás", mods: { nostalgia: 2.6, tristeza: 3.4, ternura: 2, triunfo: 0.3, poder: 0.3, diversion: 0.3 } },
  "coro-2": { v: 0.7, a: 0.85, theme: "levantarse y seguir", mods: { triunfo: 1.3, poder: 1.25, diversion: 1, asombro: 1.2 } },
  outro: { v: 0.05, a: -0.5, theme: "calma después de todo", mods: { ensonacion: 1.8, belleza: 1.4, ternura: 1.8, triunfo: 0.5, poder: 0.4, diversion: 0.4 } },
};
const secAt = (t: number) => SECTIONS.find((s) => t >= s.t0 && t < s.t1) ?? SECTIONS[SECTIONS.length - 1];

// ---------- Síntesis ----------
const CHORDS = [
  [110, 130.81, 164.81], // La menor
  [87.31, 110, 130.81], // Fa
  [130.81, 164.81, 196], // Do
  [98, 123.47, 146.83], // Sol
];
function synth(): Float32Array {
  const n = SR * DUR;
  const out = new Float32Array(n);
  let level = SECTIONS[0].level;
  let prevNoise = 0;
  const k = 1 - Math.exp(-1 / (0.15 * SR));
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const sec = secAt(t);
    level += (sec.level - level) * k;
    const chord = CHORDS[Math.floor(t / 4) % 4];
    const drums = sec.level >= 0.45;
    const full = sec.level >= 0.9;

    let s = 0;
    for (const f of chord) s += Math.sin(TAU * f * 2 * t) * 0.07;
    s *= 0.7 + 0.3 * Math.sin(TAU * 0.25 * t);

    if (drums) {
      const pb = t % 0.25;
      s += (Math.sin(TAU * chord[0] * t) + 0.4 * Math.sin(TAU * chord[0] * 2 * t)) * Math.exp(-pb * 6) * 0.26;
      const tb = t % 0.5;
      s += Math.sin(TAU * (45 * tb + 3 * (1 - Math.exp(-30 * tb)))) * Math.exp(-tb * 9) * 0.7;
    }
    const noise = rnd() * 2 - 1;
    const hp = noise - prevNoise;
    prevNoise = noise;
    if (drums) {
      const ph = full ? t % 0.125 : (t + 0.25) % 0.5;
      s += hp * Math.exp(-ph * 60) * 0.13;
    }
    if (full) {
      const step = Math.floor(t / 0.125);
      const f = chord[step % 3] * 4;
      s += Math.asin(Math.sin(TAU * f * t)) * 0.6 * Math.exp(-(t % 0.125) * 10) * 0.13;
    }
    if (sec.id === 'pre-coro') {
      const p = (t - sec.t0) / (sec.t1 - sec.t0);
      s += hp * p * p * 0.12;
    }
    out[i] = Math.tanh(s * (0.35 + 0.65 * level) * 1.2);
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  for (let i = 0; i < n; i++) out[i] *= 0.89 / peak;
  // Fundidos para evitar clics.
  const fade = SR * 0.05;
  for (let i = 0; i < fade; i++) {
    out[i] *= i / fade;
    out[n - 1 - i] *= i / fade;
  }
  return out;
}

function wav16(x: Float32Array): Buffer {
  const buf = Buffer.alloc(44 + x.length * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + x.length * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i])) * 32767), 44 + i * 2);
  }
  return buf;
}

// ---------- Envolvente medida sobre el WAV ----------
const RATE = 20;
function envelope(x: Float32Array) {
  const frames = DUR * RATE;
  const acc = { rms: new Array<number>(frames).fill(0), low: new Array<number>(frames).fill(0),
    mid: new Array<number>(frames).fill(0), high: new Array<number>(frames).fill(0) };
  const cnt = new Array<number>(frames).fill(0);
  const aLow = 1 - Math.exp((-TAU * 250) / SR);
  const aHigh = 1 - Math.exp((-TAU * 4000) / SR);
  let lp1 = 0;
  let lp2 = 0;
  for (let i = 0; i < x.length; i++) {
    lp1 += aLow * (x[i] - lp1);
    lp2 += aHigh * (x[i] - lp2);
    const f = Math.min(frames - 1, Math.floor((i / SR) * RATE));
    acc.rms[f] += x[i] * x[i];
    acc.low[f] += lp1 * lp1;
    acc.mid[f] += (lp2 - lp1) ** 2;
    acc.high[f] += (x[i] - lp2) ** 2;
    cnt[f]++;
  }
  const norm = (a: number[]) => {
    const r = a.map((v, i) => Math.sqrt(v / Math.max(1, cnt[i])));
    const max = Math.max(...r);
    return r.map((v) => Math.round((v / max) * 1000) / 1000);
  };
  return { rate_hz: RATE, rms: norm(acc.rms), low: norm(acc.low), mid: norm(acc.mid), high: norm(acc.high) };
}

// ---------- Emociones simuladas ----------
function wobble(seed: number) {
  const r = mulberry32(seed);
  const p = [r() * TAU, r() * TAU, r() * TAU];
  return (t: number) =>
    (Math.sin(t * 0.21 + p[0]) + 0.6 * Math.sin(t * 0.53 + p[1]) + 0.4 * Math.sin(t * 1.1 + p[2])) / 2;
}
/** Media de una propiedad de sección en ±1,25 s: suaviza los bordes entre tramos. */
function blend(t: number, get: (s: Sec) => number): number {
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += get(secAt(Math.max(0, Math.min(DUR - 0.01, t - 1.25 + (i * 2.5) / 8))));
  return sum / 9;
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const r1 = (v: number) => Math.round(v * 10) / 10;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

const wV = wobble(1);
const wA = wobble(2);
const wD = Object.fromEntries(DIMENSIONS.map((d, i) => [d.id, wobble(10 + i)]));

function build(): { report: Report; pcm: Float32Array } {
  const pcm = synth();
  const env = envelope(pcm);

  const windows: Report['windows'] = [];
  for (let t0 = 0; t0 < DUR - 2.5; t0 += 2.5) {
    const t1 = Math.min(DUR, t0 + 5);
    const c = (t0 + t1) / 2;
    const slice = env.rms.slice(Math.floor(t0 * RATE), Math.floor(t1 * RATE));
    const dims: Record<string, number> = {};
    for (const d of DIMENSIONS) {
      dims[d.id] = r1(clamp(BASE[d.id] * blend(c, (s) => s.mods[d.id] ?? 1) + wD[d.id](c) * 5, 0, 100));
    }
    windows.push({
      t0, t1,
      valence: r3(clamp(blend(c, (s) => s.v) + wV(c) * 0.06, -1, 1)),
      arousal: r3(clamp(blend(c, (s) => s.a) + wA(c) * 0.06, -1, 1)),
      energy: r3(slice.reduce((a, b) => a + b, 0) / slice.length),
      dims,
    });
  }

  // Valor global = media ponderada por energía.
  const wsum = windows.reduce((a, w) => a + w.energy, 0);
  const wmean = (get: (w: Report['windows'][number]) => number) =>
    windows.reduce((a, w) => a + get(w) * w.energy, 0) / wsum;
  const gV = r3(wmean((w) => w.valence ?? 0));
  const gA = r3(wmean((w) => w.arousal ?? 0));
  const gDims = DIMENSIONS.map((d) => ({ ...d, value: Math.round(wmean((w) => w.dims[d.id])) }));
  const dominant = [...gDims].sort((a, b) => b.value - a.value)[0];

  const sectionDims: Record<string, Record<string, number>> = {};
  const sections: Report['sections'] = SECTIONS.map((s) => {
    const ws = windows.filter((w) => (w.t0 + w.t1) / 2 >= s.t0 && (w.t0 + w.t1) / 2 < s.t1);
    const mean = (get: (w: Report['windows'][number]) => number) => ws.reduce((a, w) => a + get(w), 0) / ws.length;
    const v = r3(mean((w) => w.valence ?? 0));
    const a = r3(mean((w) => w.arousal ?? 0));
    const dom = [...DIMENSIONS].sort((x, y) => mean((w) => w.dims[y.id]) - mean((w) => w.dims[x.id]))[0];
    const dims = Object.fromEntries(DIMENSIONS.map((d) => [d.id, r1(mean((w) => w.dims[d.id]))]));
    sectionDims[s.id] = dims;
    return { id: s.id, label: s.label, t0: s.t0, t1: s.t1, valence: v, arousal: a, quadrant: quadrantOf(v, a), dominant: dom.id, energy: r3(mean((w) => w.energy)) };
  });

  const cal = (metric: string, score: number, threshold: number): Calibration => ({
    ref: 'DEMO · calibración simulada, no es una prueba real',
    metric, score, threshold, n: 0, passed: true, tested_at: NOW,
  });
  const fig = (
    id: string, label: string, value: number | string, unit: string | null,
    status: Figure['status'], c: Calibration,
  ): Figure => ({
    id, label, value, unit, source: 'modelo:demo-sim', measured_at: NOW, status,
    method: 'valor simulado para la DEMO v0.1 (no procede de un modelo real)', calibration: c,
  });

  // Letra y coherencia (simuladas).
  const lyricSections = SECTIONS.map((s) => {
    const l = LYRICS[s.id];
    const dims = Object.fromEntries(DIMENSIONS.map((d) => [d.id, r1(clamp(BASE[d.id] * (l.mods[d.id] ?? 1), 0, 100))]));
    return { section_id: s.id, valence: l.v, arousal: l.a, dims, theme: l.theme };
  });
  const cohSections = sections.map((s, i) => {
    const score = coherence({ valence: s.valence ?? 0, arousal: s.arousal ?? 0, dims: sectionDims[s.id] }, lyricSections[i]);
    return { section_id: s.id, score, label: coherenceLabel(score) };
  });
  const dur = (i: number) => sections[i].t1 - sections[i].t0;
  const overall = Math.round(cohSections.reduce((a, c, i) => a + c.score * dur(i), 0) / DUR);
  const worst = cohSections.reduce((a, c, i) => (c.score < cohSections[a].score ? i : a), 0);
  const explanation = `En ${sections[worst].label.toLowerCase()}, la letra habla de ${lyricSections[worst].theme} mientras el audio está en ${sections[worst].quadrant === "NOSTALGICA" ? "NOSTÁLGICA" : sections[worst].quadrant}.`;
  const lw = (get: (l: (typeof lyricSections)[number]) => number) => r3(lyricSections.reduce((a, l, i) => a + get(l) * dur(i), 0) / DUR);

  // ---------- Módulo 2 (simulado) ----------
  const D = '2026-11-10T00:00:00Z';
  const txt = (id: string, label: string, value: string) => fig(id, label, value, null, 'verificado', cal('F1', 0.8, 0.7));
  const TRIBES = [
    { id: 'tribu-1', name: 'Entreno de alta energía', q: 'FIESTA' as const, aff: 86, size: 412000, growth: 14.2, emo: 'Triunfo', members: ['Playlist demo · Gym al máximo', 'Playlist demo · Running 170', 'Curador demo · FitBeats'] },
    { id: 'tribu-2', name: 'Pop urbano de celebración', q: 'FIESTA' as const, aff: 78, size: 930000, growth: 6.1, emo: 'Diversión', members: ['Playlist demo · Viernes', 'Artista demo · Luz Marina', 'Playlist demo · Previa'] },
    { id: 'tribu-3', name: 'Himnos de superación', q: 'DEFIANCE' as const, aff: 71, size: 188000, growth: 9.8, emo: 'Poder', members: ['Playlist demo · Arriba', 'Curador demo · Motiva', 'Artista demo · Norte Sur'] },
    { id: 'tribu-4', name: 'Electrónica melódica', q: 'CHILL' as const, aff: 52, size: 264000, growth: 2.4, emo: 'Asombro', members: ['Playlist demo · Neón suave', 'Artista demo · Halo', 'Playlist demo · Trayecto'] },
  ].sort((a, b) => b.aff * b.growth - a.aff * a.growth);
  const maxSize = Math.max(...TRIBES.map((t) => t.size));
  const gNodes: Report['tribe_graph']['nodes'] = [
    { id: 'song', kind: 'song', label: 'Pista sintética', reach: null, quadrant: null, source: 'modelo:demo-sim', measured_at: NOW },
  ];
  const gEdges: Report['tribe_graph']['edges'] = [];
  TRIBES.forEach((t) => {
    gNodes.push({ id: t.id, kind: 'tribe', label: t.name, reach: r3(t.size / maxSize), quadrant: t.q, source: 'modelo:demo-sim', measured_at: D });
    gEdges.push({ source: 'song', target: t.id, similarity: t.aff / 100 });
    t.members.forEach((m, i) => {
      const id = `${t.id}-m${i}`;
      const kind = m.startsWith('Playlist') ? 'playlist' : m.startsWith('Curador') ? 'curator' : 'artist';
      gNodes.push({ id, kind, label: m, reach: r3(0.12 + 0.2 * rnd()), quadrant: t.q, source: 'modelo:demo-sim', measured_at: D });
      gEdges.push({ source: t.id, target: id, similarity: r3(0.7 + 0.25 * rnd()) });
    });
  });
  const dataAgent = (id: string, label: string, findings: [string, string, string][]): Report['agents'][number] => ({
    id, label, kind: 'data', findings: findings.map(([fid, fl, v]) => txt(fid, fl, v)), reading: null, recommendation: null, score: null,
  });
  const view = (id: string, label: string, reading: string, rec: string, score: number): Report['agents'][number] => ({
    id, label, kind: 'perspective', findings: [],
    reading: txt(`${id}_reading`, 'Lectura', reading),
    recommendation: txt(`${id}_recommendation`, 'Recomendación', rec),
    score: fig(`${id}_score`, 'Puntaje', score, '/100', 'verificado', cal('CCC', 0.6, 0.5)),
  });
  const agents: Report['agents'] = [
    dataAgent('tendencias', 'Tendencias', [
      ['genre_trend_12m', 'Interés del género por país, 12 meses', 'al alza en 3 de 5 países demo'],
      ['youtube_rising', 'YouTube: en alza', 'tutoriales de entreno con este tempo'],
      ['tiktok_rising', 'TikTok: sonidos en alza', 'transiciones de 120 BPM'],
    ]),
    {
      id: 'riesgo', label: 'Riesgo', kind: 'risk', reading: null, recommendation: null, score: null,
      findings: [
        txt('risk_loudness', 'Sonoridad frente al streaming', '−9,4 LUFS: 4,6 LU por encima de la referencia de −14 LUFS'),
        txt('risk_dynamics', 'Rango dinámico', '7,8 LU de rango de sonoridad: medio (entre 5 y 12 LU)'),
        txt('market_saturation', 'Saturación del género', 'media: 14 lanzamientos demo similares este mes'),
      ],
    },
    view('manager', 'Manager', 'El coro final concentra la energía y encaja con el público de entreno.', 'Lanzar mientras el género sigue al alza.', 78),
    view('marketing', 'Director de Marketing', 'El tempo coincide con los sonidos en alza de vídeo corto.', 'Cortar el coro en clips de 15 segundos.', 74),
    view('pr', 'PR', 'El contraste entre letra y sonido da un ángulo de historia.', 'Proponer la historia de la estrofa a medios de nicho.', 69),
  ];
  const toolRows: [string, string, string, number][] = [
    ['tendencias', 'Tendencias', 'Google Trends', 913], ['tendencias', 'Tendencias', 'YouTube', 344],
    ['tendencias', 'Tendencias', 'TikTok', 521], ['riesgo', 'Riesgo', 'Análisis de audio', 0],
    ['perspectivas', 'Manager · Marketing · PR', 'Claude', 6240], ['tribus', 'Tribus · ADN del artista', 'Postgres + pgvector', 18],
  ];
  const swarm: Report['swarm'] = toolRows.map(([agent, label, tool, ms]) => ({
    agent, label, tool, status: 'ok', latency_ms: ms, data_date: D, detail: 'respuesta simulada',
  }));

  const report: Report = {
    schema_version: '0.3.0',
    demo: true,
    generated_at: NOW,
    track: {
      id: 'demo',
      title: 'Pista sintética',
      artist: 'Singularity · DEMO',
      duration_s: DUR,
      audio_url: '/demo/track.demo.wav',
    },
    descriptors: {
      loudness: fig('loudness', 'Sonoridad', -9.4, 'LUFS', 'medido', cal('MAE', 0.3, 0.5)),
      tempo: fig('tempo', 'Pulso', 120, 'BPM', 'medido', cal('MAE', 0.4, 1)),
      key: fig('key', 'Tonalidad', 'La menor', null, 'medido', cal('F1', 0.86, 0.8)),
      brightness: fig('brightness', 'Brillo', 2140, 'Hz', 'medido', cal('MAE', 38, 60)),
      dynamics: fig('dynamics', 'Dinámica', 7.8, 'LU', 'medido', cal('MAE', 0.4, 0.8)),
      onset_density: fig('onset_density', 'Densidad de ataques', 4.2, 'ataques/s', 'medido', cal('F1', 0.88, 0.8)),
      climax: fig('climax', 'Clímax', 50, 's', 'medido', cal('MAE', 1.2, 2.5)),
    },
    russell: {
      valence: fig('valence', 'Valencia', gV, null, 'verificado', cal('CCC', 0.58, 0.5)),
      arousal: fig('arousal', 'Activación', gA, null, 'verificado', cal('CCC', 0.71, 0.6)),
      quadrant: fig('quadrant', 'Cuadrante', quadrantOf(gV, gA), null, 'verificado', cal('CCC', 0.58, 0.5)),
    },
    dimensions: gDims.map((d, i) => fig(d.id, d.label, d.value, '%', 'verificado', cal('AUC', r3(0.78 + (i % 5) * 0.02), 0.75))),
    dominant: fig('dominant', 'Emoción dominante', dominant.id, null, 'verificado', cal('AUC', 0.82, 0.75)),
    series: {
      emotion: fig('series_emotion', 'Serie emocional', windows.length, 'ventanas', 'verificado', cal('CCC', 0.58, 0.5)),
      energy: fig('series_energy', 'Envolvente de energía', env.rms.length, 'muestras', 'medido', cal('MAE', 0.01, 0.05)),
      structure: fig("series_structure", "Estructura", SECTIONS.length, "tramos", "medido", cal("F1", 0.9, 0.7)),
    },
    swarm,
    tribe_graph: {
      provenance: fig('tribe_graph', 'Red de tribus', gNodes.length, 'nodos', 'verificado', cal('F1', 0.76, 0.7)),
      nodes: gNodes,
      edges: gEdges,
    },
    tribes: TRIBES.map((t) => ({
      id: t.id,
      name: t.name,
      affinity: fig(`${t.id}_affinity`, 'Afinidad', t.aff, '/100', 'verificado', cal('AUC', 0.79, 0.75)),
      size: fig(`${t.id}_size`, 'Tamaño estimado', t.size, 'oyentes', 'verificado', cal('MAE', 3, 5)),
      growth_90d: fig(`${t.id}_growth`, 'Crecimiento a 90 días', t.growth, '%', 'verificado', cal('MAE', 1.1, 2)),
      emotion: txt(`${t.id}_emotion`, 'Emoción que la conecta', t.emo),
    })),
    agents,
    artist_dna: {
      consistency: fig('dna_consistency', 'Consistencia sonora', 81, '%', 'verificado', cal('CCC', 0.6, 0.5)),
      evolution: txt('dna_evolution', 'Evolución emocional', 'valencia +0,12 → +0,36 · activación +0,31 → +0,50'),
      recurring_tribes: txt('dna_recurring', 'Tribus recurrentes', 'Entreno de alta energía · Himnos de superación'),
      gaps: txt('dna_gaps', 'Huecos', 'Electrónica melódica: afín, pero aún no la alcanza'),
      tracks: [
        { track_id: 'demo-a', title: 'Pista demo anterior 1', analyzed_at: '2026-05-02T00:00:00Z', valence: 0.12, arousal: 0.31, quadrant: 'FIESTA' },
        { track_id: 'demo-b', title: 'Pista demo anterior 2', analyzed_at: '2026-08-19T00:00:00Z', valence: 0.21, arousal: 0.4, quadrant: 'FIESTA' },
        { track_id: 'demo', title: 'Pista sintética', analyzed_at: NOW, valence: gV, arousal: gA, quadrant: quadrantOf(gV, gA) },
      ],
    },
    turns: detectTurns(sections),
    lyrics: {
      provenance: fig("lyrics", "Análisis de la letra", lyricSections.length, "tramos", "verificado", cal("CCC", 0.61, 0.5)),
      valence: fig("lyrics_valence", "Valencia de la letra", lw((l) => l.valence), null, "verificado", cal("CCC", 0.61, 0.5)),
      arousal: fig("lyrics_arousal", "Activación de la letra", lw((l) => l.arousal), null, "verificado", cal("CCC", 0.55, 0.5)),
      sections: lyricSections,
    },
    coherence: {
      overall: fig("coherence", "Coherencia letra ↔ sonido", overall, "%", "verificado", cal("CCC", 0.6, 0.5)),
      explanation: fig("coherence_explanation", "Dónde se separan", explanation, null, "verificado", cal("CCC", 0.6, 0.5)),
      sections: cohSections,
    },
    psychographics: [],
    windows,
    envelope: env,
    sections,
    markers: [
      { t: 0, kind: 'intro', label: 'Intro' },
      { t: 26, kind: 'chill', label: 'Escalofrío' },
      { t: 48, kind: 'chill', label: 'Escalofrío' },
      { t: 50, kind: 'climax', label: 'Clímax' },
    ],
    embeddings: fig('embeddings', 'Embeddings', 'demo-sim-embed · v0.1.0', null, 'verificado', cal('AUC', 0.8, 0.75)),
  };
  return { report, pcm };
}

/** Variante: el modelo emocional no supera la calibración; los descriptores sí. */
function abstentionVariant(base: Report): Report {
  const r: Report = JSON.parse(JSON.stringify(base));
  r.track.id = 'abstention';
  r.track.title = 'Pista sintética · emociones sin calibrar';
  const fail = (f: Figure, metric: string, score: number, threshold: number) => {
    f.status = 'heurístico';
    f.calibration = { ...f.calibration!, metric, score, threshold, passed: false };
  };
  r.dimensions.forEach((f, i) => {
    if (i % 2 === 0) fail(f, 'AUC', r3(0.61 + (i % 5) * 0.02), 0.75);
    else {
      f.status = 'heurístico';
      f.calibration = null;
    }
  });
  fail(r.dominant, 'AUC', 0.66, 0.75);
  fail(r.russell.valence, 'CCC', 0.41, 0.5);
  fail(r.russell.arousal, 'CCC', 0.52, 0.6);
  fail(r.russell.quadrant, 'CCC', 0.41, 0.5);
  fail(r.series.emotion, 'CCC', 0.41, 0.5);
  // Variante sin fuentes: el enjambre no está conectado y no hay tribus.
  const off = (f: Figure) => {
    f.value = null;
    f.status = 'no_conectado';
    f.calibration = null;
  };
  r.swarm.forEach((row) => {
    row.status = 'no_conectado';
    row.latency_ms = null;
    row.data_date = null;
    row.detail = 'faltan credenciales';
  });
  off(r.tribe_graph.provenance);
  r.tribe_graph.nodes = [];
  r.tribe_graph.edges = [];
  r.tribes = [];
  r.agents.forEach((a) => {
    a.findings.forEach(off);
    [a.reading, a.recommendation, a.score].forEach((f) => f && off(f));
  });
  [r.artist_dna.consistency, r.artist_dna.evolution, r.artist_dna.recurring_tribes, r.artist_dna.gaps].forEach(off);
  r.artist_dna.tracks = [];
  // Sin emociones del audio tampoco hay coherencia.
  r.turns = [];
  r.coherence = null;
  return r;
}

const { report, pcm } = build();
const variants: [string, Report][] = [
  ['report.demo.json', report],
  ['report.abstention.json', abstentionVariant(report)],
];
mkdirSync(OUT, { recursive: true });
for (const [name, data] of variants) {
  const res = validateReport(data);
  if (!res.ok) {
    console.error(`${name} NO valida contra el esquema:\n  ${res.errors.join('\n  ')}`);
    process.exit(1);
  }
  writeFileSync(resolve(OUT, name), JSON.stringify(data));
}
writeFileSync(resolve(OUT, 'track.demo.wav'), wav16(pcm));
console.log(
  `DEMO generada: ${report.windows.length} ventanas, dominante=${report.dominant.value}, ` +
    `V=${report.russell.valence.value} A=${report.russell.arousal.value} (${report.russell.quadrant.value})`,
);
