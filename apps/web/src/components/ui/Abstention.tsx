export function Abstention({ missing, compact = false }: { missing: string[]; compact?: boolean }) {
  const reason = missing.join(' · ');
  return (
    <div
      className={`abstention min-w-0 rounded ${compact ? 'truncate px-2 py-1' : 'px-3 py-2'}`}
      role="note"
      title={reason}
      aria-label={`Abstención: ${reason}`}
    >
      <span className="font-mono text-[0.68rem] font-semibold tracking-[0.2em] text-lab-text/80">
        ABSTENCIÓN
      </span>
      <span className={`font-mono text-[0.66rem] text-lab-dim ${compact ? 'ml-2' : 'mt-0.5 block'}`}>
        {reason}
      </span>
    </div>
  );
}
