import { z } from 'zod';
import type { PollHint } from '@/domain/match/pollHint';

export interface LeaderboardRowDto {
  readonly userId: string;
  readonly nickname: string;
  readonly rank: number;
  readonly points: number;
  readonly exactHits: number;
  readonly played: number;
  readonly accuracyPct: number;
  readonly avgPoints: number;
  readonly currentStreak: number;
  readonly bestStreak: number;
  readonly lastPredictionAt: string | null;
  readonly isCurrentUser: boolean;
}

export interface LeaderboardDto {
  readonly seasonId: string;
  readonly seasonName: string;
  readonly rows: readonly LeaderboardRowDto[];
  readonly updatedAt: string;
  readonly pollHint: PollHint;
}

export interface UserStatsDto {
  readonly userId: string;
  readonly nickname: string;
  readonly rank: number;
  readonly totalPlayers: number;
  readonly points: number;
  readonly played: number;
  readonly missed: number;
  readonly exactHits: number;
  readonly accuracyPct: number;
  readonly avgPoints: number;
  readonly currentStreak: number;
  readonly bestStreak: number;
  readonly worstStreak: number;
  readonly progression: readonly {
    readonly matchId: string;
    readonly label: string;
    readonly kickoffAt: string;
    readonly points: number;
    readonly cumulative: number;
  }[];
  readonly achievements: readonly {
    readonly code: string;
    readonly name: string;
    readonly description: string;
    readonly icon: string;
    readonly tier: string;
    readonly unlockedAt: string | null;
  }[];
}

export const seasonIdSchema = z.object({ seasonId: z.string().min(1) });
