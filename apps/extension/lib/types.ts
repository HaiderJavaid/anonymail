export type InboxMode = 'side-panel' | 'new-tab';
export type ExpiryPreset = '10m' | '1h' | '6h' | '24h' | 'until-deleted';

export interface Settings {
  inboxMode: InboxMode;
  expiryPreset: ExpiryPreset;
  onboardingSeen: boolean;
  autofillEmail: boolean;
  autofillPassword: boolean;
  autofillName: boolean;
  autofillAddress: boolean;
}

export interface DummyIdentity {
  firstName: string;
  lastName: string;
  fullName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  countryCode: string;
}

export interface AutofillPayload {
  email: string | null;
  password: string | null;
  identity: DummyIdentity;
  settings: Pick<Settings, 'autofillEmail' | 'autofillPassword' | 'autofillName' | 'autofillAddress'>;
}

export interface AutofillResult {
  filled: boolean;
  filledFields: string[];
}

export interface MailboxSession {
  accountId: string;
  address: string;
  providerPassword: string;
  token: string;
  createdAt: number;
  expiresAt: number | null;
  unreadCount: number;
}

export interface PendingPassword {
  value: string;
  createdAt: number;
  expiresAt: number | null;
}

export interface PendingDeletion {
  accountId: string;
  token: string;
}

export interface MessageSummary {
  id: string;
  from: { address: string; name: string };
  subject: string;
  intro: string;
  seen: boolean;
  hasAttachments: boolean;
  createdAt: string;
}

export interface MessageDetail extends MessageSummary {
  to: Array<{ address: string; name: string }>;
  text: string;
  html: string[];
}

export interface ExtensionState {
  settings: Settings;
  mailbox: MailboxSession | null;
  messages: MessageSummary[];
  lastSignupPassword: string | null;
  initialSetup: boolean;
  loading: boolean;
  error: string | null;
}

export type RuntimeRequest =
  | { type: 'GET_STATE'; tabId?: number }
  | { type: 'CREATE_MAILBOX'; replace?: boolean }
  | { type: 'REFRESH_MESSAGES' }
  | { type: 'READ_MESSAGE'; messageId: string }
  | { type: 'DELETE_MESSAGES'; messageIds: string[] }
  | { type: 'DELETE_MAILBOX' }
  | { type: 'UPDATE_SETTINGS'; patch: Partial<Settings> }
  | { type: 'COMPLETE_INITIAL_SETUP' }
  | { type: 'OPEN_DASHBOARD' };

export type RuntimeResponse =
  | { ok: true; state?: ExtensionState; message?: MessageDetail }
  | { ok: false; error: string };

export interface MailProvider {
  createMailbox(expiresAt: number | null): Promise<MailboxSession>;
  listMessages(session: MailboxSession): Promise<MessageSummary[]>;
  getMessage(session: MailboxSession, id: string): Promise<MessageDetail>;
  markRead(session: MailboxSession, id: string): Promise<void>;
  deleteMessage(session: MailboxSession, id: string): Promise<void>;
  deleteMailbox(accountId: string, token: string): Promise<void>;
}
