import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `.env.example` is published in a public repository, so every value in it is
 * public knowledge. This test fails if the template ever ships a secret that
 * would actually pass validation - which would hand anyone who reads the repo
 * a working CRON_SECRET or admin password.
 */
const template = readFileSync(new URL('../../.env.example', import.meta.url), 'utf8');

function value(key: string): string {
  const match = template.match(new RegExp(`^${key}="?([^"\\n]*)"?$`, 'm'));
  return match?.[1] ?? '';
}

describe('.env.example ne smije sadrzavati upotrebljive tajne', () => {
  it('AUTH_SECRET je prazan, jer bi 32-znakovna vrijednost odavde prosla validaciju', () => {
    expect(value('AUTH_SECRET')).toBe('');
  });

  it('CRON_SECRET je prazan, inace bi svatko mogao okinuti cron i potrositi dnevnu kvotu API-ja', () => {
    expect(value('CRON_SECRET')).toBe('');
  });

  it('SEED_ADMIN_PASSWORD je prazan, inace bi admin lozinka bila objavljena na GitHubu', () => {
    expect(value('SEED_ADMIN_PASSWORD')).toBe('');
  });

  it('API kljucevi su prazni', () => {
    expect(value('API_FOOTBALL_KEY')).toBe('');
    expect(value('ANTHROPIC_API_KEY')).toBe('');
  });

  it('dev baza slusa samo na loopbacku, jer joj je lozinka javna', () => {
    const compose = readFileSync(new URL('../../docker-compose.yml', import.meta.url), 'utf8');
    expect(compose).toContain('127.0.0.1:5432:5432');
    expect(compose).not.toMatch(/^\s+- '5432:5432'$/m);
  });
});

describe('provjera konfiguracije odbija placeholdere', () => {
  const VALID = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/d',
    AUTH_SECRET: 'a'.repeat(40),
    CRON_SECRET: 'c8f3a91b7d2e4056a1b9c3d7e5f20418',
  };

  beforeEach(() => {
    // getEnv caches its result, so each case needs a fresh module instance.
    vi.resetModules();
    // Stubs persist across cases in a file; without this, a variable set by one
    // case silently decides the outcome of the next.
    vi.unstubAllEnvs();
  });

  async function loadEnv(overrides: Record<string, string>) {
    vi.stubEnv('NODE_ENV', 'test');
    for (const [key, value] of Object.entries({ ...VALID, ...overrides })) {
      vi.stubEnv(key, value);
    }
    const { getEnv } = await import('@/lib/env');
    return getEnv;
  }

  it('prihvaca stvarne tajne', async () => {
    const getEnv = await loadEnv({});
    expect(getEnv().CRON_SECRET).toBe(VALID.CRON_SECRET);
  });

  it('odbija CRON_SECRET iz predloska, iako je dovoljno dug', async () => {
    const placeholder = 'promijeni-me-generiranom-tajnom';
    expect(placeholder.length).toBeGreaterThanOrEqual(16);

    const getEnv = await loadEnv({ CRON_SECRET: placeholder });
    expect(() => getEnv()).toThrow(/CRON_SECRET/);
  });

  it('odbija AUTH_SECRET iz predloska', async () => {
    // Ovaj je odbijen i po duljini (31 < 32) i kao placeholder - bitno je da
    // vrijednost prepisana iz javnog predloska nikad ne prode.
    const getEnv = await loadEnv({ AUTH_SECRET: 'promijeni-me-generiranom-tajnom' });
    expect(() => getEnv()).toThrow(/AUTH_SECRET/);
  });

  it('odbija placeholder i kad je dovoljno dug, jer duljina nije ono sto ga cini losim', async () => {
    // 'changeme' je krace od minimuma za AUTH_SECRET, pa se koristi CRON_SECRET
    // gdje placeholder uredno prelazi granicu duljine.
    const getEnv = await loadEnv({ CRON_SECRET: 'PROMIJENI-ME-GENERIRANOM-TAJNOM' });
    // Provjera je neosjetljiva na velika slova.
    expect(() => getEnv()).toThrow(/CRON_SECRET/);
  });

  it('odbija kratak CRON_SECRET', async () => {
    const getEnv = await loadEnv({ CRON_SECRET: 'prekratko' });
    expect(() => getEnv()).toThrow(/CRON_SECRET/);
  });

  it('trazi AUTH_URL u produkciji, jer inace Host zaglavlje odreduje callback URL-ove', async () => {
    // Auth.js radi s `trustHost: true`, sto mora na platformi koja terminira TLS
    // ispred aplikacije. Bez eksplicitnog AUTH_URL-a napadac koji posalje tudi
    // Host odreduje kamo prijava vodi.
    vi.stubEnv('NODE_ENV', 'production');
    for (const [key, value] of Object.entries(VALID)) vi.stubEnv(key, value);
    vi.stubEnv('AUTH_URL', '');

    const { getEnv } = await import('@/lib/env');
    expect(() => getEnv()).toThrow(/AUTH_URL/);
  });

  it('ne trazi AUTH_URL izvan produkcije', async () => {
    const getEnv = await loadEnv({});
    expect(getEnv().AUTH_URL).toBeUndefined();
  });
});
