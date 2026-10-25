export default function BookingLoading() {
  return (
    <main className="mx-auto max-w-xl px-4 py-10 sm:py-16" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="h-9 w-64 animate-pulse rounded-lg bg-surface" />
      <div className="mt-10 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-surface" />
        ))}
      </div>
    </main>
  );
}
