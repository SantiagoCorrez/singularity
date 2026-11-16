export function Card({
  title,
  aside,
  children,
  className = '',
}: {
  title?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-lab-border bg-lab-card p-4 ${className}`}>
      {title && (
        <header className="mb-3 flex items-center justify-between gap-2">
          <h3 className="label-mono !text-lab-text/80">{title}</h3>
          {aside}
        </header>
      )}
      {children}
    </section>
  );
}
