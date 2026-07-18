export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-bbl-card border border-bbl-border rounded-2xl shadow-xl shadow-black/30 ${className}`}
    >
      {children}
    </div>
  );
}
