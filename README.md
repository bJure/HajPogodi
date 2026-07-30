# HajPogodi

Aplikacija za prognoziranje **točnog rezultata Hajdukovih utakmica**. Zatvorena grupa prijatelja, automatski obračun bodova, ljestvica koja se sama osvježava i roast koji te dočeka čim se prijaviš.

Sve radi na besplatnim planovima: Vercel Hobby + Neon Postgres + besplatni vanjski cron. Nema servera koji stalno radi.

---

## Kako to radi

Hajduk igra otprilike dvaput tjedno, pa aplikacija ne treba ni stalnu vezu ni pozadinski proces koji se stalno vrti.

```
GitHub Actions / Cloudflare Worker  (cron)
        │  POST /api/cron/tick   x-cron-secret
        ▼
   Next.js na Vercelu ──────► Neon Postgres
        │                         ▲
        ├── HNS semafor           │ Prisma
        │     HNL + kup           │
        ├── ESPN                  │
        │     europska natjecanja │
        ▼                         │
   raspored + rezultati ──────────┘

preglednik ──► /api/live/*  (polling, interval određuje server)
```

- **Raspored** se povlači jednom dnevno iz dva izvora, oba besplatna i bez ključa.
- **Rezultat** dolazi na dva načina: odmah nakon utakmice preko pollinga (od 105. minute, najviše 5 sati), a inače uz dnevni raspored, jer oba izvora nose i rezultat. Utakmica koju polling propusti zato ne ostaje bez rezultata.
- **Potvrda** je automatska tri dana prije početka. Dok je utakmica dalje od toga, čeka admina i igrači je ne vide.
- **Sučelje** se osvježava samo: 15 s dok je utakmica u tijeku, 60 s ako je utakmica danas, inače 5 min. Kad je kartica u pozadini, polling staje.

### Zašto dva izvora

Nijedan besplatan izvor ne pokriva sve. HNS semafor ima HNL i kup, a europskih natjecanja nema. ESPN ima Hajdukove UEFA susrete, a hrvatskog nogometa nema uopće — u njihovom popisu od 220 liga nema ni jedne hrvatske. `compositeClient` ih spaja iza jednog `FootballApiPort`, pa ostatak aplikacije ne zna da ih je dva.

---

## Pokretanje lokalno

```bash
# 1. baza (Docker) — ili preskoči i upiši Neon URL u .env
docker compose up -d

# 2. ovisnosti
npm install

# 3. konfiguracija
cp .env.example .env
#    - generiraj AUTH_SECRET:  node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
#    - generiraj CRON_SECRET:  node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
#    - postavi SEED_ADMIN_PASSWORD

# 4. shema i početni podaci
npm run db:migrate
npm run db:seed

# 5. pokreni
npm run dev
```

Otvori http://localhost:3000 i prijavi se kao admin. Prva prijava traži promjenu lozinke.

### Bez Dockera

Umjesto `docker compose up -d` otvori besplatnu bazu na [neon.tech](https://neon.tech) i upiši njezin connection string u `DATABASE_URL` (obavezno `?sslmode=require`). Sve ostalo je isto.

---

## Konfiguracija

| Varijabla | Obavezno | Opis |
|---|---|---|
| `DATABASE_URL` | da | Postgres connection string |
| `AUTH_SECRET` | da | Ključ za potpisivanje sesija, min. 32 znaka |
| `AUTH_URL` | u produkciji | Puni URL aplikacije. Bez njega aplikacija u produkciji odbija start |
| `CRON_SECRET` | da | Zajednička tajna za `/api/cron/tick`, min. 16 znakova |
| `ANTHROPIC_API_KEY` | ne | Uključuje AI sloj roasta; bez njega radi deterministički generator |
| `SEED_ADMIN_*` | prvi put | Podaci prvog admina, koriste se samo u seedu |

Sinkronizacija rasporeda **ne traži nikakav ključ** — oba izvora su javna. Jedini opcionalni ključ je `ANTHROPIC_API_KEY`; bez njega roast koristi deterministički generator.

### Zašto su vrijednosti u `.env.example` prazne

Repozitorij je javan, pa je svaka vrijednost u predlošku javno poznata. Da `.env.example` sadrži tajnu koja prolazi validaciju, tko god kopira predložak i deploya dobio bi `CRON_SECRET` koji svatko može pročitati — dovoljno da netko okida `/api/cron/tick` koliko mu se prohtjede i time nepotrebno gnjavi izvore rasporeda.

Zato tajne u predlošku stoje prazne, a kod **odbija pokretanje** ako ostanu placeholderi:

- `AUTH_SECRET` i `CRON_SECRET` — provjera u `src/lib/env.ts` pada na poznatim placeholderima, neovisno o duljini
- `SEED_ADMIN_PASSWORD` — seed odbija praznu vrijednost i poznate placeholdere
- dev baza sluša samo na `127.0.0.1`, jer joj je lozinka u ovom repozitoriju

Test `tests/domain/envPlaceholders.test.ts` pada ako netko ikad vrati upotrebljivu vrijednost u predložak.

---

## Objava na Vercel

1. **Baza** — otvori projekt na [neon.tech](https://neon.tech), kopiraj connection string.
2. **Projekt** — uvezi repozitorij na [vercel.com](https://vercel.com), framework se prepozna sam.
3. **Varijable okoline** — dodaj sve iz tablice gore. `AUTH_URL` postavi na stvarni URL.
4. **Migracije** — pokreni jednom lokalno prema produkcijskoj bazi:
   ```bash
   DATABASE_URL="<neon url>" npm run db:deploy
   DATABASE_URL="<neon url>" npm run db:seed
   ```
5. **Cron** — vidi ispod.

### Cron

`/api/cron/tick` sam odlučuje što je na redu, pa ga treba samo redovito pozivati.

**Ako je repozitorij javan** → koristi `.github/workflows/cron-tick.yml`. Dodaj GitHub secrets `APP_URL` i `CRON_SECRET`. Gotovo.

**Ako je repozitorij privatan** → GitHub naplaćuje svako pokretanje kao cijelu minutu, a raspored svakih 5 minuta je ~8.640 pokretanja mjesečno naspram besplatnih 2.000. Zato:
- ostavi u workflowu samo dnevni `0 6 * * *`, i
- česti dio prebaci na besplatni Cloudflare Worker — upute su u `worker/cron-worker.js`.

Provjera da radi:

```bash
curl -X POST https://tvoja-app.vercel.app/api/cron/tick -H "x-cron-secret: <CRON_SECRET>"
```

---

## Arhitektura

Čista arhitektura, ovisnosti idu prema unutra: **app → application → domain**. `infrastructure` implementira sučelja deklarirana u `application/ports`.

```
src/
  app/             rute, layouti, server akcije (tanke)
  components/      UI komponente
  domain/          čista logika: bodovanje, zaključavanje, roast, postignuća, statistika
  application/     use casevi, DTO-ovi, portovi, mapperi
  infrastructure/  Prisma repozitoriji, izvori rasporeda, auth, logiranje, poslovi
  lib/             env, error wrapperi, formatiranje
```

`domain/` ne uvozi ni Next, ni Prisma, ni React — ESLint to i provodi. Zato je cijela logika pokrivena testovima bez baze.

### Odluke koje vrijedi znati

**Bodovanje je lanac pravila, ne `if`.** Sezona nosi popis `scoringRuleIds`. Novo pravilo = nova datoteka u `src/domain/scoring/rules/` plus jedan redak u registru. Ništa drugo se ne mijenja — ni servisi, ni poslovi, ni sučelje. Trenutno je aktivno samo `exact-score` (1 bod), a `correct-outcome` i `goal-difference` su već napisani i testirani za buduće sezone.

**Zaključavanje se računa, ne sprema.** `isLocked = lockOverride ?? now >= kickoffAt`. Da je to spremljena zastavica koju postavlja cron, propušteno pokretanje ostavilo bi prognoze otvorenima nakon početka. Ovako točnost ne ovisi o tome je li ijedan posao ikad odrađen.

**Sinkronizacija predlaže, potvrda dolazi sama ili od admina.** Nove utakmice dolaze kao `NEEDS_CONFIRMATION` i igrači ih ne vide — provjera ima smisla tjednima unaprijed, dok su termini još privremeni. Tri dana prije početka potvrda se dogodi sama, jer bi inače kolo prošlo bez ijedne prognoze samo zato što nitko nije stigao kliknuti. Odgođena i otkazana utakmica se ne objavljuju. Polje koje admin uredi zapisuje se u `manualOverrides` i sinkronizacija ga više ne dira.

**Ljestvica je predmemorija.** Uvijek se može ponovno izračunati iz prognoza i rezultata, pa je ispravak rezultata siguran: bodovi se brišu, ponovno računaju i ljestvica se gradi ispočetka. Pokretanje dvaput daje isti rezultat.

**Roast je kombinatoran.** Signali → ton (8 njih) → četiri slota po ~12 varijanti → deterministički odabir po sjemenu `korisnik:sezona:dan`. Preko 160.000 kombinacija, ista poruka cijeli dan, nova sutra. AI sloj je neobavezan i po ugovoru ne smije baciti iznimku.

**Lozinke koriste ugrađeni `scrypt`.** Memory-hard, bez native modula koji se mora kompajlirati — upravo ono što na serverless hostingu zna puknuti kod argon2 i bcrypta. Parametri su zapisani u samom hashu pa se cijena može podići bez gubitka postojećih lozinki.

---

## Sigurnost

- Lozinke: `scrypt` (N=32768, r=8), nasumična sol po lozinci, usporedba u konstantnom vremenu. Bez donje granice duljine — grupa je zatvorena, a račun čuva ograničenje prijave. Odbija se samo prazna lozinka i ona dulja od 128 znakova, jednako na svim putovima koji postavljaju lozinku. Isto vrijedi i za `SEED_ADMIN_PASSWORD`, uz dodatnu provjeru da nije placeholder iz `.env.example`.
- Ograničenje prijave: 5 neuspjeha po korisničkom imenu i 15 po IP-u u 15 minuta, brojano iz baze. Isto ograničenje pokriva i unos trenutne lozinke na stranici za promjenu.
- IP se čita iz `x-vercel-forwarded-for`, koji postavlja platforma. `x-forwarded-for` šalje klijent, pa bi ograničenje po IP-u s njim bilo ukrasno.
- Ista poruka za nepostojećeg korisnika i krivu lozinku, uz jednako trošenje CPU-a — bez toga se popis korisnika može izvući mjerenjem vremena.
- Middleware samo preusmjerava; stvarnu provjeru radi `requireUser` / `requireAdmin`, koji korisnika ponovno čitaju iz baze. Deaktivacija zato djeluje odmah, a ne tek kad token istekne.
- Promjena lozinke poništava sve ostale sesije: token izdan prije `passwordChangedAt` odbija se pri sljedećem zahtjevu. JWT se inače ne može opozvati.
- Svaki unos ide kroz Zod. Rezultati i prognoze ograničeni na 0–20 golova.
- Svaka administratorska radnja piše zapis u `AuditLog`.
- CSP s nonceom po odgovoru, u `src/middleware.ts`. Ostala sigurnosna zaglavlja su statična i stoje u `next.config.ts`.
- Odgovori `/api/*` nose `Cache-Control: private, no-store` — autenticirani JSON ne smije ostati ni u jednom međuspremniku.

Prijava ranjivosti i model prijetnje: [`SECURITY.md`](SECURITY.md).

---

## Testovi

```bash
npm test          # 147 testova, bez baze
npm run typecheck
npm run lint
npm run build
```

Testovi pokrivaju bodovanje i njegovu proširivost, zaključavanje (uključujući slučaj kad cron nije radio), prozor dohvata rezultata, determinizam roasta i doseg svih tonova, statistiku i nizove, postignuća, parsiranje HNS-ovog rasporeda i ESPN-ovog feeda, razdvajanje id-eva po izvoru, automatsku potvrdu utakmice, hashiranje lozinki, poništavanje sesija nakon promjene lozinke i odbijanje placeholder tajni.

---

## Pozadinska slika

`public/hero.jpg` je neobavezan. Ako ga nema, hero koristi gradijent i izgleda dovršeno. Službena klupska pozadina namjerno nije uključena u repozitorij jer nije naša za dijeliti — ubaci svoju sliku pod tim imenom.

---

## Održavanje

| Zadatak | Gdje |
|---|---|
| Novo pravilo bodovanja | `src/domain/scoring/rules/` + registar u `rules/index.ts` |
| Novo postignuće | `src/domain/achievement/definitions.ts` + `npm run db:seed` |
| Nove roast rečenice | `src/domain/roast/templates.ts` |
| Nova sezona | Admin → Sezone → Nova sezona → Aktiviraj |
| Novi izvor rasporeda | Implementiraj `FootballApiPort` i dodaj ga u `compositeClient.ts` |
| Nova sezona kod HNS-a | Novi id-evi natjecanja u `SEMAFOR_COMPETITIONS` (`semaforClient.ts`) |
