// METÁFORA VISUAL. Estas zonas reparten las etiquetas por la superficie del cerebro para
// que se lean bien; NO son un mapa neurocientífico ni afirman que una emoción "active"
// una región concreta.
// Ejes del modelo: x = izquierda(−)/derecha(+), y = arriba, z = frente(+)/nuca(−).

export const ZONE_DIRECTIONS: [number, number, number][] = [
  [0.35, 0.35, 0.75], // 0
  [-0.35, 0.35, 0.75], // 1
  [0.4, 0.8, 0.3], // 2
  [-0.4, 0.8, 0.3], // 3
  [-0.9, -0.1, 0.2], // 4
  [0.9, -0.1, 0.2], // 5
  [-0.5, 0.75, -0.35], // 6
  [0.5, 0.75, -0.35], // 7
  [-0.85, 0.2, -0.4], // 8
  [0.4, 0.25, -0.85], // 9
  [0.85, 0.3, 0.35], // 10
  [-0.4, 0.25, -0.85], // 11
  [0.85, 0.2, -0.4], // 12
];

export const ZONE_COUNT = ZONE_DIRECTIONS.length;

export const DIMENSION_ZONE: Record<string, number> = {
  poder: 0,
  rebeldia: 1,
  tension: 2,
  ansiedad: 3,
  tristeza: 4,
  nostalgia: 5,
  ternura: 6,
  belleza: 7,
  erotismo: 8,
  ensonacion: 9,
  triunfo: 10,
  diversion: 11,
  asombro: 12,
};

/** Zonas para los 6 descriptores cuando las emociones están en abstención. */
export const DESCRIPTOR_ZONES = [10, 1, 7, 4, 2, 11];
