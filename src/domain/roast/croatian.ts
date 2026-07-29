/**
 * Croatian plural forms. Croatian uses three: 1, 2-4, and 5+, with the 11-14
 * range falling back to the "many" form regardless of its last digit.
 */
export function pluralHr(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  const mod100 = abs % 100;
  const mod10 = abs % 10;

  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export function bodovi(n: number): string {
  return `${n} ${pluralHr(n, 'bod', 'boda', 'bodova')}`;
}

export function utakmice(n: number): string {
  return `${n} ${pluralHr(n, 'utakmicu', 'utakmice', 'utakmica')}`;
}

export function kola(n: number): string {
  return `${n} ${pluralHr(n, 'kolo', 'kola', 'kola')}`;
}

export function mjesto(n: number): string {
  return `${n}. ${pluralHr(n, 'mjesto', 'mjesto', 'mjesto')}`;
}
