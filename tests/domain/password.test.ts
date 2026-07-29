import { describe, expect, it } from 'vitest';
import { passwordHasher } from '@/infrastructure/auth/password';

describe('hashiranje lozinki', () => {
  it('prihvaca ispravnu lozinku', async () => {
    const hash = await passwordHasher.hash('tajna-lozinka-123');
    await expect(passwordHasher.verify('tajna-lozinka-123', hash)).resolves.toBe(true);
  });

  it('odbija pogresnu lozinku', async () => {
    const hash = await passwordHasher.hash('tajna-lozinka-123');
    await expect(passwordHasher.verify('tajna-lozinka-124', hash)).resolves.toBe(false);
  });

  it('daje razlicit hash za istu lozinku, jer je sol slucajna', async () => {
    const a = await passwordHasher.hash('ista-lozinka');
    const b = await passwordHasher.hash('ista-lozinka');
    expect(a).not.toBe(b);
  });

  it('nikad ne sprema lozinku u citljivom obliku', async () => {
    const hash = await passwordHasher.hash('poljud1911');
    expect(hash).not.toContain('poljud1911');
  });

  it('zapisuje parametre u hash, kako bi se cijena mogla podici bez gubitka starih lozinki', async () => {
    const hash = await passwordHasher.hash('lozinka');
    expect(hash.startsWith('scrypt$32768$8$1$')).toBe(true);
  });

  it('odbija neispravan zapis umjesto da pukne', async () => {
    await expect(passwordHasher.verify('lozinka', 'ovo-nije-hash')).resolves.toBe(false);
    await expect(passwordHasher.verify('lozinka', '')).resolves.toBe(false);
    await expect(passwordHasher.verify('lozinka', 'scrypt$a$b$c$d$e')).resolves.toBe(false);
  });

  it('normalizira unicode, da ista lozinka s razlicitim zapisom i dalje radi', async () => {
    // Ista lozinka zapisana na dva nacina: gotov znak (NFC) i slovo + kombinirajuci
    // znak (NFD). Bez normalizacije bi ispravna lozinka pala na drugom uredaju.
    const composed = 'zdravoć';
    const decomposed = 'zdravoć';
    expect(composed).not.toBe(decomposed);

    const hash = await passwordHasher.hash(composed);
    await expect(passwordHasher.verify(decomposed, hash)).resolves.toBe(true);
  });
});
