import { expiresAtFor, isExpired } from '../lib/expiry';
import { fillSignupForm } from '../lib/autofill';
import { generateDummyIdentity } from '../lib/identity';
import { MailTmProvider } from '../lib/mailtm';
import { generateSignupPassword } from '../lib/password';
import {
  getLastPendingPassword,
  getLocallyReadMessageIds,
  getMailbox,
  getPendingDeletion,
  getPendingPassword,
  getSettings,
  getInitialSetupPending,
  protectStorage,
  clearPendingPasswords,
  saveMailbox,
  saveLocallyReadMessageIds,
  savePendingDeletion,
  savePendingPassword,
  saveSettings,
  setInitialSetupPending,
  clearLocallyReadMessageIds,
  updatePendingPasswordExpiry
} from '../lib/storage';
import type {
  ExtensionState,
  InboxMode,
  MailboxSession,
  MessageSummary,
  RuntimeRequest,
  RuntimeResponse,
  Settings
} from '../lib/types';

const CONTEXT_MENU_ID = 'anonymail-fill';
const POLL_ALARM = 'anonymail-poll';
const provider = new MailTmProvider();

let cachedMode: InboxMode = 'side-panel';
let messageCache: MessageSummary[] = [];
let lastError: string | null = null;
let mailboxCreation: Promise<MailboxSession> | null = null;
let generationOperations = 0;
let cachedInitialSetupPending = false;

export default defineBackground(() => {
  void initialize();

  chrome.runtime.onInstalled.addListener((details) => {
    void chrome.contextMenus.removeAll().then(() => {
      chrome.contextMenus.create({
        id: CONTEXT_MENU_ID,
        title: 'Fill with Anonymail',
        contexts: ['editable']
      });
    });
    void chrome.alarms.create(POLL_ALARM, { periodInMinutes: 1 });
    if (details.reason === 'install') {
      cachedInitialSetupPending = true;
      void setInitialSetupPending(true);
      void configureActionBehavior('side-panel', true);
    }
  });

  chrome.runtime.onStartup.addListener(() => void initialize());
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === POLL_ALARM) void backgroundTick();
  });

  chrome.action.onClicked.addListener((tab) => {
    if (tab.windowId !== undefined) openPreferredSurface(tab.windowId, true);
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== CONTEXT_MENU_ID || !info.editable || tab?.id === undefined) return;
    if (tab.windowId !== undefined) openPreferredSurface(tab.windowId, false);
    void handleAutofill(tab.id, info.frameId);
  });

  chrome.runtime.onMessage.addListener((request: RuntimeRequest, _sender, sendResponse) => {
    void handleRequest(request)
      .then(sendResponse)
      .catch((error: unknown) => sendResponse({ ok: false, error: errorMessage(error) } satisfies RuntimeResponse));
    return true;
  });
});

async function initialize(): Promise<void> {
  await protectStorage();
  const [settings, initialSetupPending] = await Promise.all([getSettings(), getInitialSetupPending()]);
  cachedMode = settings.inboxMode;
  cachedInitialSetupPending = initialSetupPending;
  await configureActionBehavior(settings.inboxMode, initialSetupPending);
  await chrome.alarms.create(POLL_ALARM, { periodInMinutes: 1 });
  await retryPendingDeletion();
  await backgroundTick();
}

async function configureActionBehavior(mode: InboxMode, initialSetupPending: boolean): Promise<void> {
  await chrome.sidePanel.setPanelBehavior({
    openPanelOnActionClick: initialSetupPending || mode === 'side-panel'
  });
}

function openPreferredSurface(windowId: number, activateDashboard: boolean): void {
  if (cachedInitialSetupPending || cachedMode === 'side-panel') {
    void chrome.sidePanel.open({ windowId }).catch(() => undefined);
  } else {
    void openDashboard(activateDashboard);
  }
}

async function openDashboard(active: boolean): Promise<void> {
  const stored = await chrome.storage.session.get('dashboardTabId');
  const existingId = stored.dashboardTabId as number | undefined;
  if (existingId !== undefined) {
    try {
      await chrome.tabs.get(existingId);
      await chrome.tabs.update(existingId, { active });
      return;
    } catch {
      await chrome.storage.session.remove('dashboardTabId');
    }
  }
  const tab = await chrome.tabs.create({ url: chrome.runtime.getURL('/dashboard.html'), active });
  if (tab.id !== undefined) await chrome.storage.session.set({ dashboardTabId: tab.id });
}

async function withGenerationFeedback<T>(operation: () => Promise<T>): Promise<T> {
  generationOperations += 1;
  try {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return await operation();
  } finally {
    generationOperations = Math.max(0, generationOperations - 1);
  }
}

async function handleAutofill(tabId: number, frameId?: number): Promise<void> {
  try {
    await withGenerationFeedback(async () => {
      const focused = await inspectFocusedField(tabId, frameId);
      const settings = await getSettings();
      const mailbox = settings.autofillEmail ? await ensureMailbox() : await getMailbox();
      const password = settings.autofillPassword
        ? focused === 'password'
          ? (await getPendingPassword(tabId)) ?? generateSignupPassword()
          : generateSignupPassword()
        : null;
      if (password) await savePendingPassword(tabId, password, mailbox?.expiresAt ?? expiresAtFor(settings.expiryPreset));
      await fillFocusedField(tabId, frameId, {
        email: mailbox?.address ?? null,
        password,
        identity: generateDummyIdentity(),
        settings
      });
    });
    lastError = null;
  } catch (error) {
    lastError = errorMessage(error);
    await chrome.action.setBadgeBackgroundColor({ color: '#b42318' });
    await chrome.action.setBadgeText({ text: '!' });
    await chrome.action.setTitle({ title: `Anonymail: ${lastError}` });
  }
}

async function inspectFocusedField(tabId: number, frameId?: number): Promise<'email' | 'password' | 'other'> {
  const results = await chrome.scripting.executeScript({
    target: frameId === undefined ? { tabId } : { tabId, frameIds: [frameId] },
    func: () => {
      let active: Element | null = document.activeElement;
      while (active instanceof HTMLElement && active.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
      if (active instanceof HTMLInputElement) {
        if (active.type === 'password') return 'password' as const;
        if (active.type === 'email' || active.autocomplete === 'email' || /e-?mail/i.test(`${active.name} ${active.id}`)) {
          return 'email' as const;
        }
      }
      return 'other' as const;
    }
  });
  return results[0]?.result ?? 'other';
}

async function fillFocusedField(
  tabId: number,
  frameId: number | undefined,
  payload: Parameters<typeof fillSignupForm>[0]
): Promise<void> {
  const results = await chrome.scripting.executeScript({
    target: frameId === undefined ? { tabId } : { tabId, frameIds: [frameId] },
    args: [payload],
    func: fillSignupForm
  });
  if (!results[0]?.result) throw new Error('Anonymail could not access the selected field.');
}

async function ensureMailbox(): Promise<MailboxSession> {
  let mailbox = await getMailbox();
  if (mailbox && isExpired(mailbox.expiresAt)) {
    await removeMailbox(mailbox);
    mailbox = null;
  }
  if (mailbox) return mailbox;
  if (mailboxCreation) return mailboxCreation;
  mailboxCreation = (async () => {
    const settings = await getSettings();
    const created = await provider.createMailbox(expiresAtFor(settings.expiryPreset));
    await saveMailbox(created);
    messageCache = [];
    await updateBadge(created.unreadCount);
    return created;
  })();
  try {
    return await mailboxCreation;
  } finally {
    mailboxCreation = null;
  }
}

async function refreshMessages(): Promise<MailboxSession | null> {
  const mailbox = await getMailbox();
  if (!mailbox) {
    messageCache = [];
    await updateBadge(0);
    return null;
  }
  if (isExpired(mailbox.expiresAt)) {
    await removeMailbox(mailbox);
    return null;
  }
  const providerMessages = await provider.listMessages(mailbox);
  const providerMessageIds = new Set(providerMessages.map((message) => message.id));
  let locallyReadMessageIds = await getLocallyReadMessageIds(mailbox.accountId);
  for (const message of providerMessages) {
    if (message.seen) locallyReadMessageIds.delete(message.id);
  }
  locallyReadMessageIds = new Set(
    [...locallyReadMessageIds].filter((id) => providerMessageIds.has(id))
  );
  await saveLocallyReadMessageIds(mailbox.accountId, locallyReadMessageIds);
  messageCache = providerMessages.map((message) =>
    locallyReadMessageIds.has(message.id) ? { ...message, seen: true } : message
  );
  const unreadCount = messageCache.filter((message) => !message.seen).length;
  const next = { ...mailbox, unreadCount };
  await saveMailbox(next);
  await updateBadge(unreadCount);
  lastError = null;
  return next;
}

async function updateBadge(count: number): Promise<void> {
  await chrome.action.setBadgeBackgroundColor({ color: '#d92d20' });
  await chrome.action.setBadgeText({ text: count > 99 ? '99+' : count > 0 ? String(count) : '' });
  await chrome.action.setTitle({ title: count > 0 ? `Anonymail — ${count} unread` : 'Open Anonymail' });
}

async function markMessageReadLocally(mailbox: MailboxSession, messageId: string): Promise<void> {
  const locallyReadMessageIds = await getLocallyReadMessageIds(mailbox.accountId);
  locallyReadMessageIds.add(messageId);
  await saveLocallyReadMessageIds(mailbox.accountId, locallyReadMessageIds);
  const cached = messageCache.some((message) => message.id === messageId);
  messageCache = messageCache.map((message) => message.id === messageId ? { ...message, seen: true } : message);
  const unreadCount = cached
    ? messageCache.filter((message) => !message.seen).length
    : Math.max(0, mailbox.unreadCount - 1);
  await saveMailbox({ ...mailbox, unreadCount });
  await updateBadge(unreadCount);
}

async function removeMailbox(mailbox: MailboxSession): Promise<void> {
  await saveMailbox(null);
  await clearPendingPasswords();
  messageCache = [];
  await clearLocallyReadMessageIds();
  await updateBadge(0);
  await savePendingDeletion({ accountId: mailbox.accountId, token: mailbox.token });
  await retryPendingDeletion();
}

async function retryPendingDeletion(): Promise<void> {
  const pending = await getPendingDeletion();
  if (!pending) return;
  try {
    await provider.deleteMailbox(pending.accountId, pending.token);
    await savePendingDeletion(null);
  } catch {
    // Remains queued for the next alarm or browser start.
  }
}

async function backgroundTick(): Promise<void> {
  await retryPendingDeletion();
  try {
    await refreshMessages();
  } catch (error) {
    lastError = errorMessage(error);
  }
}

async function getState(): Promise<ExtensionState> {
  const [settings, mailbox, lastSignupPassword, initialSetup] = await Promise.all([
    getSettings(),
    getMailbox(),
    getLastPendingPassword(),
    getInitialSetupPending()
  ]);
  return {
    settings,
    mailbox,
    messages: messageCache,
    lastSignupPassword,
    initialSetup,
    loading: Boolean(mailboxCreation) || generationOperations > 0,
    error: lastError
  };
}

async function handleRequest(request: RuntimeRequest): Promise<RuntimeResponse> {
  switch (request.type) {
    case 'GET_STATE':
      await backgroundTick();
      return { ok: true, state: await getState() };
    case 'CREATE_MAILBOX': {
      await withGenerationFeedback(async () => {
        const current = await getMailbox();
        if (current && request.replace) await removeMailbox(current);
        const mailbox = await ensureMailbox();
        const password = generateSignupPassword();
        const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        await savePendingPassword(activeTab?.id ?? null, password, mailbox.expiresAt);
      });
      return { ok: true, state: await getState() };
    }
    case 'REFRESH_MESSAGES':
      await refreshMessages();
      return { ok: true, state: await getState() };
    case 'READ_MESSAGE': {
      const mailbox = await getMailbox();
      if (!mailbox) throw new Error('This mailbox is no longer available.');
      const message = await provider.getMessage(mailbox, request.messageId);
      if (!message.seen) {
        await markMessageReadLocally(mailbox, request.messageId);
        try {
          await provider.markRead(mailbox, request.messageId);
        } catch {
          // Reading the message must not fail when Mail.tm cannot persist the seen flag.
        }
      }
      return { ok: true, state: await getState(), message: { ...message, seen: true } };
    }
    case 'DELETE_MESSAGES': {
      const mailbox = await getMailbox();
      if (!mailbox) throw new Error('This mailbox is no longer available.');
      const availableIds = new Set(messageCache.map((message) => message.id));
      const messageIds = [...new Set(request.messageIds)].filter((id) => availableIds.has(id));
      for (const messageId of messageIds) await provider.deleteMessage(mailbox, messageId);
      messageCache = messageCache.filter((message) => !messageIds.includes(message.id));
      const locallyReadMessageIds = await getLocallyReadMessageIds(mailbox.accountId);
      for (const messageId of messageIds) locallyReadMessageIds.delete(messageId);
      await saveLocallyReadMessageIds(mailbox.accountId, locallyReadMessageIds);
      const unreadCount = messageCache.filter((message) => !message.seen).length;
      await saveMailbox({ ...mailbox, unreadCount });
      await updateBadge(unreadCount);
      return { ok: true, state: await getState() };
    }
    case 'DELETE_MAILBOX': {
      const mailbox = await getMailbox();
      if (mailbox) await removeMailbox(mailbox);
      return { ok: true, state: await getState() };
    }
    case 'UPDATE_SETTINGS': {
      const current = await getSettings();
      const settings: Settings = { ...current, ...request.patch };
      await saveSettings(settings);
      cachedMode = settings.inboxMode;
      await configureActionBehavior(settings.inboxMode, cachedInitialSetupPending);
      if (request.patch.expiryPreset) {
        const mailbox = await getMailbox();
        if (mailbox) {
          const expiresAt = expiresAtFor(settings.expiryPreset, mailbox.createdAt);
          if (isExpired(expiresAt)) await removeMailbox(mailbox);
          else {
            await saveMailbox({ ...mailbox, expiresAt });
            await updatePendingPasswordExpiry(expiresAt);
          }
        }
      }
      return { ok: true, state: await getState() };
    }
    case 'COMPLETE_INITIAL_SETUP':
      cachedInitialSetupPending = false;
      await setInitialSetupPending(false);
      await configureActionBehavior(cachedMode, false);
      return { ok: true, state: await getState() };
    case 'OPEN_DASHBOARD':
      await openDashboard(true);
      return { ok: true };
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
