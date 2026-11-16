'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import type { Figure, Report } from '@/types/report';
import { evaluate, type Verdict } from '@/lib/provenance';

type Ctx = {
  report: Report;
  devMode: boolean;
  setDevMode: (v: boolean) => void;
  /** Aplica la regla de abstención con el modo actual. */
  judge: (f: Figure | null | undefined) => Verdict;
};

const ReportCtx = createContext<Ctx | null>(null);

export function ReportProvider({ report, children }: { report: Report; children: React.ReactNode }) {
  const [devMode, setDevMode] = useState(false);
  const value = useMemo<Ctx>(
    () => ({ report, devMode, setDevMode, judge: (f) => evaluate(f, { devMode }) }),
    [report, devMode],
  );
  return <ReportCtx.Provider value={value}>{children}</ReportCtx.Provider>;
}

export function useReport(): Ctx {
  const ctx = useContext(ReportCtx);
  if (!ctx) throw new Error('useReport fuera de ReportProvider');
  return ctx;
}
