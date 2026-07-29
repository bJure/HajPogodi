import { getRoast } from '@/application/services/roastService';
import { TONE_LABELS } from '@/domain/roast/tone';

/**
 * The greeting at the top of the home page.
 *
 * Rendered in its own async component so it can be wrapped in Suspense: the
 * optional AI call must never hold up the rest of the page.
 */
export async function RoastBanner({
  userId,
  nickname,
  seasonId,
}: {
  userId: string;
  nickname: string;
  seasonId: string;
}) {
  const roast = await getRoast(userId, nickname, seasonId, new Date());

  return (
    <div className="glass relative overflow-hidden rounded-[--radius-card] p-5 sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-hajduk-red/20 blur-3xl"
      />

      <div className="relative">
        <div className="mb-2 flex items-center gap-2">
          <span aria-hidden className="text-lg">
            🎙️
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-hajduk-red-soft">
            {TONE_LABELS[roast.tone]}
          </span>
        </div>

        <p className="text-balance text-lg font-medium leading-snug text-ink sm:text-xl">
          {roast.text}
        </p>
      </div>
    </div>
  );
}

/** Shown while the roast resolves - same shape, so nothing jumps. */
export function RoastBannerSkeleton() {
  return (
    <div className="glass rounded-[--radius-card] p-5 sm:p-6">
      <div className="mb-3 h-3 w-24 rounded bg-white/10" />
      <div className="space-y-2">
        <div className="h-5 w-full rounded bg-white/10" />
        <div className="h-5 w-3/4 rounded bg-white/10" />
      </div>
    </div>
  );
}
