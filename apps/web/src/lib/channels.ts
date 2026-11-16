// Qué muestra el cerebro: las 6 dimensiones más altas o, si están en abstención,
// descriptores medidos y calibrados. Un "canal" es una etiqueta + una zona iluminada.
import type { Figure, Report } from '@/types/report';
import type { Verdict } from './provenance';
import { ACCENTS, DIMENSION_BY_ID } from './dimensions';
import { sampleWindows } from './playback/energy';
import { DESCRIPTOR_ZONES, DIMENSION_ZONE } from '@/components/neural-scan/brain/zones';

export type Channel = {
  key: string;
  label: string;
  color: string;
  /** Índice de zona ilustrativa en el cerebro (0–12). */
  zone: number;
  figure: Figure;
  verdict: Verdict;
  /** Valor normalizado [0, 1] en el instante t; multiplica a la energía para dar el brillo. */
  norm: (t: number) => number;
  /** Texto del valor en la ventana actual. */
  text: (windowIndex: number, live: boolean) => string;
};

export type ChannelSet = { mode: 'emociones' | 'descriptores'; channels: Channel[] };

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const num = (v: number) => v.toLocaleString('es-ES', { maximumFractionDigits: 1 }).replace('-', '−');

/** Rangos de normalización de cada descriptor, solo para la intensidad visual. */
const DESCRIPTOR_RANGE: Record<string, [number, number]> = {
  loudness: [-30, -5],
  tempo: [60, 180],
  brightness: [500, 5000],
  dynamics: [0, 20],
  onset_density: [0, 8],
};
const DESCRIPTOR_KEYS = ['loudness', 'tempo', 'key', 'brightness', 'dynamics', 'onset_density'] as const;

export function buildChannels(report: Report, judge: (f: Figure | null | undefined) => Verdict): ChannelSet {
  const seriesOk = judge(report.series.emotion).kind !== 'abstain';

  const dims = report.dimensions
    .map((figure) => ({ figure, verdict: judge(figure) }))
    .filter((d) => d.verdict.kind !== 'abstain' && typeof d.figure.value === 'number' && DIMENSION_BY_ID[d.figure.id])
    .sort((a, b) => (b.figure.value as number) - (a.figure.value as number))
    .slice(0, 6);

  if (dims.length > 0) {
    return {
      mode: 'emociones',
      channels: dims.map(({ figure, verdict }) => {
        const meta = DIMENSION_BY_ID[figure.id];
        const global = figure.value as number;
        return {
          key: figure.id,
          label: meta.label,
          color: meta.color,
          zone: DIMENSION_ZONE[figure.id],
          figure,
          verdict,
          norm: (t) =>
            clamp01((seriesOk ? sampleWindows(report.windows, t, (w) => w.dims[figure.id] ?? global) : global) / 100),
          text: (wi, live) =>
            `${Math.round(live && seriesOk ? (report.windows[wi]?.dims[figure.id] ?? global) : global)} %`,
        };
      }),
    };
  }

  const channels: Channel[] = [];
  DESCRIPTOR_KEYS.forEach((key, i) => {
    const figure = report.descriptors[key];
    const verdict = judge(figure);
    if (verdict.kind === 'abstain') return;
    const range = DESCRIPTOR_RANGE[key];
    const n = typeof figure.value === 'number' && range ? clamp01((figure.value - range[0]) / (range[1] - range[0])) : 0.6;
    channels.push({
      key,
      label: figure.label,
      color: ACCENTS[i % ACCENTS.length],
      zone: DESCRIPTOR_ZONES[i],
      figure,
      verdict,
      norm: () => 0.35 + 0.65 * n,
      text: () => `${typeof figure.value === 'number' ? num(figure.value) : figure.value}${figure.unit ? ` ${figure.unit}` : ''}`,
    });
  });
  return { mode: 'descriptores', channels };
}
