import { describe, expect, it } from 'vitest';
import { expiresAtFor, formatRemaining, isExpired } from './expiry';

describe('mailbox expiry', () => {
  const start = 1_700_000_000_000;

  it('maps every timed preset to the correct timestamp', () => {
    expect(expiresAtFor('10m', start)).toBe(start + 600_000);
    expect(expiresAtFor('1h', start)).toBe(start + 3_600_000);
    expect(expiresAtFor('6h', start)).toBe(start + 21_600_000);
    expect(expiresAtFor('24h', start)).toBe(start + 86_400_000);
  });

  it('supports no local expiry', () => {
    expect(expiresAtFor('until-deleted', start)).toBeNull();
    expect(isExpired(null, start + 999_999_999)).toBe(false);
    expect(formatRemaining(null)).toBe('Until deleted');
  });

  it('formats and detects expired sessions', () => {
    expect(formatRemaining(start + 65_000, start)).toBe('1m 05s');
    expect(isExpired(start, start)).toBe(true);
  });
});
