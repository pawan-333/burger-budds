export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Loading page" className="max-w-6xl mx-auto p-6 space-y-5">
      <p role="status" className="font-bold text-brand-secondary">Loading Burger Budds…</p>
      <div className="h-24 rounded-xl bg-brand-primary/20 animate-pulse motion-reduce:animate-none" />
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2">
        {[1, 2, 3, 4].map(item => (
          <div key={item} className="h-40 rounded-xl bg-surface-raised border border-border-subtle animate-pulse motion-reduce:animate-none" />
        ))}
      </div>
    </main>
  );
}
