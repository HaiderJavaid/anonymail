import type { MailboxSession, PendingDeletion, PendingPassword, Settings } from './types';

const LOCAL_KEYS = {
  settings: 'settings',
  mailbox: 'mailbox',
  pendingDeletion: 'pendingDeletion',
  initialSetupPending: 'initialSetupPending'
} as const;

const READ_MESSAGES_KEY = 'locallyReadMessages';

interface LocallyReadMessages {
  accountId: string;
  messageIds: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  inboxMode: 'side-panel',
  expiryPreset: '1h',
  onboardingSeen: false,
  autofillEmail: true,
  autofillPassword: true,
  autofillName: false,
  autofillAddress: false
};

export async function protectStorage(): Promise<void> {
  await Promise.all([
    chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }),
    chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
  ]);
}

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(LOCAL_KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...(result[LOCAL_KEYS.settings] as Partial<Settings> | undefined) };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [LOCAL_KEYS.settings]: settings });
}

export async function getInitialSetupPending(): Promise<boolean> {
  const result = await chrome.storage.local.get(LOCAL_KEYS.initialSetupPending);
  return result[LOCAL_KEYS.initialSetupPending] === true;
}

export async function setInitialSetupPending(pending: boolean): Promise<void> {
  if (pending) await chrome.storage.local.set({ [LOCAL_KEYS.initialSetupPending]: true });
  else await chrome.storage.local.remove(LOCAL_KEYS.initialSetupPending);
}

export async function getMailbox(): Promise<MailboxSession | null> {
  const result = await chrome.storage.local.get(LOCAL_KEYS.mailbox);
  return (result[LOCAL_KEYS.mailbox] as MailboxSession | undefined) ?? null;
}

export async function saveMailbox(mailbox: MailboxSession | null): Promise<void> {
  if (mailbox) await chrome.storage.local.set({ [LOCAL_KEYS.mailbox]: mailbox });
  else await chrome.storage.local.remove(LOCAL_KEYS.mailbox);
}

export async function getPendingDeletion(): Promise<PendingDeletion | null> {
  const result = await chrome.storage.local.get(LOCAL_KEYS.pendingDeletion);
  return (result[LOCAL_KEYS.pendingDeletion] as PendingDeletion | undefined) ?? null;
}

export async function savePendingDeletion(value: PendingDeletion | null): Promise<void> {
  if (value) await chrome.storage.local.set({ [LOCAL_KEYS.pendingDeletion]: value });
  else await chrome.storage.local.remove(LOCAL_KEYS.pendingDeletion);
}

export async function getLocallyReadMessageIds(accountId: string): Promise<Set<string>> {
  const result = await chrome.storage.session.get(READ_MESSAGES_KEY);
  const stored = result[READ_MESSAGES_KEY] as LocallyReadMessages | undefined;
  return new Set(stored?.accountId === accountId ? stored.messageIds : []);
}

export async function saveLocallyReadMessageIds(accountId: string, messageIds: Iterable<string>): Promise<void> {
  await chrome.storage.session.set({
    [READ_MESSAGES_KEY]: { accountId, messageIds: [...messageIds] } satisfies LocallyReadMessages
  });
}

export async function clearLocallyReadMessageIds(): Promise<void> {
  await chrome.storage.session.remove(READ_MESSAGES_KEY);
}

function passwordKey(tabId: number): string {
  return `pending-password:${tabId}`;
}

export async function savePendingPassword(tabId: number | null, value: string, expiresAt: number | null): Promise<void> {
  const pending: PendingPassword = { value, createdAt: Date.now(), expiresAt };
  const values: Record<string, PendingPassword | number> = { lastPendingPassword: pending };
  if (tabId !== null) {
    values[passwordKey(tabId)] = pending;
    values.lastPasswordTabId = tabId;
  }
  await chrome.storage.session.set(values);
}

export async function getPendingPassword(tabId: number): Promise<string | null> {
  const result = await chrome.storage.session.get(passwordKey(tabId));
  const pending = result[passwordKey(tabId)] as PendingPassword | undefined;
  if (!pending || (pending.expiresAt !== null && pending.expiresAt <= Date.now())) {
    await chrome.storage.session.remove(passwordKey(tabId));
    return null;
  }
  return pending.value;
}

export async function getLastPendingPassword(): Promise<string | null> {
  const result = await chrome.storage.session.get(['lastPendingPassword', 'lastPasswordTabId']);
  const latest = result.lastPendingPassword as PendingPassword | undefined;
  if (latest) {
    if (latest.expiresAt === null || latest.expiresAt > Date.now()) return latest.value;
    await chrome.storage.session.remove('lastPendingPassword');
  }
  const tabId = result.lastPasswordTabId as number | undefined;
  return tabId === undefined ? null : getPendingPassword(tabId);
}

export async function updatePendingPasswordExpiry(expiresAt: number | null): Promise<void> {
  const stored = await chrome.storage.session.get(null);
  const updates: Record<string, PendingPassword> = {};
  for (const [key, value] of Object.entries(stored)) {
    if (key !== 'lastPendingPassword' && !key.startsWith('pending-password:')) continue;
    const pending = value as PendingPassword | undefined;
    if (pending?.value) updates[key] = { ...pending, expiresAt };
  }
  if (Object.keys(updates).length) await chrome.storage.session.set(updates);
}

export async function clearPendingPasswords(): Promise<void> {
  const stored = await chrome.storage.session.get(null);
  const keys = Object.keys(stored).filter((key) =>
    key === 'lastPendingPassword' || key === 'lastPasswordTabId' || key.startsWith('pending-password:')
  );
  if (keys.length) await chrome.storage.session.remove(keys);
}
