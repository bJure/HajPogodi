import 'server-only';
import type { FixtureDto } from '@/application/ports/services';
import { logger } from '@/infrastructure/logging/logger';
import { toSemaforId } from './providerIds';

/**
 * HNS semafor adapter - SuperSport HNL and the Croatian Cup.
 *
 * The federation publishes both schedules as server-rendered HTML, and every
 * row carries ids rather than only names: `data-match` identifies the fixture
 * even before it is played, `data-id` identifies each club. That is what makes
 * this parseable rather than merely scrapeable - the sync can key on ids that
 * survive a rename, a postponement or a kickoff being moved.
 *
 * There is no JSON feed behind the page, so this reads the markup directly.
 * Parsing is deliberately narrow: one regex per row, every field optional, and
 * a row that does not yield a fixture is skipped rather than guessed at. If HNS
 * redesigns the page this adapter returns nothing and the sync logs a failure -
 * matches are then entered by hand, which the app supports anyway.
 */
const BASE_URL = 'https://semafor.hns.family/natjecanja';

/** HNS's own club id for Hajduk, from the club URL. */
export const SEMAFOR_HAJDUK_ID = 515;

export interface SemaforCompetition {
  /** Competition id in the semafor URL. */
  readonly semaforId: number;
  /** Slug in the URL; semafor accepts any slug but the id must match. */
  readonly slug: string;
  /** The league id our competitions are already seeded under. */
  readonly apiLeagueId: number;
  readonly name: string;
  readonly type: FixtureDto['competition']['type'];
}

export const SEMAFOR_COMPETITIONS: readonly SemaforCompetition[] = [
  {
    semaforId: 114137140,
    slug: 'supersport-hnl',
    apiLeagueId: 210,
    name: 'SuperSport HNL',
    type: 'LEAGUE',
  },
  {
    semaforId: 114492931,
    slug: 'supersport-hnk',
    apiLeagueId: 211,
    name: 'Hrvatski nogometni kup',
    type: 'CUP',
  },
];

/**
 * Kickoff for a row that lists a date but no time yet - later rounds are
 * published that way and the time follows weeks later.
 *
 * Deliberately early in the day. The two failure modes are not symmetric: a
 * placeholder that is too late leaves predictions open while the match is being
 * played, which is cheating; one that is too early locks them prematurely,
 * which an admin undoes with `lockOverride`. The real time overwrites this on
 * the next sync.
 */
const UNKNOWN_KICKOFF_HOUR = 12;

/** Offset of Europe/Zagreb from UTC at a given instant, in milliseconds. */
function zagrebOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Zagreb',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);

  const read = (type: string): number =>
    Number.parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);

  // `hour` comes back as 24 at midnight under hour12:false in some runtimes.
  const hour = read('hour') % 24;
  const asIfUtc = Date.UTC(read('year'), read('month') - 1, read('day'), hour, read('minute'));
  return asIfUtc - at.getTime();
}

/**
 * Croatian local wall-clock time to a real instant.
 *
 * The offset has to be measured at the target instant, not at "now", or every
 * fixture on the other side of a DST switch lands an hour out. Two passes
 * settle it for a zone with one transition per season.
 */
export function zagrebToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const firstPass = naive - zagrebOffsetMs(new Date(naive));
  return new Date(naive - zagrebOffsetMs(new Date(firstPass)));
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number.parseInt(code, 10)))
    .replace(/&nbsp;/g, ' ')
    .trim();
}

interface ParsedClub {
  readonly id: number;
  readonly name: string;
  readonly logoUrl: string | null;
}

function parseClub(row: string, which: 'club1' | 'club2'): ParsedClub | null {
  const block = new RegExp(
    `<div[^>]*class="[^"]*\\b${which}\\b[^"]*"[^>]*data-id="(\\d+)"[^>]*>([\\s\\S]*?)</div>\\s*</div>`,
  ).exec(row);
  if (!block) return null;

  const id = Number.parseInt(block[1] ?? '', 10);
  const inner = block[2] ?? '';

  // The club name is the text between the anchor and the nested logo div.
  const name = /<a[^>]*>([^<]+)</.exec(inner)?.[1];
  if (Number.isNaN(id) || !name) return null;

  const logoUrl = /<img[^>]*src="([^"]+)"/.exec(inner)?.[1] ?? null;

  return { id, name: decodeEntities(name), logoUrl };
}

function parseGoals(row: string, which: 'res1' | 'res2'): number | null {
  const raw = new RegExp(`class="${which}"[^>]*>([^<]*)<`).exec(row)?.[1]?.trim();
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Pure parser over one competition page, exported so it can be tested against
 * saved markup without touching the network.
 */
export function parseSemaforSchedule(
  html: string,
  competition: SemaforCompetition,
  ourClubId = SEMAFOR_HAJDUK_ID,
): FixtureDto[] {
  const fixtures: FixtureDto[] = [];
  const rows = html.matchAll(/<li[^>]*data-match="(\d+)"[^>]*>([\s\S]*?)<\/li>/g);

  for (const match of rows) {
    const rawId = Number.parseInt(match[1] ?? '', 10);
    const row = match[2] ?? '';
    if (Number.isNaN(rawId)) continue;

    const home = parseClub(row, 'club1');
    const away = parseClub(row, 'club2');
    if (!home || !away) continue;

    const isHome = home.id === ourClubId;
    const isAway = away.id === ourClubId;
    // Every other pairing in the competition is none of our business.
    if (!isHome && !isAway) continue;

    const dateText = /class="date"[^>]*>([^<]+)</.exec(row)?.[1]?.trim();
    const parts = /(\d{1,2})\.(\d{1,2})\.(\d{4})\.?(?:\s+(\d{1,2}):(\d{2}))?/.exec(dateText ?? '');
    if (!parts) continue;

    const num = (group: string | undefined, fallback: number): number => {
      const parsed = Number.parseInt(group ?? '', 10);
      return Number.isNaN(parsed) ? fallback : parsed;
    };

    const hasTime = parts[4] !== undefined;
    const kickoffAt = zagrebToUtc(
      num(parts[3], 0),
      num(parts[2], 1),
      num(parts[1], 1),
      hasTime ? num(parts[4], UNKNOWN_KICKOFF_HOUR) : UNKNOWN_KICKOFF_HOUR,
      hasTime ? num(parts[5], 0) : 0,
    );

    const homeGoals = parseGoals(row, 'res1');
    const awayGoals = parseGoals(row, 'res2');
    const played = homeGoals !== null && awayGoals !== null;

    const opponent = isHome ? away : home;
    const round = /data-round="(\d+)"/.exec(match[0])?.[1] ?? null;
    const venue = /class="facility"[^>]*>([^<]*)</.exec(row)?.[1]?.trim();

    fixtures.push({
      fixtureId: toSemaforId(rawId),
      kickoffAt,
      status: played ? 'FINISHED' : 'SCHEDULED',
      round,
      venue: venue ? decodeEntities(venue) : null,
      isHome,
      opponent: {
        apiTeamId: toSemaforId(opponent.id),
        name: opponent.name,
        logoUrl: opponent.logoUrl,
      },
      competition: {
        apiLeagueId: competition.apiLeagueId,
        name: competition.name,
        type: competition.type,
        logoUrl: null,
      },
      score: played ? { homeGoals: homeGoals as number, awayGoals: awayGoals as number } : null,
      raw: { semaforMatchId: rawId, competition: competition.semaforId },
    });
  }

  return fixtures;
}

async function fetchCompetition(competition: SemaforCompetition): Promise<string> {
  const url = `${BASE_URL}/${competition.semaforId}/${competition.slug}/detaljno/`;

  const response = await fetch(url, {
    headers: { 'user-agent': 'HajPogodi/1.0 (+https://hajpogodi.vercel.app)' },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`HNS semafor greška ${response.status} (${competition.name})`);
  }

  return response.text();
}

export async function listSemaforFixtures(
  competitions: readonly SemaforCompetition[] = SEMAFOR_COMPETITIONS,
): Promise<FixtureDto[]> {
  const pages = await Promise.all(
    competitions.map(async (competition) => {
      const html = await fetchCompetition(competition);
      return parseSemaforSchedule(html, competition);
    }),
  );

  const fixtures = pages.flat();
  logger.info({ count: fixtures.length }, 'HNS semafor raspored dohvacen');
  return fixtures;
}

export async function getSemaforFixture(fixtureId: number): Promise<FixtureDto | null> {
  const all = await listSemaforFixtures();
  return all.find((f) => f.fixtureId === fixtureId) ?? null;
}
