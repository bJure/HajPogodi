import { describe, expect, it } from 'vitest';
import {
  isLockImminent,
  isLocked,
  isOpenForPredictions,
  lockReason,
  msUntilLock,
  type LockableMatch,
} from '@/domain/match/lockPolicy';

const NOW = new Date('2026-08-15T18:00:00Z');

function match(overrides: Partial<LockableMatch> = {}): LockableMatch {
  return {
    kickoffAt: new Date('2026-08-15T19:00:00Z'),
    lockOverride: null,
    status: 'SCHEDULED',
    syncState: 'CONFIRMED',
    ...overrides,
  };
}

describe('zakljucavanje prognoza', () => {
  it('drzi prognoze otvorenima prije pocetka utakmice', () => {
    expect(isOpenForPredictions(match(), NOW)).toBe(true);
    expect(lockReason(match(), NOW)).toBe('OPEN');
  });

  it('zakljucava tocno u trenutku pocetka, jer bi sekunda tolerancije bila prednost', () => {
    const kickoff = new Date('2026-08-15T19:00:00Z');
    expect(isLocked(match(), new Date(kickoff.getTime() - 1))).toBe(false);
    expect(isLocked(match(), kickoff)).toBe(true);
  });

  it('ostaje zakljucano nakon pocetka bez obzira je li ijedan posao odraden', () => {
    // Kljucno: status je i dalje SCHEDULED jer cron nije stigao odraditi posao.
    const stale = match({ status: 'SCHEDULED' });
    expect(isLocked(stale, new Date('2026-08-15T21:00:00Z'))).toBe(true);
  });

  it('rucno zakljucavanje admina zatvara utakmicu i prije pocetka', () => {
    expect(lockReason(match({ lockOverride: true }), NOW)).toBe('ADMIN_LOCKED');
  });

  it('rucno otkljucavanje admina ponovno otvara utakmicu i nakon pocetka', () => {
    const reopened = match({ lockOverride: false, status: 'FINISHED' });
    expect(isOpenForPredictions(reopened, new Date('2026-08-15T22:00:00Z'))).toBe(true);
  });

  it('nepotvrdena utakmica nije otvorena, jer je korisnici ne smiju ni vidjeti', () => {
    expect(lockReason(match({ syncState: 'NEEDS_CONFIRMATION' }), NOW)).toBe('NOT_CONFIRMED');
  });

  it('nepotvrdena utakmica ostaje zatvorena i kad admin postavi otkljucavanje', () => {
    const unconfirmed = match({ syncState: 'NEEDS_CONFIRMATION', lockOverride: false });
    expect(isOpenForPredictions(unconfirmed, NOW)).toBe(false);
  });

  it('otkazana utakmica je zatvorena', () => {
    expect(lockReason(match({ status: 'CANCELLED' }), NOW)).toBe('CANCELLED');
  });

  it('utakmica u tijeku je zakljucana i kad je vrijeme pocetka u buducnosti', () => {
    const live = match({ status: 'LIVE', kickoffAt: new Date('2026-08-15T19:30:00Z') });
    expect(lockReason(live, NOW)).toBe('KICKOFF_PASSED');
  });

  it('odbrojava do zakljucavanja i staje na nuli', () => {
    expect(msUntilLock(match(), NOW)).toBe(60 * 60 * 1000);
    expect(msUntilLock(match(), new Date('2026-08-15T20:00:00Z'))).toBe(0);
  });

  it('upozorava sat vremena prije pocetka, ali ne dva sata prije', () => {
    expect(isLockImminent(match(), new Date('2026-08-15T18:30:00Z'))).toBe(true);
    expect(isLockImminent(match(), new Date('2026-08-15T17:00:00Z'))).toBe(false);
  });

  it('ne upozorava kad je vec zakljucano', () => {
    expect(isLockImminent(match({ lockOverride: true }), NOW)).toBe(false);
  });
});
