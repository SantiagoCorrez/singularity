'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

type Phase = { kind: 'idle' } | { kind: 'working'; message: string } | { kind: 'error'; message: string };

// La subida va directa a la API, no por el proxy de Next: el proxy falla con WAV de decenas de MB.
// La API admite este origen por CORS (SINGULARITY_WEB_ORIGINS).
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8010';

const field ='mt-1 w-full rounded border border-lab-border bg-lab-bg px-3 py-2 text-sm text-lab-text focus:border-accent-cyan';

async function detail(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    return typeof body.detail === 'string' ? body.detail : fallback;
  } catch {
    return fallback;
  }
}

export default function UploadPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const cancelled = useRef(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const file = data.get('file');
    if (!(file instanceof File) || file.size === 0) {
      setPhase({ kind: 'error', message: 'Elige un archivo WAV.' });
      return;
    }
    cancelled.current = false;
    setPhase({ kind: 'working', message: 'Subiendo la pista…' });
    try {
      const res = await fetch(`${API_URL}/api/tracks`, { method: 'POST', body: data });
      if (!res.ok) {
        const fallback = res.status >= 500 ? 'No se pudo conectar con el servicio de análisis. Comprueba que la API está en marcha.' : 'No se pudo subir la pista.';
        setPhase({ kind: 'error', message: await detail(res, fallback) });
        return;
      }
      const { id } = (await res.json()) as { id: string };
      setPhase({ kind: 'working', message: 'Analizando el audio. Suele tardar menos de un minuto…' });
      for (let i = 0; i < 600 && !cancelled.current; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const st = await fetch(`${API_URL}/api/tracks/${id}`, { cache: 'no-store' });
        if (!st.ok) continue;
        const s = (await st.json()) as { status: string; error: string | null };
        if (s.status === 'done') {
          router.push(`/report/${id}`);
          return;
        }
        if (s.status === 'error') {
          setPhase({ kind: 'error', message: s.error ?? 'El análisis falló.' });
          return;
        }
      }
      if (!cancelled.current) setPhase({ kind: 'error', message: 'El análisis está tardando demasiado. Vuelve a intentarlo.' });
    } catch {
      setPhase({ kind: 'error', message: 'No se pudo conectar con el servicio de análisis.' });
    }
  }

  const working = phase.kind === 'working';
  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <p className="font-mono text-xs tracking-[0.4em] text-accent-cyan">SINGULARITY</p>
      <h1 className="mt-1 text-2xl font-semibold text-lab-text">Sube tu canción</h1>
      <p className="mt-2 text-sm text-lab-dim">
        Archivo WAV de entre 10 segundos y 15 minutos. El reporte solo muestra lo que se ha medido y calibrado; el resto
        aparece como abstención.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-lg border border-lab-border bg-lab-card p-5">
        <label className="block">
          <span className="label-mono">Archivo WAV</span>
          <input name="file" type="file" accept=".wav,audio/wav,audio/x-wav" required disabled={working} className={`${field} file:mr-3 file:rounded file:border-0 file:bg-accent-cyan/15 file:px-3 file:py-1 file:font-mono file:text-xs file:text-accent-cyan`} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label-mono">Título</span>
            <input name="title" type="text" maxLength={200} disabled={working} className={field} />
          </label>
          <label className="block">
            <span className="label-mono">Artista</span>
            <input name="artist" type="text" maxLength={200} disabled={working} className={field} />
          </label>
        </div>
        <label className="block">
          <span className="label-mono">Letra (opcional)</span>
          <textarea name="lyrics" rows={5} maxLength={20000} disabled={working} className={field} />
          <span className="mt-1 block text-[0.7rem] text-lab-dim">Separa las estrofas con una línea en blanco. Se analiza por estrofas y se compara con el audio.</span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={working} className="rounded border border-accent-cyan px-4 py-2 font-mono text-xs tracking-[0.16em] text-accent-cyan hover:bg-accent-cyan/15 disabled:opacity-50">
            {working ? 'ANALIZANDO…' : 'ANALIZAR'}
          </button>
          {working && (
            <button type="button" onClick={() => { cancelled.current = true; setPhase({ kind: 'idle' }); }} className="font-mono text-xs text-lab-dim underline">
              Dejar de esperar
            </button>
          )}
          <Link href="/report/demo" className="ml-auto font-mono text-xs text-lab-dim underline">Ver la demo</Link>
        </div>
        <p aria-live="polite" className={`min-h-5 font-mono text-xs ${phase.kind === 'error' ? 'text-accent-red' : 'text-lab-dim'}`}>
          {phase.kind !== 'idle' ? phase.message : ''}
        </p>
      </form>
    </main>
  );
}
