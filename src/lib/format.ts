/**
 * Croatian display formatting. Timezone is pinned to Europe/Zagreb so a kickoff
 * reads the same whether it is rendered on a server in Frankfurt or a phone in
 * another country.
 */
const TZ = 'Europe/Zagreb';

const dateTime = new Intl.DateTimeFormat('hr-HR', {
  timeZone: TZ,
  weekday: 'short',
  day: 'numeric',
  month: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const dateOnly = new Intl.DateTimeFormat('hr-HR', {
  timeZone: TZ,
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
});

const shortDate = new Intl.DateTimeFormat('hr-HR', {
  timeZone: TZ,
  day: 'numeric',
  month: 'numeric',
});

const timeOnly = new Intl.DateTimeFormat('hr-HR', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

export function formatDate(iso: string): string {
  return dateOnly.format(new Date(iso));
}

export function formatShortDate(iso: string): string {
  return shortDate.format(new Date(iso));
}

export function formatTime(iso: string): string {
  return timeOnly.format(new Date(iso));
}

export function formatPercent(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

/** Streak as a signed, readable label: "3 pogotka" / "2 bez boda". */
export function formatStreak(streak: number): string {
  if (streak === 0) return '—';
  if (streak > 0) return `${streak} zaredom`;
  return `${-streak} bez boda`;
}
