import type { Quadrant } from '@/types/report';

export const DIMENSIONS = [
  { id: 'poder', label: 'Poder', color: '#ff8a3d' },
  { id: 'rebeldia', label: 'Rebeldía', color: '#ff4f6d' },
  { id: 'tension', label: 'Tensión', color: '#d05cff' },
  { id: 'ansiedad', label: 'Ansiedad', color: '#9fb0c8' },
  { id: 'tristeza', label: 'Tristeza', color: '#5b8cff' },
  { id: 'nostalgia', label: 'Nostalgia', color: '#a07bff' },
  { id: 'ternura', label: 'Ternura', color: '#ff9ecf' },
  { id: 'belleza', label: 'Belleza', color: '#7fe3d4' },
  { id: 'erotismo', label: 'Erotismo', color: '#ff4fd8' },
  { id: 'ensonacion', label: 'Ensoñación', color: '#6fb6ff' },
  { id: 'triunfo', label: 'Triunfo', color: '#ffd23f' },
  { id: 'diversion', label: 'Diversión', color: '#39e58c' },
  { id: 'asombro', label: 'Asombro', color: '#3fd0ff' },
] as const;

export type DimensionId = (typeof DIMENSIONS)[number]['id'];

export const DIMENSION_BY_ID: Record<string, { id: string; label: string; color: string }> =
  Object.fromEntries(DIMENSIONS.map((d) => [d.id, d]));

export const QUADRANTS: Record<Quadrant, { label: string; color: string; hint: string }> = {
  FIESTA: { label: 'FIESTA', color: '#ffb020', hint: 'valencia + · activación +' },
  CHILL: { label: 'CHILL', color: '#2fd6c3', hint: 'valencia + · activación −' },
  DEFIANCE: { label: 'DEFIANCE', color: '#ff4f6d', hint: 'valencia − · activación +' },
  NOSTALGICA: { label: 'NOSTÁLGICA', color: '#a07bff', hint: 'valencia − · activación −' },
};

export function quadrantOf(valence: number, arousal: number): Quadrant {
  if (valence >= 0) return arousal >= 0 ? 'FIESTA' : 'CHILL';
  return arousal >= 0 ? 'DEFIANCE' : 'NOSTALGICA';
}

export const ACCENTS = ['#3fd0ff', '#ff4fd8', '#ffd23f', '#39e58c', '#a07bff', '#ff4f6d'] as const;
