import 'server-only';
import { generateRoast } from '@/domain/roast/RoastEngine';
import type { RoastContext } from '@/domain/roast/signals';
import type { Tone } from '@/domain/roast/tone';
import { matchRepository } from '@/infrastructure/repositories/matchRepository';
import {
  leaderboardRepository,
  predictionRepository,
} from '@/infrastructure/repositories/predictionRepository';
import { roastCacheRepository } from '@/infrastructure/repositories/supportRepositories';
import { claudeRoastEnricher } from '@/infrastructure/ai/claudeRoastEnricher';
import { isRoastAiEnabled } from '@/lib/env';

/**
 * Builds the greeting shown at the top of the home page.
 *
 * The deterministic generator always runs first, so there is always a message.
 * When an Anthropic key is configured the text is upgraded once per day per
 * user and cached; without a key nothing changes and nothing breaks.
 */
export interface RoastResult {
  readonly text: string;
  readonly tone: Tone;
  readonly aiGenerated: boolean;
}

export async function buildRoastContext(
  userId: string,
  nickname: string,
  seasonId: string,
): Promise<RoastContext> {
  const [entries, myEntry, predictions] = await Promise.all([
    leaderboardRepository.listBySeason(seasonId),
    leaderboardRepository.findByUser(seasonId, userId),
    predictionRepository.listByUserAndSeason(userId, seasonId),
  ]);

  const totalPlayers = Math.max(entries.length, 1);
  const rank = myEntry?.rank ?? totalPlayers;
  const points = myEntry?.points ?? 0;

  const leaderPoints = entries[0]?.points ?? 0;
  // The player directly ahead; for the leader there is none.
  const ahead = entries.filter((e) => e.rank < rank).at(-1);

  // Newest three scored predictions, ordered oldest-to-newest for the engine.
  const lastThree = predictions
    .filter((p) => p.score !== null)
    .slice(0, 3)
    .map((p) => p.score?.points ?? 0)
    .reverse();

  return {
    nickname,
    rank,
    totalPlayers,
    points,
    gapToLeader: Math.max(0, leaderPoints - points),
    gapToNext: ahead ? Math.max(0, ahead.points - points) : 0,
    lastThree,
    accuracyPct: myEntry?.accuracyPct ?? 0,
    scorelessStreak: myEntry && myEntry.currentStreak < 0 ? -myEntry.currentStreak : 0,
    hitStreak: myEntry && myEntry.currentStreak > 0 ? myEntry.currentStreak : 0,
    matchesPlayed: myEntry?.played ?? 0,
    rankDelta: 0,
  };
}

export async function getRoast(
  userId: string,
  nickname: string,
  seasonId: string,
  now: Date,
): Promise<RoastResult> {
  const context = await buildRoastContext(userId, nickname, seasonId);
  const generated = generateRoast(context, { userId, seasonId, now });

  if (!isRoastAiEnabled()) {
    return { text: generated.text, tone: generated.tone, aiGenerated: false };
  }

  const cached = await roastCacheRepository.find(userId, generated.contextHash, now);
  if (cached) {
    return { text: cached.text, tone: generated.tone, aiGenerated: true };
  }

  const enriched = await claudeRoastEnricher.enrich({
    nickname,
    tone: generated.tone,
    baseText: generated.text,
    rank: context.rank,
    totalPlayers: context.totalPlayers,
    points: context.points,
    gapToLeader: context.gapToLeader,
    accuracyPct: context.accuracyPct,
    scorelessStreak: context.scorelessStreak,
    hitStreak: context.hitStreak,
  });

  if (!enriched) {
    return { text: generated.text, tone: generated.tone, aiGenerated: false };
  }

  await roastCacheRepository.save({
    userId,
    seasonId,
    tone: generated.tone,
    text: enriched,
    source: 'AI',
    contextHash: generated.contextHash,
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
  });

  return { text: enriched, tone: generated.tone, aiGenerated: true };
}

/** Roast for the moment a match is about to lock, used in notifications. */
export async function getLockNudge(
  userId: string,
  nickname: string,
  seasonId: string,
  now: Date,
): Promise<string> {
  const context = await buildRoastContext(userId, nickname, seasonId);
  const [next] = await Promise.all([matchRepository.findNextOpen(seasonId, now)]);

  const roast = generateRoast(context, {
    userId,
    seasonId,
    now,
    variant: `lock:${next?.id ?? 'none'}`,
  });

  return roast.text;
}
