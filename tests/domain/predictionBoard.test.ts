import { describe, expect, it } from 'vitest';
import {
  buildPredictionBoard,
  type BoardPlayer,
  type BoardPrediction,
} from '@/domain/prediction/predictionBoard';

function player(id: string, nickname: string): BoardPlayer {
  return { id, nickname };
}

function prediction(
  userId: string,
  homeGoals: number,
  awayGoals: number,
  points: number | null,
): BoardPrediction {
  return { userId, homeGoals, awayGoals, points };
}

describe('ploca prognoza', () => {
  it('igraca bez prognoze zadrzava u listi, na dnu', () => {
    // Tko nije glasao mora se vidjeti - inace nitko ne zna da je preskocio kolo -
    // ali ne smije stajati medju onima koji su promasili.
    const board = buildPredictionBoard(
      [player('u1', 'Kicma'), player('u2', 'Torcida')],
      [prediction('u2', 2, 1, 0)],
    );

    expect(board.map((entry) => entry.nickname)).toEqual(['Torcida', 'Kicma']);
    expect(board[1]).toMatchObject({ prediction: null, hit: false });
  });

  it('pogodak dize igraca iznad promasaja bez obzira na abecedu', () => {
    // Poredak nagraduje pogodak; da sortira samo po nadimku, 'Ante' bi bio prvi.
    const board = buildPredictionBoard(
      [player('u1', 'Ante'), player('u2', 'Zvone')],
      [prediction('u1', 0, 3, 0), prediction('u2', 4, 0, 1)],
    );

    expect(board.map((entry) => entry.nickname)).toEqual(['Zvone', 'Ante']);
    expect(board.map((entry) => entry.hit)).toEqual([true, false]);
  });

  it('unutar iste grupe sortira po hrvatskoj abecedi', () => {
    const board = buildPredictionBoard(
      [player('u1', 'Zoran'), player('u2', 'Cavo'), player('u3', 'Ćiro')],
      [prediction('u1', 1, 1, 0), prediction('u2', 1, 1, 0), prediction('u3', 1, 1, 0)],
    );

    expect(board.map((entry) => entry.nickname)).toEqual(['Cavo', 'Ćiro', 'Zoran']);
  });

  it('ignorira prognozu igraca kojeg nema medju aktivnima', () => {
    // Deaktivirani korisnik ne smije iskrsnuti u listi samo zato sto je nekad glasao.
    const board = buildPredictionBoard(
      [player('u1', 'Torcida')],
      [prediction('u1', 4, 0, 1), prediction('deaktiviran', 9, 9, 0)],
    );

    expect(board.map((entry) => entry.userId)).toEqual(['u1']);
  });

  it('bez bodova (utakmica jos nije bodovana) tretira prognozu kao promasaj', () => {
    // `points: null` znaci "jos nije obracunato", ne "pogodio" - zeleno se pali
    // tek kad bodovanje potvrdi pogodak.
    const board = buildPredictionBoard([player('u1', 'Torcida')], [prediction('u1', 4, 0, null)]);

    expect(board[0]).toMatchObject({ prediction: { homeGoals: 4, awayGoals: 0 }, hit: false });
  });
});
