const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*_-+=';
const ALL = LOWER + UPPER + DIGITS + SYMBOLS;

function randomIndex(max: number): number {
  if (max <= 0 || max > 256) throw new Error('Invalid random range.');
  const ceiling = 256 - (256 % max);
  const value = new Uint8Array(1);
  do crypto.getRandomValues(value); while ((value[0] ?? 0) >= ceiling);
  return (value[0] ?? 0) % max;
}

function pick(source: string): string {
  return source[randomIndex(source.length)] ?? source[0] ?? '';
}

function shuffle(value: string[]): string[] {
  for (let index = value.length - 1; index > 0; index -= 1) {
    const target = randomIndex(index + 1);
    [value[index], value[target]] = [value[target] ?? '', value[index] ?? ''];
  }
  return value;
}

export function generateSignupPassword(length = 20): string {
  if (length < 12) throw new Error('Signup passwords must be at least 12 characters.');
  const password = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  while (password.length < length) password.push(pick(ALL));
  return shuffle(password).join('');
}

export function generateProviderPassword(length = 32): string {
  return generateSignupPassword(length);
}

export function generateMailboxName(): string {
  const alphabet = LOWER + DIGITS;
  return `a${Array.from({ length: 5 }, () => pick(alphabet)).join('')}`;
}
