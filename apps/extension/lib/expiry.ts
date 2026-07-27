import type { ExpiryPreset } from './types';

export const EXPIRY_LABELS: Record<ExpiryPreset, string> = {
  '10m': '10 minutes',
  '1h': '1 hour',
  '6h': '6 hours',
  '24h': '24 hours',
  'until-deleted': 'Until deleted'
};

const EXPIRY_MS: Record<Exclude<ExpiryPreset, 'until-deleted'>, number> = {
  '10m': 10 * 60_000,
  '1h': 60 * 60_000,
  '6h': 6 * 60 * 60_000,
  '24h': 24 * 60 * 60_000
};

export function expiresAtFor(preset: ExpiryPreset, from = Date.now()): number | null {
  return preset === 'until-deleted' ? null : from + EXPIRY_MS[preset];
}

export function isExpired(expiresAt: number | null, now = Date.now()): boolean {
  return expiresAt !== null && expiresAt <= now;
}

export function formatRemaining(expiresAt: number | null, now = Date.now()): string {
  if (expiresAt === null) return 'Until deleted';
  const remaining = Math.max(0, expiresAt - now);
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}
