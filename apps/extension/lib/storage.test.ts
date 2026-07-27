import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPendingPasswords,
  clearLocallyReadMessageIds,
  getInitialSetupPending,
  getLastPendingPassword,
  getLocallyReadMessageIds,
  getPendingPassword,
  saveLocallyReadMessageIds,
  savePendingPassword,
  setInitialSetupPending,
  updatePendingPasswordExpiry
} from './storage';

describe('local read markers', () => {
  const session: Record<string, unknown> = {};
  const local: Record<string, unknown> = {};

  beforeEach(() => {
    for (const key of Object.keys(session)) delete session[key];
    for (const key of Object.keys(local)) delete local[key];
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({ [key]: local[key] })),
          set: vi.fn(async (values: Record<string, unknown>) => Object.assign(local, values)),
          remove: vi.fn(async (key: string) => { delete local[key]; })
        },
        session: {
          get: vi.fn(async (keys: string | string[] | null) => {
            if (keys === null) return { ...session };
            const requested = Array.isArray(keys) ? keys : [keys];
            return Object.fromEntries(requested.map((key) => [key, session[key]]));
          }),
          set: vi.fn(async (values: Record<string, unknown>) => Object.assign(session, values)),
          remove: vi.fn(async (keys: string | string[]) => {
            for (const key of Array.isArray(keys) ? keys : [keys]) delete session[key];
          })
        }
      }
    });
  });

  it('persists read markers only for their mailbox account', async () => {
    await saveLocallyReadMessageIds('account-1', ['message-1', 'message-2']);
    expect(await getLocallyReadMessageIds('account-1')).toEqual(new Set(['message-1', 'message-2']));
    expect(await getLocallyReadMessageIds('account-2')).toEqual(new Set());
    await clearLocallyReadMessageIds();
    expect(await getLocallyReadMessageIds('account-1')).toEqual(new Set());
  });

  it('keeps signup passwords for the mailbox lifetime', async () => {
    const expiry = Date.now() + 60_000;
    await savePendingPassword(7, 'site-secret', expiry);
    expect(await getPendingPassword(7)).toBe('site-secret');
    expect(await getLastPendingPassword()).toBe('site-secret');

    await updatePendingPasswordExpiry(Date.now() - 1);
    expect(await getPendingPassword(7)).toBeNull();
    expect(await getLastPendingPassword()).toBeNull();
  });

  it('keeps until-deleted passwords only in session storage and clears them with the mailbox', async () => {
    await savePendingPassword(9, 'session-secret', null);
    expect(await getPendingPassword(9)).toBe('session-secret');
    await clearPendingPasswords();
    expect(await getPendingPassword(9)).toBeNull();
  });

  it('keeps first-activation setup armed across extension restarts until completed', async () => {
    expect(await getInitialSetupPending()).toBe(false);
    await setInitialSetupPending(true);
    expect(await getInitialSetupPending()).toBe(true);
    await setInitialSetupPending(false);
    expect(await getInitialSetupPending()).toBe(false);
  });
});
