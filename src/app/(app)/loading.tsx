/**
 * Navigation feedback for the player-facing pages.
 *
 * Every page here is `force-dynamic` and reads the database on each request, so
 * a click costs a full server round trip - well over a second once Neon has
 * scaled to zero and has to wake up. Without a loading boundary the App Router
 * keeps the previous page on screen for that whole time and the interface looks
 * frozen; with one, the click registers instantly.
 */
export default function Loading() {
  return (
    <div className="animate-[--animate-fade-up] space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Učitavam…</span>

      <div className="glass h-40 rounded-2xl">
        <div className="flex h-full flex-col justify-center gap-4 px-5">
          <div className="h-3 w-24 animate-pulse rounded-full bg-white/10" />
          <div className="flex items-center justify-center gap-6">
            <div className="h-14 w-14 animate-pulse rounded-2xl bg-white/10" />
            <div className="h-4 w-8 animate-pulse rounded-full bg-white/5" />
            <div className="h-14 w-14 animate-pulse rounded-2xl bg-white/10" />
          </div>
        </div>
      </div>

      <div className="glass space-y-3 rounded-2xl p-5">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded-full bg-white/10" />
            <div className="h-3 flex-1 animate-pulse rounded-full bg-white/5" />
            <div className="h-3 w-10 animate-pulse rounded-full bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  );
}
