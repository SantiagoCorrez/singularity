// Lectura de las series del reporte en un instante t. La energía viene de la envolvente
// del reporte (no de un analizador en vivo), así el brillo es determinista y exacto.
import type { Report } from '@/types/report';

type Env = Report['envelope'];
type Win = Report['windows'][number];

function lerpArr(a: number[], pos: number): number {
  if (a.length === 0) return 0;
  const p = Math.max(0, Math.min(a.length - 1, pos));
  const i = Math.floor(p);
  const j = Math.min(a.length - 1, i + 1);
  return a[i] + (a[j] - a[i]) * (p - i);
}

export function energyAt(env: Env, t: number): number {
  return lerpArr(env.rms, t * env.rate_hz);
}

export function bandsAt(env: Env, t: number): { low: number; mid: number; high: number } {
  const p = t * env.rate_hz;
  return { low: lerpArr(env.low, p), mid: lerpArr(env.mid, p), high: lerpArr(env.high, p) };
}

const center = (w: Win) => (w.t0 + w.t1) / 2;

/** Índice de la ventana cuyo centro queda más cerca de t. */
export function windowIndexAt(windows: Win[], t: number): number {
  let best = 0;
  let dist = Infinity;
  for (let i = 0; i < windows.length; i++) {
    const d = Math.abs(center(windows[i]) - t);
    if (d < dist) {
      dist = d;
      best = i;
    }
  }
  return best;
}

/** Interpola un valor por ventana entre los centros de las ventanas vecinas. */
export function sampleWindows(windows: Win[], t: number, get: (w: Win) => number): number {
  if (windows.length === 0) return 0;
  if (t <= center(windows[0])) return get(windows[0]);
  for (let i = 1; i < windows.length; i++) {
    const c1 = center(windows[i]);
    if (t <= c1) {
      const c0 = center(windows[i - 1]);
      const k = (t - c0) / (c1 - c0);
      return get(windows[i - 1]) * (1 - k) + get(windows[i]) * k;
    }
  }
  return get(windows[windows.length - 1]);
}

export function sectionIndexAt(sections: Report['sections'], t: number): number {
  for (let i = 0; i < sections.length; i++) if (t >= sections[i].t0 && t < sections[i].t1) return i;
  return sections.length - 1;
}
