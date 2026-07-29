# Sigurnost

HajPogodi je aplikacija za zatvorenu grupu prijatelja, ali je izvorni kod javan.
Ovaj dokument opisuje kako prijaviti ranjivost i sto model prijetnje pokriva.

## Prijava ranjivosti

Otvori [privatnu prijavu preko GitHub Security Advisoriesa](https://github.com/bJure/HajPogodi/security/advisories/new).

**Ne otvaraj javni issue** za sigurnosnu gresku — javni opis ranjivosti u
aplikaciji koja radi u produkciji je uputa za napad prije nego sto postoji
zakrpa.

Odgovor u roku od nekoliko dana. Ovo je projekt iz hobija bez SLA-a i bez
programa nagrada; jedino sto mogu ponuditi je zahvala u opisu popravka, ako je
zelis.

Korisno u prijavi: koji zahtjev, koji odgovor, i sto je posljedica. Proof of
concept je dobrodosao.

## Sto je u opsegu

Kod u ovom repozitoriju: autentikacija i autorizacija, zakljucavanje prognoza,
cron endpoint, obrada vanjskih odgovora, konfiguracija zaglavlja.

Izvan opsega: sve na strani Vercela, Neona, API-Footballa i GitHuba, kao i
prijave koje se svode na izlaz automatskog skenera bez pokazanog utjecaja.

## Model prijetnje

Racune otvara iskljucivo administrator — nema samostalne registracije. Zato su
najzanimljiviji scenariji:

- **Zaobilazenje zakljucavanja prognoze.** Prognoza poslana nakon pocetka
  utakmice, ili citanje tudih prognoza prije zakljucavanja, mijenja ishod
  natjecanja. Provjera se izvodi na svjeze ucitanoj utakmici u
  `predictionService.submitPrediction`, nikad na onome sto je klijent poslao.
- **Eskalacija na administratora.** `requireAdmin` ponovno cita korisnika iz
  baze pri svakom zahtjevu, pa deaktivacija ili degradacija djeluje odmah, a ne
  tek kad token istekne. Middleware sluzi samo preusmjeravanju.
- **Trosenje tude kvote.** `/api/cron/tick` je otvoren prema internetu i pokrece
  pozive prema API-Footballu, koji ima 100 zahtjeva dnevno. Stiti ga zajednicka
  tajna usporedena u konstantnom vremenu.
- **Pogadanje lozinki.** Ogranicenje po korisnickom imenu i po IP adresi u
  prozoru od 15 minuta, uz scrypt s parametrima koji offline pogadanje cine
  skupim.

## Tajne

U repozitoriju nema nijedne upotrebljive tajne, niti je ikad bila u povijesti
commitova. `.env.example` sadrzi samo prazne vrijednosti; aplikacija i seed
odbijaju pokretanje ako vrijednost odgovara necemu iz predloska, jer je sve
objavljeno u javnom repozitoriju vec javno znanje.

Iznimka je lozinka lokalne razvojne baze u `docker-compose.yml`
(`hajpogodi:hajpogodi`). Namjerno je javna i zato je port vezan na `127.0.0.1`.

Ako ipak pronades tajnu koja izgleda upotrebljivo, prijavi je istim putem —
brzo rotiranje je jeftinije od rasprave je li stvarna.
