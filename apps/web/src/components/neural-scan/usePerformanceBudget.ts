// Presupuesto de rendimiento: si la escena no sostiene ~60 fps, reduce partículas.
export const MAX_PARTICLES = 45000;
export const MIN_PARTICLES = 12000;

export class FpsBudget {
  count: number;
  fps = 60;
  private frames = 0;
  private elapsed = 0;
  private last = 0;

  constructor(initial = MAX_PARTICLES) {
    this.count = initial;
  }

  /** Llamar una vez por frame dibujado. Devuelve true si cambió count o fps. */
  tick(nowMs: number): boolean {
    const dt = nowMs - this.last;
    this.last = nowMs;
    // Un hueco largo significa pestaña oculta o un salto, no un equipo lento: se descarta.
    if (dt <= 0 || dt > 250) {
      this.frames = 0;
      this.elapsed = 0;
      return false;
    }
    this.frames++;
    this.elapsed += dt;
    if (this.elapsed < 2000) return false;
    this.fps = Math.round((this.frames * 1000) / this.elapsed);
    this.frames = 0;
    this.elapsed = 0;
    if (this.fps < 50 && this.count > MIN_PARTICLES) {
      this.count = Math.max(MIN_PARTICLES, Math.floor(this.count * 0.75));
    }
    return true;
  }
}
