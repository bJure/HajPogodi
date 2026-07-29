import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { PasswordHasherPort } from '@/application/ports/services';

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * Password hashing on Node's built-in scrypt.
 *
 * scrypt is memory-hard and ships with Node, so there is no native module to
 * compile and nothing that can fail to install on a serverless host - which is
 * exactly the failure mode argon2 and bcrypt native bindings are known for.
 *
 * Cost parameters follow the Node documentation's recommendation; N=2^15 with
 * r=8 needs ~32 MB per hash, which is comfortably within a serverless function
 * and slow enough to make offline guessing expensive.
 */
const PARAMS = { N: 32768, r: 8, p: 1, maxmem: 96 * 1024 * 1024 } as const;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const PREFIX = 'scrypt';

export const passwordHasher: PasswordHasherPort = {
  async hash(plain: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const derived = await scrypt(plain.normalize('NFKC'), salt, KEY_LENGTH, PARAMS);

    // Self-describing format, so cost parameters can be raised later without
    // invalidating existing hashes.
    return [
      PREFIX,
      PARAMS.N,
      PARAMS.r,
      PARAMS.p,
      salt.toString('base64'),
      derived.toString('base64'),
    ].join('$');
  },

  async verify(plain: string, stored: string): Promise<boolean> {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== PREFIX) return false;

    const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
    const N = Number(nRaw);
    const r = Number(rRaw);
    const p = Number(pRaw);
    if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

    const salt = Buffer.from(saltRaw ?? '', 'base64');
    const expected = Buffer.from(hashRaw ?? '', 'base64');
    if (salt.length === 0 || expected.length === 0) return false;

    try {
      const derived = await scrypt(plain.normalize('NFKC'), salt, expected.length, {
        N,
        r,
        p,
        maxmem: PARAMS.maxmem,
      });
      return timingSafeEqual(derived, expected);
    } catch {
      return false;
    }
  },
};

/**
 * A hash of a throwaway value, used to spend the same CPU time when the
 * username does not exist. Without it, response timing reveals which usernames
 * are registered.
 */
export async function dummyVerify(): Promise<void> {
  await passwordHasher.verify('nepostojeca-lozinka', DUMMY_HASH);
}

// Generated once with the parameters above; only ever compared against.
const DUMMY_HASH =
  'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
