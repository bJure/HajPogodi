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
        │  API-Football           │ Prisma
        ▼                         │
   raspored + rezultati ──────────┘

preglednik ──► /api/live/*  (polling, interval određuje server)
```

- **Raspored** se povlači jednom dnevno; admin nove utakmice samo potvrdi.
- **Rezultat** se traži tek od 105. minute nakon početka i najviše 5 sati. Između utakmica cron poziv ne radi ništa.
- **Sučelje** se osvježava samo: 15 s dok je utakmica u tijeku, 60 s ako je utakmica danas, inače 5 min. Kad je kartica u pozadini, polling staje.

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
| `AUTH_URL` | u produkciji | Puni URL aplikacije |
| `CRON_SECRET` | da | Zajednička tajna za `/api/cron/tick`, min. 16 znakova |
| `API_FOOTBALL_KEY` | ne | Bez njega nema automatske sinkronizacije; utakmice se unose ručno |
| `API_FOOTBALL_TEAM_ID` | ne | ID Hajduka, zadano `620` |
| `ANTHROPIC_API_KEY` | ne | Uključuje AI sloj roasta; bez njega radi deterministički generator |
| `SEED_ADMIN_*` | prvi put | Podaci prvog admina, koriste se samo u seedu |

Aplikacija je **potpuno funkcionalna bez oba opcionalna ključa**. Bez `API_FOOTBALL_KEY` admin unosi utakmice i rezultate ručno; bez `ANTHROPIC_API_KEY` roast koristi lokalni generator.

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
  infrastructure/  Prisma repozitoriji, API-Football, auth, logiranje, poslovi
  lib/             env, error wrapperi, formatiranje
```

`domain/` ne uvozi ni Next, ni Prisma, ni React — ESLint to i provodi. Zato je cijela logika pokrivena testovima bez baze.

### Odluke koje vrijedi znati

**Bodovanje je lanac pravila, ne `if`.** Sezona nosi popis `scoringRuleIds`. Novo pravilo = nova datoteka u `src/domain/scoring/rules/` plus jedan redak u registru. Ništa drugo se ne mijenja — ni servisi, ni poslovi, ni sučelje. Trenutno je aktivno samo `exact-score` (1 bod), a `correct-outcome` i `goal-difference` su već napisani i testirani za buduće sezone.

**Zaključavanje se računa, ne sprema.** `isLocked = lockOverride ?? now >= kickoffAt`. Da je to spremljena zastavica koju postavlja cron, propušteno pokretanje ostavilo bi prognoze otvorenima nakon početka. Ovako točnost ne ovisi o tome je li ijedan posao ikad odrađen.

**Admin potvrđuje, sinkronizacija predlaže.** Nove utakmice dolaze kao `NEEDS_CONFIRMATION` i igrači ih ne vide. Polje koje admin uredi zapisuje se u `manualOverrides` i sinkronizacija ga više ne dira.

**Ljestvica je predmemorija.** Uvijek se može ponovno izračunati iz prognoza i rezultata, pa je ispravak rezultata siguran: bodovi se brišu, ponovno računaju i ljestvica se gradi ispočetka. Pokretanje dvaput daje isti rezultat.

**Roast je kombinatoran.** Signali → ton (8 njih) → četiri slota po ~12 varijanti → deterministički odabir po sjemenu `korisnik:sezona:dan`. Preko 160.000 kombinacija, ista poruka cijeli dan, nova sutra. AI sloj je neobavezan i po ugovoru ne smije baciti iznimku.

**Lozinke koriste ugrađeni `scrypt`.** Memory-hard, bez native modula koji se mora kompajlirati — upravo ono što na serverless hostingu zna puknuti kod argon2 i bcrypta. Parametri su zapisani u samom hashu pa se cijena može podići bez gubitka postojećih lozinki.

---

## Sigurnost

- Lozinke: `scrypt` (N=32768, r=8), nasumična sol po lozinci, usporedba u konstantnom vremenu.
- Ograničenje prijave: 5 neuspjeha po korisničkom imenu i 15 po IP-u u 15 minuta, brojano iz baze.
- Ista poruka za nepostojećeg korisnika i krivu lozinku, uz jednako trošenje CPU-a — bez toga se popis korisnika može izvući mjerenjem vremena.
- Middleware samo preusmjerava; stvarnu provjeru radi `requireUser` / `requireAdmin`, koji korisnika ponovno čitaju iz baze. Deaktivacija zato djeluje odmah, a ne tek kad token istekne.
- Svaki unos ide kroz Zod. Rezultati i prognoze ograničeni na 0–20 golova.
- Svaka administratorska radnja piše zapis u `AuditLog`.
- CSP i sigurnosna zaglavlja u `next.config.ts`.

---

## Testovi

```bash
npm test          # 92 testa, bez baze
npm run typecheck
npm run lint
npm run build
```

Testovi pokrivaju bodovanje i njegovu proširivost, zaključavanje (uključujući slučaj kad cron nije radio), prozor dohvata rezultata, determinizam roasta i doseg svih tonova, statistiku i nizove, postignuća, mapiranje s API-Footballa i hashiranje lozinki.

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
| Drugi izvor rezultata | Implementiraj `FootballApiPort` i zamijeni ga u poslovima |
