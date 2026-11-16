// Cerebro procedimental en nube de puntos: dos hemisferios separados por la cisura,
// surcos, lóbulos temporales, cerebelo y tronco. Es el sustituto provisional de una
// malla de dominio público; produce los mismos atributos que produciría el muestreo
// de una malla, así que cambiarlo no afecta al resto de la escena.
import { ZONE_COUNT, ZONE_DIRECTIONS } from './zones';

export type BrainCloud = {
  count: number;
  position: Float32Array;
  /** 0 = fondo de surco, 1 = cresta de giro. */
  bright: Float32Array;
  /** Índice de la zona ilustrativa más cercana. */
  zone: Float32Array;
  /** Peso de la zona (decae con la distancia a su centro). 0 fuera del cerebro. */
  zoneW: Float32Array;
  seed: Float32Array;
  /** Centro de cada zona sobre la superficie (x, y, z por zona). */
  anchors: Float32Array;
};

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

const Y_SHIFT = 0.14;

/** Dirección unitaria → punto en la superficie de un hemisferio. */
function cerebrum(dx: number, dy: number, dz: number): [number, number, number] {
  const side = dx < 0 ? -1 : 1;
  let x = Math.abs(dx) * 0.66;
  let y = dy * 0.58;
  const z = dz * 0.9;
  x *= 1 - 0.14 * dz; // frente más estrecho que la nuca
  if (y < -0.22) y = -0.22 + (y + 0.22) * 0.4; // base aplanada
  if (dy > 0) y -= Math.exp(-(x * x) / 0.012) * 0.08; // la cisura se hunde por arriba
  return [side * (x + 0.035), y + Y_SHIFT, z];
}

/** Campo de pliegues: |g| pequeño = surco. */
function fold(x: number, y: number, z: number): number {
  const f = 8.5;
  const wx = x + 0.08 * Math.sin(y * 7 + z * 3);
  const wy = y + 0.08 * Math.sin(z * 6 + x * 4);
  const wz = z + 0.08 * Math.sin(x * 5 + y * 6);
  const g =
    Math.sin(f * wx) * Math.cos(f * wy) + Math.sin(f * wy) * Math.cos(f * wz) + Math.sin(f * wz) * Math.cos(f * wx);
  return Math.min(1, Math.abs(g) / 0.55);
}

export function sampleBrain(count: number, seed = 7): BrainCloud {
  const rnd = mulberry32(seed);
  const position = new Float32Array(count * 3);
  const bright = new Float32Array(count);
  const zone = new Float32Array(count);
  const zoneW = new Float32Array(count);
  const seeds = new Float32Array(count);

  const anchors = new Float32Array(ZONE_COUNT * 3);
  ZONE_DIRECTIONS.forEach(([x, y, z], i) => {
    const l = Math.hypot(x, y, z);
    anchors.set(cerebrum(x / l, y / l, z / l), i * 3);
  });

  const dir = (): [number, number, number] => {
    const u = rnd() * 2 - 1;
    const a = rnd() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    return [s * Math.cos(a), u, s * Math.sin(a)];
  };

  let i = 0;
  while (i < count) {
    const part = rnd();
    let x: number, y: number, z: number, b: number;
    let cortex = false;

    if (part < 0.8) {
      const [dx, dy, dz] = dir();
      if (part < 0.72) {
        [x, y, z] = cerebrum(dx, dy, dz);
      } else {
        // lóbulo temporal
        const side = dx < 0 ? -1 : 1;
        x = side * (0.45 + Math.abs(dx) * 0.2);
        y = -0.2 + Y_SHIFT + dy * 0.16;
        z = 0.16 + dz * 0.42;
      }
      const ridge = fold(x, y, z);
      if (ridge < 0.3 && rnd() < 0.65) continue; // menos puntos en el fondo del surco
      const shell = rnd() ** 3; // la mayoría en la superficie, algunos dentro
      const k = 1 - 0.05 * (1 - ridge) - shell * 0.14;
      const cy = Y_SHIFT - 0.05;
      x *= k;
      y = cy + (y - cy) * k;
      z *= k;
      b = (0.2 + 0.8 * ridge ** 1.5) * (1 - shell * 0.6);
      cortex = true;
    } else if (part < 0.94) {
      // cerebelo, con estrías horizontales
      const [dx, dy, dz] = dir();
      const k = 1 - rnd() ** 3 * 0.2;
      x = dx * 0.42 * k + (dx < 0 ? -0.012 : 0.012);
      y = -0.36 + dy * 0.2 * k;
      z = -0.55 + dz * 0.27 * k;
      b = 0.3 + 0.55 * (0.5 + 0.5 * Math.sin(y * 95 + z * 18));
    } else {
      // tronco encefálico
      const s = rnd();
      const a = rnd() * Math.PI * 2;
      const r = (0.1 - 0.035 * s) * Math.sqrt(0.6 + 0.4 * rnd());
      x = Math.cos(a) * r;
      y = -0.3 - 0.66 * s;
      z = -0.28 - 0.13 * s + Math.sin(a) * r;
      b = 0.35 + 0.2 * rnd();
    }

    position[i * 3] = x;
    position[i * 3 + 1] = y;
    position[i * 3 + 2] = z;
    bright[i] = b;
    seeds[i] = rnd();

    if (cortex) {
      let best = 0;
      let bestD = Infinity;
      for (let zi = 0; zi < ZONE_COUNT; zi++) {
        const d = Math.hypot(x - anchors[zi * 3], y - anchors[zi * 3 + 1], z - anchors[zi * 3 + 2]);
        if (d < bestD) {
          bestD = d;
          best = zi;
        }
      }
      zone[i] = best;
      zoneW[i] = Math.exp(-((bestD / 0.36) ** 2));
    }
    i++;
  }

  return { count, position, bright, zone, zoneW, seed: seeds, anchors };
}
