import {
  ArrowClockwise,
  ArrowSquareOut,
  Check,
  CircleNotch,
  ClockCountdown,
  Copy,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  Feather,
  GearSix,
  Tray,
  Info,
  LockKey,
  ShieldCheck,
  Trash,
  WarningCircle
} from '@phosphor-icons/react';
import DOMPurify from 'dompurify';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EXPIRY_LABELS, formatRemaining } from '../lib/expiry';
import { DEFAULT_SETTINGS } from '../lib/storage';
import type {
  ExpiryPreset,
  ExtensionState,
  MessageDetail,
  MessageSummary,
  RuntimeRequest,
  RuntimeResponse
} from '../lib/types';
import './inbox.css';

type Surface = 'sidepanel' | 'dashboard';
type View = 'inbox' | 'settings' | 'privacy';

const EMPTY_STATE: ExtensionState = {
  settings: DEFAULT_SETTINGS,
  mailbox: null,
  messages: [],
  lastSignupPassword: null,
  initialSetup: false,
  loading: true,
  error: null
};

async function send(request: RuntimeRequest): Promise<RuntimeResponse> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return previewResponse(request);
  return chrome.runtime.sendMessage(request) as Promise<RuntimeResponse>;
}

const PREVIEW_MESSAGES: MessageSummary[] = [
  { id: '1', from: { name: 'Acme', address: 'verify@acme.example' }, subject: 'Confirm your email', intro: 'Your code is ready.', seen: false, hasAttachments: false, createdAt: new Date().toISOString() },
  { id: '2', from: { name: 'Studio', address: 'hello@studio.example' }, subject: 'Your verification code: 482901', intro: 'Use this code to continue.', seen: false, hasAttachments: false, createdAt: new Date(Date.now() - 60_000).toISOString() },
  { id: '3', from: { name: 'Newsletter', address: 'welcome@letters.example' }, subject: 'Welcome aboard', intro: 'Thanks for joining.', seen: true, hasAttachments: false, createdAt: new Date(Date.now() - 180_000).toISOString() },
  { id: '4', from: { name: 'Paper', address: 'hello@paper.example' }, subject: 'Complete your profile', intro: 'One last step.', seen: true, hasAttachments: false, createdAt: new Date(Date.now() - 240_000).toISOString() },
  { id: '5', from: { name: 'Northstar', address: 'signups@north.example' }, subject: 'Sign-in link', intro: 'Your secure link.', seen: true, hasAttachments: false, createdAt: new Date(Date.now() - 300_000).toISOString() },
  { id: '6', from: { name: 'Fieldnotes', address: 'mail@fieldnotes.example' }, subject: 'Thanks for testing', intro: 'Your account is ready.', seen: true, hasAttachments: false, createdAt: new Date(Date.now() - 360_000).toISOString() },
  { id: '7', from: { name: 'Relay', address: 'verify@relay.example' }, subject: 'Security check', intro: 'Confirm this browser.', seen: true, hasAttachments: false, createdAt: new Date(Date.now() - 420_000).toISOString() },
  { id: '8', from: { name: 'Atlas', address: 'hello@atlas.example' }, subject: 'Email confirmed', intro: 'You are all set.', seen: true, hasAttachments: false, createdAt: new Date(Date.now() - 480_000).toISOString() },
  { id: '9', from: { name: 'Sunday', address: 'welcome@sunday.example' }, subject: 'Your account is active', intro: 'Welcome.', seen: true, hasAttachments: false, createdAt: new Date(Date.now() - 540_000).toISOString() }
];

const PREVIEW_STATE: ExtensionState = {
  settings: { ...DEFAULT_SETTINGS, inboxMode: 'side-panel', expiryPreset: '1h', onboardingSeen: true },
  mailbox: { accountId: 'preview', address: 'a2bcde@x.test', providerPassword: 'private', token: 'preview', createdAt: Date.now(), expiresAt: Date.now() + 52 * 60_000, unreadCount: 2 },
  messages: PREVIEW_MESSAGES,
  lastSignupPassword: 'N7!vM2@rQ9_kP4#xL8sA',
  initialSetup: false,
  loading: false,
  error: null
};

let previewMailboxCreated = false;
let previewMailboxDeleted = false;
let previewSettings = PREVIEW_STATE.settings;

async function previewResponse(request: RuntimeRequest): Promise<RuntimeResponse> {
  const mode = new URLSearchParams(window.location.search).get('state');
  if (request.type === 'GET_STATE' && mode === 'loading') await new Promise((resolve) => window.setTimeout(resolve, 1400));
  if (request.type === 'CREATE_MAILBOX') {
    await new Promise((resolve) => window.setTimeout(resolve, 1100));
    previewMailboxCreated = true;
    previewMailboxDeleted = false;
  }
  if (request.type === 'DELETE_MAILBOX') {
    previewMailboxDeleted = true;
    return { ok: true, state: { ...EMPTY_STATE, settings: previewSettings, loading: false } };
  }
  if (request.type === 'UPDATE_SETTINGS') {
    previewSettings = { ...previewSettings, ...request.patch };
    return { ok: true, state: { ...PREVIEW_STATE, settings: previewSettings } };
  }
  if ((mode === 'empty' && !previewMailboxCreated) || previewMailboxDeleted) {
    return { ok: true, state: { ...EMPTY_STATE, settings: { ...DEFAULT_SETTINGS, onboardingSeen: true }, loading: false } };
  }
  if (request.type === 'READ_MESSAGE') {
    const summary = PREVIEW_MESSAGES.find((message) => message.id === request.messageId) ?? PREVIEW_MESSAGES[0]!;
    const messages = PREVIEW_MESSAGES.map((message) => message.id === summary.id ? { ...message, seen: true } : message);
    const unreadCount = messages.filter((message) => !message.seen).length;
    return {
      ok: true,
      state: { ...PREVIEW_STATE, settings: previewSettings, mailbox: { ...PREVIEW_STATE.mailbox!, unreadCount }, messages },
      message: {
        ...summary,
        seen: true,
        to: [{ name: '', address: PREVIEW_STATE.mailbox!.address }],
        text: 'Your Anonymail verification code is 482901.\n\nThis code expires in ten minutes.',
        html: ['<style>.code{font-size:30px;font-weight:800;letter-spacing:6px;color:#20242b}.card{padding:28px;border-radius:18px;background:#eef2fa}</style><div class="card"><p>Your verification code</p><div class="code">482901</div><p>This code expires in ten minutes.</p></div>']
      }
    };
  }
  return { ok: true, state: { ...PREVIEW_STATE, settings: previewSettings } };
}

export function InboxApp({ surface }: { surface: Surface }) {
  const [state, setState] = useState(EMPTY_STATE);
  const [view, setView] = useState<View>(() => initialView());
  const [setupMode, setSetupMode] = useState(() => new URLSearchParams(window.location.search).get('setup') === '1');
  const [selected, setSelected] = useState<MessageDetail | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [, setClock] = useState(Date.now());

  const applyResponse = useCallback((response: RuntimeResponse) => {
    if (response.ok && response.state) setState(response.state);
    if (!response.ok) setState((current) => ({ ...current, error: response.error, loading: false }));
  }, []);

  const refresh = useCallback(async () => {
    try {
      applyResponse(await send({ type: 'REFRESH_MESSAGES' }));
    } catch {
      setState((current) => ({ ...current, error: 'Inbox refresh failed. Check your connection.', loading: false }));
    }
  }, [applyResponse]);

  useEffect(() => {
    void send({ type: 'GET_STATE' }).then(applyResponse);
    const polling = window.setInterval(() => void refresh(), 10_000);
    const clock = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => {
      window.clearInterval(polling);
      window.clearInterval(clock);
    };
  }, [applyResponse, refresh]);

  useEffect(() => {
    if (!state.loading) return;
    const loadingPoll = window.setInterval(() => void send({ type: 'GET_STATE' }).then(applyResponse), 500);
    return () => window.clearInterval(loadingPoll);
  }, [applyResponse, state.loading]);

  useEffect(() => {
    if (!state.initialSetup) return;
    setView('settings');
    setSetupMode(true);
  }, [state.initialSetup]);

  useEffect(() => {
    const availableIds = new Set(state.messages.map((message) => message.id));
    setSelectedIds((current) => new Set([...current].filter((id) => availableIds.has(id))));
  }, [state.messages]);

  async function createMailbox(replace = false) {
    setBusy(true);
    setGenerating(true);
    setSelected(null);
    setSelectedIds(new Set());
    try {
      applyResponse(await send({ type: 'CREATE_MAILBOX', replace }));
    } finally {
      setGenerating(false);
      setBusy(false);
    }
  }

  async function deleteMailbox() {
    if (!state.mailbox || !window.confirm('Delete this mailbox and all of its messages?')) return;
    setBusy(true);
    setSelected(null);
    setSelectedIds(new Set());
    try {
      const response = await send({ type: 'DELETE_MAILBOX' });
      applyResponse(response);
      if (response.ok) {
        setView('inbox');
        setSetupMode(false);
      }
    } finally {
      setBusy(false);
    }
  }

  async function updateSettings(patch: Partial<ExtensionState['settings']>) {
    applyResponse(await send({ type: 'UPDATE_SETTINGS', patch }));
  }

  async function saveSettingsAndReturn() {
    setBusy(true);
    try {
      if (setupMode || state.initialSetup) applyResponse(await send({ type: 'COMPLETE_INITIAL_SETUP' }));
      setSetupMode(false);
      setView('inbox');
    } finally {
      setBusy(false);
    }
  }

  async function openMessage(message: MessageSummary) {
    if (!message.seen) {
      setState((current) => ({
        ...current,
        mailbox: current.mailbox
          ? { ...current.mailbox, unreadCount: Math.max(0, current.mailbox.unreadCount - 1) }
          : null,
        messages: current.messages.map((item) => item.id === message.id ? { ...item, seen: true } : item)
      }));
    }
    setBusy(true);
    try {
      const response = await send({ type: 'READ_MESSAGE', messageId: message.id });
      applyResponse(response);
      if (response.ok && response.message) setSelected(response.message);
    } finally {
      setBusy(false);
    }
  }

  function toggleMessage(messageId: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(messageId);
      else next.delete(messageId);
      return next;
    });
  }

  async function deleteSelectedMessages() {
    if (!selectedIds.size || !window.confirm(`Delete ${selectedIds.size} selected message${selectedIds.size === 1 ? '' : 's'}?`)) return;
    setBusy(true);
    try {
      const response = await send({ type: 'DELETE_MESSAGES', messageIds: [...selectedIds] });
      applyResponse(response);
      if (selected && selectedIds.has(selected.id)) setSelected(null);
      if (response.ok) setSelectedIds(new Set());
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string, key: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1400);
  }

  const remaining = formatRemaining(state.mailbox?.expiresAt ?? null);

  return (
    <div className={`app-shell ${surface}`}>
      {generating && (state.mailbox || view !== 'inbox') && <GenerationOverlay />}
      {!generating && state.loading && state.mailbox && <GenerationOverlay />}
      {surface === 'dashboard' && (
        <aside className="sidebar">
          <div className="brand" aria-label="Anonymail">
            <img src="/icons/anonymail.png" alt="" />
            <span>Anonymail</span>
          </div>
          <nav aria-label="Mailbox navigation">
            <NavButton active={view === 'inbox'} icon={<Tray />} label="Inbox" badge={state.mailbox?.unreadCount} onClick={() => setView('inbox')} />
            <NavButton active={view === 'settings'} icon={<GearSix />} label="Settings" onClick={() => setView('settings')} />
            <NavButton active={view === 'privacy'} icon={<ShieldCheck />} label="Privacy" onClick={() => setView('privacy')} />
          </nav>
          <div className="sidebar-note">
            <Feather weight="fill" />
            <span>One quiet inbox.<br />No tracking.</span>
          </div>
          <a className="provider-link" href="https://mail.tm" target="_blank" rel="noreferrer">Mail by Mail.tm <ArrowSquareOut /></a>
        </aside>
      )}

      <main className="workspace">
        <header className="topbar">
          <button className="mark-button" aria-label="Inbox" onClick={() => setView('inbox')}>
            <img src="/icons/icon-48.png" alt="" />
          </button>
          {surface === 'sidepanel' && (
            <div className="topbar-actions">
              <button className="icon-button" title="Settings" aria-label="Settings" onClick={() => setView('settings')}>
                <GearSix />
              </button>
              <button className="icon-button" title="Open full dashboard" aria-label="Open full dashboard" onClick={() => void send({ type: 'OPEN_DASHBOARD' })}>
                <ArrowSquareOut />
              </button>
            </div>
          )}
        </header>

        {!state.settings.onboardingSeen && (
          <section className="onboarding-banner">
            <Info weight="fill" />
            <p>Pin Anonymail from Chrome’s Extensions menu so the unread badge stays one click away.</p>
            <button onClick={() => void updateSettings({ onboardingSeen: true })}>Got it</button>
          </section>
        )}

        {state.error && (
          <div className="error-banner" role="alert"><WarningCircle weight="fill" /> {state.error}</div>
        )}

        {view === 'settings' ? (
          <SettingsView state={state} firstRun={setupMode} busy={busy} onUpdate={updateSettings} onDelete={deleteMailbox} onSave={saveSettingsAndReturn} />
        ) : view === 'privacy' ? (
          <PrivacyView />
        ) : (
          !state.mailbox ? (
            <EmptyInbox loading={state.loading || busy} onCreate={() => void createMailbox(false)} />
          ) : (
            <>
              <MailboxCard
                state={state}
                remaining={remaining}
                copied={copied}
                showPassword={showPassword}
                busy={busy}
                onCopy={copy}
                onTogglePassword={() => setShowPassword((value) => !value)}
                onRegenerate={() => void createMailbox(true)}
              />

              <section className="mail-card">
                <div className="mail-toolbar">
                  <div className="section-title"><EnvelopeSimple weight="fill" /> Inbox {Boolean(state.mailbox.unreadCount) && <span>{state.mailbox.unreadCount}</span>}</div>
                  <div className="mail-toolbar-actions">
                    {selectedIds.size > 0 && <small>{selectedIds.size} selected</small>}
                    {selectedIds.size > 0 && (
                      <button className="icon-button delete-selected" title="Delete selected messages" aria-label="Delete selected messages" disabled={busy} onClick={() => void deleteSelectedMessages()}>
                        <Trash />
                      </button>
                    )}
                    <button className="icon-button" title="Refresh inbox" aria-label="Refresh inbox" disabled={busy} onClick={() => void refresh()}>
                      <ArrowClockwise className={busy ? 'spin' : ''} />
                    </button>
                  </div>
                </div>

                <div className={`mail-content ${selected ? 'reading' : ''}`}>
                  <MessageList messages={state.messages} selectedIds={selectedIds} onToggle={toggleMessage} onOpen={openMessage} />
                  {selected && <MessageReader message={selected} onBack={() => setSelected(null)} />}
                </div>
              </section>
            </>
          )
        )}
      </main>
    </div>
  );
}

function NavButton({ active, icon, label, badge, onClick }: { active: boolean; icon: React.ReactNode; label: string; badge?: number; onClick: () => void }) {
  return <button className={active ? 'nav-item active' : 'nav-item'} onClick={onClick}>{icon}<span>{label}</span>{Boolean(badge) && <b>{badge}</b>}</button>;
}

function EmptyInbox({ loading, onCreate }: { loading: boolean; onCreate: () => void }) {
  return (
    <section className="empty-inbox">
      {loading ? (
        <div className="creating-state" role="status" aria-live="polite">
          <CircleNotch className="spin" aria-hidden="true" />
          <p>Creating your disposable email…</p>
        </div>
      ) : (
        <div>
          <h1>No disposable email yet.</h1>
          <p><strong>Right-click any signup form</strong> to fill it instantly, or create one here.</p>
          <button className="primary-button" onClick={onCreate}>Create disposable email</button>
        </div>
      )}
    </section>
  );
}

function GenerationOverlay() {
  return (
    <div className="generation-overlay" role="status" aria-live="polite">
      <div><CircleNotch className="spin" aria-hidden="true" /><p>Preparing your private signup…</p></div>
    </div>
  );
}

function MailboxCard({ state, remaining, copied, showPassword, busy, onCopy, onTogglePassword, onRegenerate }: {
  state: ExtensionState;
  remaining: string;
  copied: string | null;
  showPassword: boolean;
  busy: boolean;
  onCopy: (value: string, key: string) => void;
  onTogglePassword: () => void;
  onRegenerate: () => void;
}) {
  if (!state.mailbox) return null;

  return (
    <section className="mailbox-card">
      <div className="mailbox-card-top">
        <MailboxTimer remaining={remaining} className="desktop-timer" />
        <button className="replace-button" disabled={busy} title="Replace inbox" aria-label="Replace inbox" onClick={onRegenerate}>
          <ArrowClockwise className={busy ? 'spin' : ''} />
        </button>
      </div>
      <div className="mailbox-details">
        <div className="mailbox-main">
          <div className="mailbox-label-row">
            <p className="eyebrow">Active disposable address</p>
            <MailboxTimer remaining={remaining} className="panel-timer" />
          </div>
          <div className="address-row">
            <h1>{state.mailbox.address}</h1>
            <button className="copy-button" onClick={() => void onCopy(state.mailbox!.address, 'email')}>
              {copied === 'email' ? <Check /> : <Copy />} {copied === 'email' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
        <div className="credential-card">
          <div><LockKey weight="fill" /><span>Latest signup password</span></div>
          {state.lastSignupPassword ? (
            <div className="password-row">
              <code>{showPassword ? state.lastSignupPassword : '••••••••••••••••••••'}</code>
              <button title={showPassword ? 'Hide password' : 'Reveal password'} onClick={onTogglePassword}>{showPassword ? <EyeSlash /> : <Eye />}</button>
              <button title="Copy password" onClick={() => void onCopy(state.lastSignupPassword!, 'password')}>{copied === 'password' ? <Check /> : <Copy />}</button>
            </div>
          ) : <p>A password appears here after you create or fill a signup.</p>}
        </div>
      </div>
    </section>
  );
}

function MailboxTimer({ remaining, className }: { remaining: string; className: string }) {
  return <div className={`mailbox-timer ${className}`}><ClockCountdown weight="fill" /><strong>{remaining}</strong><span>remaining</span></div>;
}

function MessageList({ messages, selectedIds, onToggle, onOpen }: {
  messages: MessageSummary[];
  selectedIds: Set<string>;
  onToggle: (messageId: string, checked: boolean) => void;
  onOpen: (message: MessageSummary) => void;
}) {
  if (!messages.length) return <div className="list-empty"><p>Your inbox is empty.</p></div>;
  return (
    <div className="message-list" role="list">
      {messages.map((message) => {
        const checked = selectedIds.has(message.id);
        return (
          <div key={message.id} className={`message-row ${!message.seen ? 'unread' : ''}`} role="listitem">
            <label className="message-selector" title="Select message">
              <input type="checkbox" checked={checked} aria-label={`Select ${message.subject || 'message'}`} onChange={(event) => onToggle(message.id, event.target.checked)} />
              <span aria-hidden="true">{checked && <Check />}</span>
            </label>
            <button className="message-open" onClick={() => onOpen(message)}>
              <span className="message-sender">{message.from.name || message.from.address.split('@')[0]}</span>
              <span className="message-subject">{message.subject || '(No subject)'}</span>
              <time>{formatDate(message.createdAt)}</time>
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function buildSafeEmailDocument(html: string[]): string {
  const parsed = new DOMParser().parseFromString(html.join(''), 'text/html');
  const css = [...parsed.querySelectorAll('style')]
    .map((style) => style.textContent ?? '')
    .join('\n')
    .replace(/@import[^;]+;/gi, '')
    .replace(/url\s*\([^)]*\)/gi, 'none')
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(/<\/style/gi, '<\\/style');
  parsed.querySelectorAll('style').forEach((style) => style.remove());
  const sanitized = DOMPurify.sanitize(parsed.body.innerHTML, {
    ADD_ATTR: ['style'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'img', 'link', 'meta', 'base', 'video', 'audio', 'source'],
    FORBID_ATTR: ['src', 'srcset', 'poster', 'href', 'action', 'formaction', 'target']
  });
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: cid:; style-src 'unsafe-inline'; font-src data:"><style>html{color:#444e5b;background:#fff;font:14px/1.6 Inter,Arial,sans-serif}body{margin:0;padding:2px;overflow-wrap:anywhere;max-width:100%}table{max-width:100%!important}pre{white-space:pre-wrap}a{color:#4b5f7c;text-decoration:underline}</style>${css ? `<style>${css}</style>` : ''}</head><body>${sanitized}</body></html>`;
}

function MessageReader({ message, onBack }: { message: MessageDetail; onBack: () => void }) {
  const hasHtml = message.html.some((part) => part.trim().length > 0);
  const safeDocument = useMemo(() => buildSafeEmailDocument(message.html), [message.html]);
  return (
    <article className="message-reader">
      <button className="reader-back" onClick={onBack}>← Inbox</button>
      <p className="eyebrow">From {message.from.name || message.from.address}</p>
      <h2>{message.subject || '(No subject)'}</h2>
      <div className="sender-line"><span>{message.from.address}</span><time>{new Date(message.createdAt).toLocaleString()}</time></div>
      {hasHtml ? (
        <iframe className="safe-html-frame" title={`Email content: ${message.subject || 'No subject'}`} sandbox="" referrerPolicy="no-referrer" srcDoc={safeDocument} />
      ) : (
        <pre>{message.text}</pre>
      )}
      {message.hasAttachments && <div className="attachment-note"><ShieldCheck /> Attachments are blocked in this privacy-first beta.</div>}
    </article>
  );
}

function SettingsView({ state, firstRun, busy, onUpdate, onDelete, onSave }: {
  state: ExtensionState;
  firstRun: boolean;
  busy: boolean;
  onUpdate: (patch: Partial<ExtensionState['settings']>) => void;
  onDelete: () => void;
  onSave: () => void;
}) {
  return (
    <section className="settings-card">
      <p className="eyebrow">{firstRun ? 'First-time setup' : 'Preferences'}</p>
      <h1>{firstRun ? 'Set up Anonymail before you start.' : 'Keep Anonymail out of your way.'}</h1>
      {firstRun && <p className="setup-copy">Choose how Anonymail opens, how long it remembers the current signup, and which fields it may fill.</p>}
      <div className="setting-row">
        <div><strong>Open inbox in</strong><p>The side panel persists across eligible tabs in one Chrome window.</p></div>
        <select value={state.settings.inboxMode} onChange={(event) => onUpdate({ inboxMode: event.target.value as ExtensionState['settings']['inboxMode'] })}>
          <option value="side-panel">Side panel</option><option value="new-tab">Dashboard tab</option>
        </select>
      </div>
      <div className="setting-row">
        <div><strong>Mailbox lifetime</strong><p>Changing this applies to the current inbox from its creation time.</p></div>
        <select value={state.settings.expiryPreset} onChange={(event) => onUpdate({ expiryPreset: event.target.value as ExpiryPreset })}>
          {(Object.keys(EXPIRY_LABELS) as ExpiryPreset[]).map((preset) => <option key={preset} value={preset}>{EXPIRY_LABELS[preset]}</option>)}
        </select>
      </div>
      <div className="setting-group">
        <div className="setting-group-heading"><strong>Smart form fill</strong><p>Anonymail classifies fields locally. Page contents never leave your browser.</p></div>
        <AutofillToggle label="Email address" description="Fill the active disposable address." checked={state.settings.autofillEmail} onChange={(autofillEmail) => onUpdate({ autofillEmail })} />
        <AutofillToggle label="Password" description="Generate and fill a unique 20-character password." checked={state.settings.autofillPassword} onChange={(autofillPassword) => onUpdate({ autofillPassword })} />
        <AutofillToggle label="Dummy name" description="Fill full, first, and last name fields." checked={state.settings.autofillName} onChange={(autofillName) => onUpdate({ autofillName })} />
        <AutofillToggle label="Dummy address" description="Fill street, city, state, postal code, and country. Phone fields are always skipped." checked={state.settings.autofillAddress} onChange={(autofillAddress) => onUpdate({ autofillAddress })} />
      </div>
      <div className="danger-zone">
        <div><strong>Delete active mailbox</strong><p>This cannot be undone.</p></div>
        <button disabled={!state.mailbox} onClick={onDelete}><Trash /> Delete</button>
      </div>
      <div className="settings-actions">
        <button className="primary-button" disabled={busy} onClick={onSave}>Save settings</button>
      </div>
    </section>
  );
}

function AutofillToggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span><strong>{label}</strong><small>{description}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function PrivacyView() {
  return (
    <section className="settings-card privacy-copy">
      <p className="eyebrow">Privacy promise</p>
      <h1>Your browsing stays in your browser.</h1>
      <p>Anonymail does not collect analytics, browsing history, signup URLs, or form contents. It sends only the generated mailbox credentials and inbox requests directly to Mail.tm.</p>
      <div className="privacy-grid">
        <div><ShieldCheck weight="fill" /><strong>Explicit access</strong><p>Website access is granted only when you invoke Anonymail.</p></div>
        <div><LockKey weight="fill" /><strong>Separate secrets</strong><p>Your signup password is never the same as the mailbox provider password.</p></div>
        <div><ClockCountdown weight="fill" /><strong>Matched memory</strong><p>Signup passwords use the mailbox lifetime and remain session-only.</p></div>
      </div>
      <p className="small-print">Mail delivery is provided by Mail.tm. “Until deleted” disables Anonymail’s timer, but the provider may independently remove inactive accounts.</p>
    </section>
  );
}

function initialView(): View {
  const requested = new URLSearchParams(window.location.search).get('view');
  return requested === 'settings' || requested === 'privacy' ? requested : 'inbox';
}

function formatDate(value: string): string {
  const date = new Date(value);
  const today = new Date();
  return date.toDateString() === today.toDateString() ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
