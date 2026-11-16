import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ReportView } from '@/components/ReportView';
import { validateReport } from '@/lib/validate';

export const dynamic = 'force-dynamic';

const DEMO_REPORTS: Record<string, string> = {
  demo: 'report.demo.json',
  abstention: 'report.abstention.json',
};
const API_URL = process.env.API_URL ?? 'http://127.0.0.1:8010';

function Problem({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="font-mono text-lg text-accent-red">{title}</h1>
      <div className="mt-2 text-sm text-lab-dim">{children}</div>
      <Link href="/upload" className="mt-6 inline-block font-mono text-xs text-accent-cyan underline">Subir un WAV</Link>
    </main>
  );
}

async function loadRaw(id: string): Promise<{ raw: unknown } | { problem: string }> {
  if (DEMO_REPORTS[id]) {
    return { raw: JSON.parse(await readFile(join(process.cwd(), 'public', 'demo', DEMO_REPORTS[id]), 'utf8')) };
  }
  if (!/^[a-f0-9]{12}$/.test(id)) notFound();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/tracks/${id}/report`, { cache: 'no-store' });
  } catch {
    return { problem: 'No se pudo conectar con el servicio de análisis. Comprueba que la API está en marcha.' };
  }
  if (res.status === 404) notFound();
  if (res.status === 409) return { problem: 'El análisis de esta pista aún no ha terminado. Vuelve a cargar en unos segundos.' };
  if (!res.ok) return { problem: `El servicio de análisis respondió con un error (${res.status}).` };
  return { raw: await res.json() };
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadRaw(id);
  if ('problem' in loaded) return <Problem title="El reporte no está disponible">{loaded.problem}</Problem>;

  const res = validateReport(loaded.raw);
  if (!res.ok) {
    return (
      <Problem title="El reporte no valida contra el esquema">
        <p>No se muestra ninguna cifra de un reporte inválido.</p>
        <ul className="mt-4 list-disc pl-5 font-mono text-xs text-lab-text">
          {res.errors.slice(0, 20).map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      </Problem>
    );
  }
  return <ReportView report={res.report} id={id} />;
}
