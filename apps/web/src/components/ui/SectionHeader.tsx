export function SectionHeader({
  n,
  title,
  subtitle,
  color = '#3fd0ff',
  children,
}: {
  n: number;
  title: string;
  subtitle?: string;
  color?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-4 flex flex-wrap items-center gap-3">
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-sm font-bold"
        style={{ borderColor: color, color, boxShadow: `0 0 14px ${color}55` }}
      >
        {n}
      </span>
      <div className="min-w-0">
        <h2 className="font-mono text-base font-semibold tracking-[0.28em] text-lab-text">{title}</h2>
        {subtitle && <p className="text-sm text-lab-dim">{subtitle}</p>}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
    </header>
  );
}
