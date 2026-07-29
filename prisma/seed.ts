/**
 * Seed: the minimum a fresh database needs to be usable.
 *
 * Idempotent - safe to run repeatedly. It never overwrites an existing admin
 * password, so re-seeding a live database cannot reset someone's credentials.
 */
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { ACHIEVEMENTS } from '../src/domain/achievement/definitions';
import { passwordHasher } from '../src/infrastructure/auth/password';

for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(path.join(process.cwd(), file));
  } catch {
    // Absent file is fine.
  }
}

const prisma = new PrismaClient();

const HAJDUK = {
  name: 'HNK Hajduk Split',
  shortName: 'Hajduk',
  apiFootballTeamId: Number(process.env.API_FOOTBALL_TEAM_ID ?? 620),
};

/** Anything that ever appeared in the public `.env.example`. */
const PLACEHOLDER_PASSWORDS = new Set([
  'promijeni-me',
  'promijeni-me-odmah',
  'promijeni-me-generiranom-tajnom',
  'changeme',
  'password',
  'admin',
]);

const COMPETITIONS = [
  { name: 'SuperSport HNL', shortName: 'HNL', type: 'LEAGUE' as const, apiFootballLeagueId: 210 },
  { name: 'Hrvatski nogometni kup', shortName: 'Kup', type: 'CUP' as const, apiFootballLeagueId: 211 },
  { name: 'UEFA Liga prvaka', shortName: 'LP', type: 'EUROPE' as const, apiFootballLeagueId: 2 },
  { name: 'UEFA Europska liga', shortName: 'EL', type: 'EUROPE' as const, apiFootballLeagueId: 3 },
  { name: 'UEFA Konferencijska liga', shortName: 'KL', type: 'EUROPE' as const, apiFootballLeagueId: 848 },
  { name: 'Prijateljska utakmica', shortName: 'Prij.', type: 'FRIENDLY' as const, apiFootballLeagueId: null },
];

/** Season that runs from July to June, the shape every Croatian season has. */
function seasonWindow(startYear: number): { startsAt: Date; endsAt: Date } {
  return {
    startsAt: new Date(Date.UTC(startYear, 6, 1)),
    endsAt: new Date(Date.UTC(startYear + 1, 5, 30)),
  };
}

async function seedAdmin(): Promise<string> {
  const username = process.env.SEED_ADMIN_USERNAME ?? 'admin';
  const nickname = process.env.SEED_ADMIN_NICKNAME ?? 'Admin';
  const password = process.env.SEED_ADMIN_PASSWORD;

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.log(`  admin "${username}" već postoji, lozinka ostaje nepromijenjena`);
    return existing.id;
  }

  if (!password) {
    throw new Error(
      'SEED_ADMIN_PASSWORD nije postavljen. Postavi ga u .env prije prvog pokretanja seeda.',
    );
  }
  // 12 rather than 8: this account is an administrator and its password is the
  // one people are most likely to leave as-is.
  if (password.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD mora imati barem 12 znakova.');
  }
  // `.env.example` is published in a public repository, so any value copied
  // straight out of it is already public knowledge.
  if (PLACEHOLDER_PASSWORDS.has(password.trim().toLowerCase())) {
    throw new Error(
      'SEED_ADMIN_PASSWORD je vrijednost iz .env.example, koja je javno dostupna. Smisli svoju.',
    );
  }

  const user = await prisma.user.create({
    data: {
      username,
      nickname,
      passwordHash: await passwordHasher.hash(password),
      role: 'ADMIN',
      // Forces a change on first login so the seed password never stays in use.
      mustChangePassword: true,
    },
  });

  console.log(`  admin "${username}" kreiran (mora promijeniti lozinku pri prvoj prijavi)`);
  return user.id;
}

async function main(): Promise<void> {
  console.log('Seed HajPogodi...');

  const adminId = await seedAdmin();

  await prisma.team.upsert({
    where: { apiFootballTeamId: HAJDUK.apiFootballTeamId },
    create: { ...HAJDUK, isOurClub: true },
    update: { isOurClub: true, shortName: HAJDUK.shortName },
  });
  console.log('  klub: Hajduk');

  for (const competition of COMPETITIONS) {
    await prisma.competition.upsert({
      where: { name: competition.name },
      create: competition,
      update: { shortName: competition.shortName, type: competition.type },
    });
  }
  console.log(`  natjecanja: ${COMPETITIONS.length}`);

  for (const achievement of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { code: achievement.code },
      create: {
        code: achievement.code,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        tier: achievement.tier,
        sortOrder: achievement.sortOrder,
      },
      update: {
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        tier: achievement.tier,
        sortOrder: achievement.sortOrder,
      },
    });
  }
  console.log(`  postignuca: ${ACHIEVEMENTS.length}`);

  const activeSeason = await prisma.season.findFirst({ where: { isActive: true } });
  if (!activeSeason) {
    const startYear = new Date().getUTCMonth() >= 6
      ? new Date().getUTCFullYear()
      : new Date().getUTCFullYear() - 1;

    await prisma.season.create({
      data: {
        name: `HNL ${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`,
        apiYear: startYear,
        ...seasonWindow(startYear),
        isActive: true,
        scoringRuleIds: ['exact-score'],
        createdById: adminId,
        updatedById: adminId,
      },
    });
    console.log(`  sezona: HNL ${startYear}/${String((startYear + 1) % 100).padStart(2, '0')} (aktivna)`);
  } else {
    console.log(`  sezona: ${activeSeason.name} već postoji`);
  }

  console.log('Gotovo.');
}

main()
  .catch((error: unknown) => {
    console.error('Seed nije uspio:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
