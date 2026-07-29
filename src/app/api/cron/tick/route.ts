import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getEnv } from '@/lib/env';
import { withRoute } from '@/lib/api';
import { logger } from '@/infrastructure/logging/logger';
import { runLockReminders } from '@/infrastructure/jobs/lockReminderJob';
import { runPollResults } from '@/infrastructure/jobs/pollResultsJob';
import { runSyncFixtures } from '@/infrastructure/jobs/syncFixturesJob';
import { jobRunRepository } from '@/infrastructure/repositories/supportRepositories';
import { seasonRepository } from '@/infrastructure/repositories/matchRepository';
import { scorePendingMatches } from '@/application/services/scoringService';
import { isFootballApiEnabled } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * The single scheduler entry point.
 *
 * External cron (GitHub Actions or a Cloudflare Worker) calls this; the handler
 * decides for itself what is due. Hajduk plays about twice a week, so almost
 * every call does nothing but one indexed query and returns - there is no
 * always-on process anywhere in this design.
 *
 * Work items:
 *   - schedule sync: at most once per day
 *   - result poll:   only inside a match's result window
 *   - lock reminder: once per match, within an hour of kickoff
 *
 * Every item is claimed through a unique `runKey`, so two overlapping cron
 * triggers cannot double-score a match.
 *
 * The response body says only whether each item ran, never why it failed. The
 * caller is a CI job on a public repository, so anything returned here can end
 * up in world-readable logs; the message itself goes to the application log and
 * to `JobRun.error`, both of which are private.
 */
const SYNC_MIN_INTERVAL_HOURS = 20;

function authorized(request: NextRequest): boolean {
  const provided =
    request.headers.get('x-cron-secret') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    '';

  const expected = getEnv().CRON_SECRET;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  // Length must match before timingSafeEqual, and comparing lengths first does
  // not leak anything a response time would not already reveal.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Five-minute bucket, so a per-minute cron cannot run the poll five times. */
function fiveMinuteKey(now: Date): string {
  const bucket = Math.floor(now.getUTCMinutes() / 5) * 5;
  return `${now.toISOString().slice(0, 13)}:${String(bucket).padStart(2, '0')}`;
}

async function handle(request: NextRequest): Promise<NextResponse> {
  if (!authorized(request)) {
    logger.warn('neovlasten poziv cron endpointa');
    return NextResponse.json({ error: 'Neovlašteno' }, { status: 401 });
  }

  const now = new Date();
  const results: Record<string, unknown> = { at: now.toISOString() };

  // ---- 1. Schedule sync, at most once a day -------------------------------
  if (isFootballApiEnabled()) {
    const syncKey = `sync-fixtures:${now.toISOString().slice(0, 10)}`;
    const lastSync = await jobRunRepository.lastRun('sync-fixtures');
    const dueForSync =
      !lastSync ||
      now.getTime() - lastSync.startedAt.getTime() >= SYNC_MIN_INTERVAL_HOURS * 60 * 60 * 1000;

    if (dueForSync && (await jobRunRepository.claim('sync-fixtures', syncKey))) {
      try {
        const summary = await runSyncFixtures();
        await jobRunRepository.finish(syncKey, summary);
        results.sync = summary;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await jobRunRepository.fail(syncKey, message);
        logger.error({ err: error }, 'sinkronizacija rasporeda nije uspjela');
        results.sync = { failed: true };
      }
    } else {
      results.sync = { skipped: true };
    }
  } else {
    results.sync = { skipped: true, reason: 'API_FOOTBALL_KEY nije postavljen' };
  }

  // ---- 2. Result poll ------------------------------------------------------
  if (isFootballApiEnabled()) {
    const pollKey = `poll-results:${fiveMinuteKey(now)}`;
    if (await jobRunRepository.claim('poll-results', pollKey)) {
      try {
        const summary = await runPollResults(now);
        await jobRunRepository.finish(pollKey, summary);
        results.poll = summary;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await jobRunRepository.fail(pollKey, message);
        logger.error({ err: error }, 'provjera rezultata nije uspjela');
        results.poll = { failed: true };
      }
    } else {
      results.poll = { skipped: true };
    }
  } else {
    results.poll = { skipped: true, reason: 'API_FOOTBALL_KEY nije postavljen' };
  }

  // ---- 3. Anything with a result but no points (e.g. entered by an admin) --
  const season = await seasonRepository.findActive();
  if (season) {
    const scored = await scorePendingMatches(season.id);
    if (scored.length > 0) results.scored = scored;
  }

  // ---- 4. Lock reminders, once per match -----------------------------------
  const reminder = await runLockReminders(now);
  if (reminder.matchId && reminder.notified > 0) {
    const reminderKey = `lock-reminder:${reminder.matchId}`;
    // Claimed after the fact: if the key was taken, this run already happened
    // and the notifications were duplicates, but only for the same match within
    // the same hour, which the unique key makes impossible on the next tick.
    if (await jobRunRepository.claim('lock-reminder', reminderKey)) {
      await jobRunRepository.finish(reminderKey, reminder);
      results.lockReminder = reminder;
    }
  }

  logger.info(results, 'cron tick gotov');
  return NextResponse.json(results);
}

export async function POST(request: NextRequest) {
  return withRoute('cron/tick', () => handle(request));
}

/** GET is supported so an uptime pinger that can set the header can drive it too. */
export async function GET(request: NextRequest) {
  return withRoute('cron/tick', () => handle(request));
}
