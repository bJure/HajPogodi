/** Same reasoning as the player-facing boundary: admin pages are dynamic too. */
export default function Loading() {
  return (
    <div className="animate-[--animate-fade-up] space-y-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Učitavam…</span>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((tile) => (
          <div key={tile} className="glass h-20 animate-pulse rounded-xl bg-white/5" />
        ))}
      </div>

      <div className="glass space-y-3 rounded-2xl p-5">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="h-3 w-full animate-pulse rounded-full bg-white/5" />
        ))}
      </div>
    </div>
  );
}
