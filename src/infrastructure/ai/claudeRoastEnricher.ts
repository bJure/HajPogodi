import 'server-only';
import type { RoastEnricherPort } from '@/application/ports/services';
import { getEnv, isRoastAiEnabled } from '@/lib/env';
import { logger } from '@/infrastructure/logging/logger';

/**
 * Optional Claude layer over the deterministic roast.
 *
 * The engine already produces unlimited messages offline and for free; this
 * only makes the phrasing feel hand-written. It therefore fails soft by
 * contract - any error, timeout or missing key returns null and the caller
 * keeps the generated text. The app is fully functional with no API key.
 *
 * Prompt shape follows the WorldCup project's daily-roast function: JSON-only
 * response, Croatian café-banter tone, playful rather than mean.
 */
const MODEL = 'claude-haiku-4-5-20251001';
const TIMEOUT_MS = 6000;

export const claudeRoastEnricher: RoastEnricherPort = {
  async enrich(input) {
    if (!isRoastAiEnabled()) return null;

    const prompt = `Ti si duhoviti hrvatski sportski komentator koji zafrkava prijatelja u aplikaciji za prognoziranje rezultata Hajduka.

Podaci o igraču:
- nadimak: ${input.nickname}
- mjesto na ljestvici: ${input.rank}. od ${input.totalPlayers}
- bodovi: ${input.points}
- zaostatak za prvim: ${input.gapToLeader}
- postotak pogođenih: ${Math.round(input.accuracyPct)}%
- kola bez boda: ${input.scorelessStreak}
- niz pogodaka: ${input.hitStreak}
- ton: ${input.tone}

Postojeća poruka koju treba preformulirati u istom duhu i istoj poruci:
"${input.baseText}"

Napiši JEDNU novu poruku od 2-3 rečenice. Sarkastično, razigrano, kao dobacivanje u kafiću. Nikad uvredljivo, bez psovki, bez komentiranja izgleda, obitelji ili inteligencije - zafrkavaj isključivo njegove prognoze i mjesto na ljestvici.

Odgovori ISKLJUČIVO JSON-om: {"poruka": "<tekst>"}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': getEnv().ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        logger.warn({ status: response.status }, 'roast enricher: neuspjesan odgovor');
        return null;
      }

      const payload = (await response.json()) as {
        content?: { type: string; text?: string }[];
      };
      const raw = payload.content?.find((block) => block.type === 'text')?.text;
      if (!raw) return null;

      // The model occasionally wraps JSON in prose; take the first object.
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return null;

      const parsed = JSON.parse(match[0]) as { poruka?: unknown };
      if (typeof parsed.poruka !== 'string' || parsed.poruka.trim().length < 10) return null;

      return parsed.poruka.trim();
    } catch (error) {
      logger.warn({ err: error }, 'roast enricher: preskacem, koristim generirani tekst');
      return null;
    } finally {
      clearTimeout(timeout);
    }
  },
};
