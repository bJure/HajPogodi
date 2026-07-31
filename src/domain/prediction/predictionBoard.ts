/**
 * Tko je što upisao za jednu odigranu utakmicu.
 *
 * Popis kreće od igrača, ne od prognoza: tko nije glasao mora se vidjeti kao
 * praznina, a ne nestati iz liste. Zato je ulaz par (aktivni igrači, prognoze),
 * a ne samo prognoze.
 */

/** Aktivan igrač. Strukturalno - `UserRow` zadovoljava oblik. */
export interface BoardPlayer {
  readonly id: string;
  readonly nickname: string;
}

/** Jedna prognoza za tu utakmicu. Strukturalno - `PredictionDto` zadovoljava oblik. */
export interface BoardPrediction {
  readonly userId: string;
  readonly homeGoals: number;
  readonly awayGoals: number;
  readonly points: number | null;
}

export interface BoardEntry {
  readonly userId: string;
  readonly nickname: string;
  readonly prediction: { readonly homeGoals: number; readonly awayGoals: number } | null;
  readonly hit: boolean;
}

export function buildPredictionBoard(
  users: readonly BoardPlayer[],
  predictions: readonly BoardPrediction[],
): BoardEntry[] {
  const byUser = new Map(predictions.map((p) => [p.userId, p] as const));

  const entries: BoardEntry[] = users.map((user) => {
    const prediction = byUser.get(user.id);

    return {
      userId: user.id,
      nickname: user.nickname,
      prediction: prediction
        ? { homeGoals: prediction.homeGoals, awayGoals: prediction.awayGoals }
        : null,
      // `exact-score` je jedino aktivno pravilo, pa je svaki bod pogodak.
      hit: (prediction?.points ?? 0) > 0,
    };
  });

  /*
   * Redoslijed, od najznačajnijeg:
   *   1. pogodak      - tko je pogodio stoji na vrhu
   *   2. ima prognozu - "nema prognoze" nije promašaj i ne miješa se s njim
   *   3. nadimak      - deterministično, pa dva poziva nad istim podacima daju
   *                     identičan poredak
   */
  return entries.sort(
    (a, b) =>
      Number(b.hit) - Number(a.hit) ||
      Number(b.prediction !== null) - Number(a.prediction !== null) ||
      a.nickname.localeCompare(b.nickname, 'hr'),
  );
}
