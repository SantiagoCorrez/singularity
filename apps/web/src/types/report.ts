/* GENERADO por packages/schema/scripts/gen-types.ts — no editar a mano. */

export type Quadrant = 'FIESTA' | 'CHILL' | 'DEFIANCE' | 'NOSTALGICA';

/**
 * Reporte de Singularity para una pista: Emoción y trayectoria (1), Tribus agénticas (2) y Neural Scan (3).
 */
export interface Report {
  schema_version: string;
  /**
   * true = datos simulados; el visor los sella como DEMO.
   */
  demo: boolean;
  generated_at: string;
  track: Track;
  descriptors: Descriptors;
  russell: Russell;
  /**
   * Las 13 dimensiones (0–100). El id de cada cifra es la clave de la dimensión.
   */
  dimensions: Figure[];
  dominant: Figure;
  series: SeriesProvenance;
  windows: Window[];
  envelope: Envelope;
  sections: Section[];
  markers: Marker[];
  embeddings: Figure;
  /**
   * Giros emocionales: cambios de cuadrante y saltos > 0,4 en valencia o activación entre tramos consecutivos.
   */
  turns: Turn[];
  /**
   * Emoción de la letra por tramo. null = no hay letra.
   */
  lyrics: null | Lyrics;
  /**
   * Coherencia letra ↔ sonido. null = no se pudo calcular.
   */
  coherence: null | Coherence;
  /**
   * Perfil de audiencia. Cada cifra se abstiene por separado.
   */
  psychographics: Figure[];
  /**
   * Estado del enjambre: qué herramienta respondió, con qué latencia y de qué fecha son sus datos.
   */
  swarm: SwarmStatus[];
  tribe_graph: TribeGraph;
  tribes: Tribe[];
  agents: Agent[];
  artist_dna: ArtistDna;
}
export interface Track {
  id: string;
  title: string;
  artist: string;
  duration_s: number;
  audio_url: string;
}
export interface Descriptors {
  loudness: Figure;
  tempo: Figure;
  key: Figure;
  brightness: Figure;
  dynamics: Figure;
  onset_density: Figure;
  climax: Figure;
}
/**
 * Una cifra con procedencia. El visor se abstiene si falta source, measured_at, un status verificable o una calibración superada.
 */
export interface Figure {
  id: string;
  label: string;
  value: number | string | null;
  unit: string | null;
  source: string | null;
  measured_at: string | null;
  status: 'medido' | 'verificado' | 'heurístico' | 'pendiente' | 'no_conectado';
  method: string | null;
  calibration: null | Calibration;
}
export interface Calibration {
  ref: string;
  metric: string;
  score: number;
  threshold: number;
  n: number;
  passed: boolean;
  tested_at: string;
}
export interface Russell {
  valence: Figure;
  arousal: Figure;
  quadrant: Figure;
}
/**
 * Procedencia de las series: emotion gobierna valencia, activación, dimensiones, cuadrantes y giros; energy gobierna la energía y las bandas; structure gobierna los límites de los tramos.
 */
export interface SeriesProvenance {
  emotion: Figure;
  energy: Figure;
  structure: Figure;
}
export interface Window {
  t0: number;
  t1: number;
  valence: number | null;
  arousal: number | null;
  energy: number;
  dims: {
    [k: string]: number;
  };
}
/**
 * Envolvente de energía a paso fijo, normalizada a [0, 1] respecto al máximo de la pista.
 */
export interface Envelope {
  rate_hz: number;
  rms: number[];
  low: number[];
  mid: number[];
  high: number[];
}
export interface Section {
  id: string;
  label: string;
  t0: number;
  t1: number;
  valence: number | null;
  arousal: number | null;
  quadrant: null | Quadrant;
  dominant: string | null;
  energy: number;
}
export interface Marker {
  t: number;
  kind: 'intro' | 'climax' | 'chill';
  label: string;
}
export interface Turn {
  t: number;
  kind: 'quadrant' | 'valence' | 'arousal';
  from: string;
  to: string;
  delta: number | null;
}
export interface Lyrics {
  provenance: Figure;
  valence: Figure;
  arousal: Figure;
  sections: LyricSection[];
}
export interface LyricSection {
  section_id: string;
  valence: number;
  arousal: number;
  dims: {
    [k: string]: number;
  };
  /**
   * De qué habla la letra en este tramo, en pocas palabras.
   */
  theme: string;
}
export interface Coherence {
  overall: Figure;
  explanation: Figure;
  sections: CoherenceSection[];
}
export interface CoherenceSection {
  section_id: string;
  score: number;
  label: 'COHERENTE' | 'TENSION_CREATIVA' | 'CONTRASTE_DELIBERADO';
}
export interface SwarmStatus {
  agent: string;
  label: string;
  tool: string;
  status: 'ok' | 'no_conectado' | 'error';
  latency_ms: number | null;
  data_date: string | null;
  detail: string;
}
export interface TribeGraph {
  provenance: Figure;
  nodes: TribeNode[];
  edges: TribeEdge[];
}
export interface TribeNode {
  id: string;
  kind: 'song' | 'tribe' | 'playlist' | 'curator' | 'artist';
  label: string;
  /**
   * Alcance relativo al mayor nodo del grafo.
   */
  reach: number | null;
  quadrant: null | Quadrant;
  source: string | null;
  measured_at: string | null;
}
export interface TribeEdge {
  source: string;
  target: string;
  similarity: number;
}
export interface Tribe {
  id: string;
  name: string;
  affinity: Figure;
  size: Figure;
  growth_90d: Figure;
  emotion: Figure;
}
export interface Agent {
  id: string;
  label: string;
  kind: 'data' | 'risk' | 'perspective';
  findings: Figure[];
  reading: null | Figure;
  recommendation: null | Figure;
  score: null | Figure;
}
export interface ArtistDna {
  consistency: Figure;
  evolution: Figure;
  recurring_tribes: Figure;
  gaps: Figure;
  tracks: DnaTrack[];
}
export interface DnaTrack {
  track_id: string;
  title: string;
  analyzed_at: string;
  valence: number | null;
  arousal: number | null;
  quadrant: null | Quadrant;
}
