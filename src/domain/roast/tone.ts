import type { RoastSignals } from './signals';

/**
 * The eight voices the roast engine speaks in. Order of the rules below is the
 * priority order: the first match wins, so the most interesting situation
 * (a rookie, a collapse, a hot streak) always beats the generic bucket.
 */
export const TONES = [
  'ROOKIE',
  'KING',
  'CHASER',
  'HOT',
  'SLUMP',
  'BASEMENT',
  'MEDIOCRE',
  'CLIMBER',
] as const;

export type Tone = (typeof TONES)[number];

export function pickTone(signals: RoastSignals): Tone {
  if (signals.isRookie) return 'ROOKIE';
  if (signals.position === 'LEADER') return 'KING';
  if (signals.form === 'FROZEN' || (signals.position === 'LAST' && signals.form === 'COLD')) {
    return 'BASEMENT';
  }
  if (signals.form === 'ON_FIRE') return 'HOT';
  if (signals.form === 'COLD') return 'SLUMP';
  if (signals.justClimbed) return 'CLIMBER';
  if (signals.position === 'PODIUM' || signals.breathingDownNeck) return 'CHASER';
  if (signals.position === 'LAST') return 'BASEMENT';
  return 'MEDIOCRE';
}

export const TONE_LABELS: Record<Tone, string> = {
  ROOKIE: 'Novajlija',
  KING: 'Kralj',
  CHASER: 'Progonitelj',
  HOT: 'U naletu',
  SLUMP: 'Kriza',
  BASEMENT: 'Podrum',
  MEDIOCRE: 'Prosjek',
  CLIMBER: 'Penjač',
};
