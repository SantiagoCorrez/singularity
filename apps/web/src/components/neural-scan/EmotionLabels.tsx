'use client';

import { useEffect, useMemo, useRef, type MutableRefObject, type RefObject } from 'react';
import type { ChannelSet } from '@/lib/channels';
import { usePlaybackEngine, usePlaybackState } from '@/lib/playback/usePlayback';
import { useReport } from '@/components/ReportContext';
import { DemoBadge, UncalibratedBadge, provenanceTitle } from '@/components/ui/ProvenanceChip';
import type { BrainScene } from './scene/createBrainScene';

const SLOT_TOP = ['16%', '44%', '72%'];

/**
 * Etiquetas laterales unidas con una línea fina a su zona del cerebro.
 * El lado de cada etiqueta se decide una vez, con la pose de reposo, y no cambia
 * con el balanceo: las etiquetas no saltan de lado.
 */
export function EmotionLabels({
  channelSet,
  sceneRef,
  ready,
  containerRef,
}: {
  channelSet: ChannelSet;
  sceneRef: MutableRefObject<BrainScene | null>;
  ready: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const { report } = useReport();
  const engine = usePlaybackEngine();
  const { windowIndex, started } = usePlaybackState();
  const { channels } = channelSet;

  const layout = useMemo(() => {
    const scene = ready ? sceneRef.current : null;
    const pts = channels.map((c, i) => ({ i, p: scene ? scene.projectRest(c.zone) : { x: i % 2, y: i } }));
    const byX = [...pts].sort((a, b) => a.p.x - b.p.x);
    const half = Math.ceil(byX.length / 2);
    const place = (group: typeof pts, side: 'left' | 'right') =>
      [...group].sort((a, b) => a.p.y - b.p.y).map((g, slot) => ({ i: g.i, side, slot }));
    return [...place(byX.slice(0, half), 'left'), ...place(byX.slice(half), 'right')].sort((a, b) => a.i - b.i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels, ready]);

  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);
  const dotRefs = useRef<(SVGCircleElement | null)[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    return engine.onFrame(() => {
      const scene = sceneRef.current;
      const box = containerRef.current;
      const svg = svgRef.current;
      if (!scene || !box || !svg || svg.clientWidth === 0) return;
      const origin = box.getBoundingClientRect();
      channels.forEach((c, i) => {
        const el = labelRefs.current[i];
        const line = lineRefs.current[i];
        const dot = dotRefs.current[i];
        const slot = layout[i];
        if (!el || !line || !dot || !slot) return;
        const r = el.getBoundingClientRect();
        const p = scene.project(c.zone);
        const x1 = (slot.side === 'left' ? r.right : r.left) - origin.left;
        const y1 = r.top + r.height / 2 - origin.top;
        line.setAttribute('x1', x1.toFixed(1));
        line.setAttribute('y1', y1.toFixed(1));
        line.setAttribute('x2', p.x.toFixed(1));
        line.setAttribute('y2', p.y.toFixed(1));
        dot.setAttribute('cx', p.x.toFixed(1));
        dot.setAttribute('cy', p.y.toFixed(1));
      });
    });
  }, [engine, channels, layout, sceneRef, containerRef]);

  return (
    <>
      <svg ref={svgRef} className="pointer-events-none absolute inset-0 hidden h-full w-full md:block" aria-hidden>
        {channels.map((c, i) => (
          <g key={c.key}>
            <line
              ref={(el) => void (lineRefs.current[i] = el)}
              stroke={c.color}
              strokeWidth={1}
              strokeOpacity={0.55}
            />
            <circle ref={(el) => void (dotRefs.current[i] = el)} r={3} fill={c.color} fillOpacity={0.9} />
          </g>
        ))}
      </svg>

      <ul className="relative z-10 grid grid-cols-2 gap-2 p-3 md:static md:block md:p-0" aria-label="Etiquetas de la escena">
        {channels.map((c, i) => {
          const slot = layout[i];
          return (
            <li
              key={c.key}
              className={`md:absolute ${slot.side === 'left' ? 'md:left-3' : 'md:right-3'}`}
              style={{ top: SLOT_TOP[slot.slot] ?? '50%' }}
            >
              <div
                ref={(el) => void (labelRefs.current[i] = el)}
                title={provenanceTitle(c.figure)}
                className="inline-block rounded border bg-lab-bg/80 px-2 py-1 backdrop-blur-sm"
                style={{ borderColor: `${c.color}88` }}
              >
                <div className="whitespace-nowrap font-mono text-[0.72rem] font-semibold tracking-[0.14em]" style={{ color: c.color }}>
                  {c.label.toUpperCase()} · {c.text(windowIndex, started)}
                </div>
                <div className="mt-0.5 flex items-center gap-1">
                  <span className="font-mono text-[0.58rem] text-lab-dim">{c.figure.status}</span>
                  {c.verdict.kind === 'uncalibrated' && <UncalibratedBadge />}
                  {report.demo && <DemoBadge />}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
