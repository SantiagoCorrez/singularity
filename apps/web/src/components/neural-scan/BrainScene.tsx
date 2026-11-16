'use client';

import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { ChannelSet } from '@/lib/channels';
import { bandsAt, energyAt } from '@/lib/playback/energy';
import { usePlaybackEngine } from '@/lib/playback/usePlayback';
import { useReport } from '@/components/ReportContext';
import { createBrainScene, type BrainScene as Scene } from './scene/createBrainScene';
import { FpsBudget, MAX_PARTICLES } from './usePerformanceBudget';

export type SceneStats = { count: number; fps: number };

/** Lienzo WebGL del cerebro. Lee el tiempo del reloj único en cada frame. */
export function BrainScene({
  channelSet,
  reducedMotion,
  sceneRef,
  onReady,
  onStats,
}: {
  channelSet: ChannelSet;
  reducedMotion: boolean;
  sceneRef: MutableRefObject<Scene | null>;
  onReady: (ready: boolean) => void;
  onStats: (s: SceneStats) => void;
}) {
  const { report, judge } = useReport();
  const engine = usePlaybackEngine();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dirty = useRef(true);
  const [failed, setFailed] = useState(false);

  // La escena se crea una vez.
  useEffect(() => {
    const canvas = canvasRef.current!;
    let scene: Scene;
    try {
      scene = createBrainScene(canvas, MAX_PARTICLES);
    } catch {
      setFailed(true);
      return;
    }
    sceneRef.current = scene;
    const ro = new ResizeObserver(() => {
      scene.resize(canvas.clientWidth, canvas.clientHeight);
      dirty.current = true;
    });
    ro.observe(canvas);
    scene.resize(canvas.clientWidth, canvas.clientHeight);
    onReady(true);
    return () => {
      ro.disconnect();
      onReady(false);
      sceneRef.current = null;
      scene.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const { channels } = channelSet;
    scene.setChannels(channels);
    dirty.current = true;

    const env = report.envelope;
    const energyOk = judge(report.series.energy).kind !== 'abstain';
    const budget = new FpsBudget(MAX_PARTICLES);
    scene.setCount(budget.count);
    onStats({ count: budget.count, fps: budget.fps });
    const intensities = new Array<number>(channels.length).fill(0);
    let lastKey = '';

    return engine.onFrame((t, s) => {
      // Brillo de cada zona = valor de la dimensión × energía del audio en este instante.
      // Antes de reproducir se usa un nivel de reposo fijo para que la escena sea legible.
      if (reducedMotion) {
        // Escena estática: solo se redibuja cuando cambia la ventana.
        const key = `${s.started}:${s.windowIndex}`;
        if (key === lastKey && !dirty.current) return;
        lastKey = key;
        const w = report.windows[s.windowIndex];
        const e = !s.started || !energyOk ? 0.75 : w.energy;
        const tc = (w.t0 + w.t1) / 2;
        for (let i = 0; i < channels.length; i++) intensities[i] = channels[i].norm(tc) * e;
        scene.render({ time: 0, pulse: 0, intensities, animate: false });
        dirty.current = false;
        return;
      }
      const e = !s.started || !energyOk ? 0.75 : energyAt(env, t);
      for (let i = 0; i < channels.length; i++) intensities[i] = channels[i].norm(t) * e;
      let pulse = 0;
      if (s.playing && energyOk) {
        const b = bandsAt(env, t);
        pulse = b.low * 0.6 + energyAt(env, t) * 0.4;
      }
      const now = performance.now();
      scene.render({ time: now / 1000, pulse, intensities, animate: true });
      if (budget.tick(now)) {
        scene.setCount(budget.count);
        onStats({ count: budget.count, fps: budget.fps });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelSet, reducedMotion, report, engine, failed]);

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
      {failed && (
        <p className="absolute inset-0 flex items-center justify-center p-6 text-center font-mono text-xs text-lab-dim">
          Este navegador no pudo iniciar WebGL. Los mismos datos están en la tabla alternativa, más abajo.
        </p>
      )}
    </>
  );
}
