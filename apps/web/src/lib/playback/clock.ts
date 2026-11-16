// Reloj único de reproducción. Todas las vistas leen el tiempo de aquí, en cada frame.
// El currentTime del elemento de audio puede avanzar a saltos; entre saltos se
// extrapola con performance.now(), y nunca se aleja más de 100 ms del valor real.
export class PlaybackClock {
  private anchorMedia = 0;
  private anchorPerf = 0;
  private lastMedia = -1;

  constructor(private audio: HTMLAudioElement) {}

  now(): number {
    const a = this.audio;
    const media = a.currentTime;
    const perf = performance.now();
    if (media !== this.lastMedia) {
      this.lastMedia = media;
      this.anchorMedia = media;
      this.anchorPerf = perf;
    }
    if (a.paused || a.ended || a.seeking) return media;
    const guess = this.anchorMedia + ((perf - this.anchorPerf) / 1000) * a.playbackRate;
    return Math.min(guess, media + 0.1);
  }
}
