# Prognoze ostalih u listi odigranih utakmica

Datum: 2026-07-31

## Problem

Nakon odigrane utakmice igrač vidi samo svoju prognozu. Lista "Zadnji rezultati" na
`/pocetna` (i "Odigrano" na `/povijest`) prikazuje datum, susret, rezultat, moju prognozu
i moje bodove. Tko je još pogodio, a tko promašio — nigdje ne piše. Prognoze ostalih
vidljive su samo za *sljedeću* utakmicu, u `NextMatchCard`, i nestaju čim utakmica prođe.

## Rješenje

Red u listi odigranih utakmica postaje klikabilan. Klik otvara panel s prognozama svih
aktivnih igrača za tu utakmicu: pogođeni zeleno, promašeni crveno, tko nije glasao sivo
uz "nema prognoze".

## Bodovanje — potvrđeno u kodu

`exact-score` je jedino aktivno pravilo (`src/domain/scoring/rules/index.ts`,
`DEFAULT_RULE_IDS`). Nosi 1 bod za točan rezultat, 0 inače
(`src/domain/scoring/rules/exactScore.ts`). Dakle `points > 0` je ekvivalent "pogodio
točan rezultat" i nije potrebna posebna usporedba golova — postojeći `hit` u
`ResultList.tsx` već koristi to pravilo.

## Arhitektura

### 1. Domena — `src/domain/prediction/predictionBoard.ts`

Čista funkcija, bez I/O, testabilna kao i ostatak `src/domain`.

```ts
export interface BoardEntry {
  readonly userId: string;
  readonly nickname: string;
  readonly prediction: { readonly homeGoals: number; readonly awayGoals: number } | null;
  readonly hit: boolean;
}

interface BoardPlayer {
  readonly id: string;
  readonly nickname: string;
}

interface BoardPrediction {
  readonly userId: string;
  readonly homeGoals: number;
  readonly awayGoals: number;
  readonly points: number | null;
}

export function buildPredictionBoard(
  users: readonly BoardPlayer[],
  predictions: readonly BoardPrediction[],
): BoardEntry[];
```

Ulazni tipovi su strukturalni i lokalni, pa `src/domain` ne uvozi ništa iz
`src/application` — isto kao ostatak domene. `PredictionDto` i `UserRow` zadovoljavaju
oblik, pa ih servis prosljeđuje bez mapiranja.

Spaja aktivne korisnike s prognozama za jednu utakmicu. Korisnik bez prognoze dobiva
`prediction: null`, `hit: false`.

Redoslijed, od najznačajnijeg:

1. pogodio (`hit`)
2. ima prognozu
3. nadimak abecedno (`localeCompare(…, 'hr')`)

Rezultat: pogoci → promašaji → bez prognoze, unutar svake grupe abecedno. Sortiranje je
deterministično, pa dva poziva nad istim podacima daju identičan poredak.

### 2. Aplikacija — `getPredictionBoard` u `predictionService.ts`

```ts
export async function getPredictionBoard(matchId: string, now: Date): Promise<BoardEntry[]>
```

Koraci:

1. `matchRepository.findById` — ne postoji → `Errors.notFound('Utakmica')`.
2. Utakmica još otvorena za prognoze (`isOpenForPredictions`) → `FORBIDDEN`. Ovo je
   ista zaštita koju `listMatchPredictions` postiže vraćanjem prazne liste: nitko ne
   smije vidjeti tuđe prognoze prije zaključavanja, inače zadnji koji glasa prepiše
   od vodećeg. Ruta se u praksi zove samo za odigrane utakmice, ali provjera stoji u
   servisu, nad svježe učitanom utakmicom, ne nad onim što je klijent poslao.
3. `userRepository.listActive()` i `predictionRepository.listByMatch(matchId)`
   paralelno (`Promise.all`).
4. `buildPredictionBoard(users, predictions.map(toPredictionDto))` — `toPredictionDto`
   već nosi `points` iz `score`, što je jedino što domena treba za `hit`.

Deaktivirani korisnici se ne prikazuju čak i ako su nekad glasali.

### 3. Ruta — `src/app/api/utakmica/[matchId]/prognoze/route.ts`

`GET`, `export const dynamic = 'force-dynamic'`. Tijelo kroz `withRoute('utakmica/prognoze', …)`
— time dobiva mapiranje domenskih grešaka na HTTP statuse i `Cache-Control: private, no-store`.

- `requireUser()` prije svega ostalog. Podatak je za prijavljene.
- Next 16: `params` je `Promise`, pa `const { matchId } = await params`.
- Odgovor: `{ entries: BoardEntry[] }`.

Ruta stoji izvan `/api/live/*` jer ne sudjeluje u pollingu — dohvaća se jednom, na klik.

### 4. UI — `src/components/match/ResultList.tsx`

Datoteka postaje `'use client'`. Red se izdvaja u komponentu `ResultRow` koja drži
vlastito stanje (otvoreno / dohvaćeno / greška), pa jedan otvoren red ne rerendera ostale.

Vizual reda ostaje nepromijenjen, uz dodanu strelicu desno koja se rotira kad je red
otvoren.

Ponašanje:

- Red je klikabilan samo ako `match.result !== null`. Bez rezultata nema što pokazati,
  pa ostaje običan `<li>` kao danas.
- Klikabilan red je `<button>` preko cijele širine, s `aria-expanded`.
- Prvi klik pokreće dohvat; dok traje, panel prikazuje "Učitavam…".
- Greška → poruka u panelu; sljedeći klik pokušava ponovno.
- Uspješan dohvat ostaje u stanju reda. Zatvaranje i ponovno otvaranje ne ponavlja
  zahtjev — rezultat odigrane utakmice se ne mijenja.

Panel, stilski nasljeđuje blok "Prognoze ostalih" iz `NextMatchCard.tsx`
(gornja granica `border-t border-white/8`, nadimak lijevo, rezultat desno):

| Slučaj | Prikaz | Boja |
| --- | --- | --- |
| pogodio | `4:0` | `text-success` |
| promašio | `2:1` | `text-danger` |
| nije glasao | `nema prognoze` | `text-ink-faint` |

`--color-success` i `--color-danger` već postoje u `globals.css`.

Vlastiti nadimak je u listi kao i svaki drugi, bez posebne oznake — moja prognoza je
ionako vidljiva u samom redu iznad.

### 5. Opseg

`ResultList` koriste `/pocetna` ("Zadnji rezultati") i `/povijest` ("Odigrano"). Obje
stranice dobivaju novo ponašanje bez ijedne izmjene u `page.tsx`. Dohvat je na klik, pa
duža lista na `/povijest` ne košta ništa dok se red ne otvori.

Lista "Nadolazeće" na `/povijest` ima vlastiti markup i ostaje netaknuta.

## Tok podataka

```
klik na red
  → GET /api/utakmica/<id>/prognoze
      → requireUser
      → getPredictionBoard(matchId, now)
          → findById, guard isOpenForPredictions
          → listActive + listByMatch
          → buildPredictionBoard
  → { entries } u stanje reda
  → panel
```

## Greške

| Situacija | Ponašanje |
| --- | --- |
| neprijavljen | `withRoute` → 401 |
| utakmica ne postoji | 404, panel prikazuje poruku iz odgovora |
| utakmica još otvorena | 403, poruka "Prognoze ostalih vidljive su tek nakon zaključavanja." |
| mreža pukne | panel prikazuje poruku, ponovni klik pokušava opet |

## Testovi

`tests/domain/predictionBoard.test.ts` pokriva `buildPredictionBoard`:

- korisnik bez prognoze dobiva `prediction: null`, `hit: false`, i završava na dnu —
  jer se "nema prognoze" nikad ne smije pomiješati s promašajem
- pogodak (`points > 0`) ide na vrh, ispred promašaja s istim nadimkom po abecedi —
  poredak nagrađuje pogodak, ne slučajni redoslijed unosa
- unutar iste grupe poredak je abecedni po `hr` pravilima (č, ć, š, ž)
- prognoza korisnika koji više nije aktivan se ne pojavljuje

Postojeći testovi su domenski i bez mockanja repozitorija, pa se servis i ruta ne
testiraju automatski — zato cijela logika koja može pogriješiti živi u čistoj funkciji.

## Izvan opsega

- Bilo kakva izmjena bodovanja ili ljestvice
- Prikaz tuđih prognoza prije zaključavanja
- Polling / osvježavanje otvorenog panela
