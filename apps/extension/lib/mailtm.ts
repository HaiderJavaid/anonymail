import { z } from 'zod';
import { generateMailboxName, generateProviderPassword } from './password';
import type { MailboxSession, MailProvider, MessageDetail, MessageSummary } from './types';

const API = 'https://api.mail.tm';

const addressSchema = z.object({ address: z.string(), name: z.string().nullable().optional() });
const domainSchema = z.object({ domain: z.string(), isActive: z.boolean().optional() });
const domainsSchema = z.object({ 'hydra:member': z.array(domainSchema) });
const accountSchema = z.object({ id: z.string(), address: z.string(), createdAt: z.string().optional() });
const tokenSchema = z.object({ token: z.string() });
const messageSchema = z.object({
  id: z.string(),
  from: addressSchema,
  to: z.array(addressSchema).optional().default([]),
  subject: z.string().nullable().optional().default(''),
  intro: z.string().nullable().optional().default(''),
  seen: z.boolean().optional().default(false),
  hasAttachments: z.boolean().optional().default(false),
  createdAt: z.string(),
  text: z.string().nullable().optional().default(''),
  html: z.union([z.array(z.string()), z.string(), z.null()]).optional().default([])
});
const messagesSchema = z.object({ 'hydra:member': z.array(messageSchema) });

async function api<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) }
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Mail service error ${response.status}${detail ? `: ${detail.slice(0, 140)}` : ''}`);
  }
  return schema.parse(await response.json());
}

function auth(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

function normalizeAddress(value: z.infer<typeof addressSchema>): { address: string; name: string } {
  return { address: value.address, name: value.name ?? '' };
}

function normalizeMessage(value: z.infer<typeof messageSchema>): MessageSummary {
  return {
    id: value.id,
    from: normalizeAddress(value.from),
    subject: value.subject ?? '',
    intro: value.intro ?? '',
    seen: value.seen,
    hasAttachments: value.hasAttachments,
    createdAt: value.createdAt
  };
}

export class MailTmProvider implements MailProvider {
  async createMailbox(expiresAt: number | null): Promise<MailboxSession> {
    const domains = await api('/domains?page=1', domainsSchema);
    const domain = domains['hydra:member']
      .filter((item) => item.isActive !== false)
      .map((item) => item.domain)
      .sort((left, right) => left.length - right.length || left.localeCompare(right))[0];
    if (!domain) throw new Error('No disposable email domain is currently available.');

    const providerPassword = generateProviderPassword();
    let lastError: unknown;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const address = `${generateMailboxName()}@${domain}`;
      try {
        const account = await api('/accounts', accountSchema, {
          method: 'POST',
          body: JSON.stringify({ address, password: providerPassword })
        });
        const token = await api('/token', tokenSchema, {
          method: 'POST',
          body: JSON.stringify({ address, password: providerPassword })
        });
        return {
          accountId: account.id,
          address: account.address,
          providerPassword,
          token: token.token,
          createdAt: Date.now(),
          expiresAt,
          unreadCount: 0
        };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Unable to create a mailbox.');
  }

  async listMessages(session: MailboxSession): Promise<MessageSummary[]> {
    const result = await api('/messages?page=1', messagesSchema, { headers: auth(session.token) });
    return result['hydra:member'].map(normalizeMessage);
  }

  async getMessage(session: MailboxSession, id: string): Promise<MessageDetail> {
    const value = await api(`/messages/${encodeURIComponent(id)}`, messageSchema, { headers: auth(session.token) });
    return {
      ...normalizeMessage(value),
      to: value.to.map(normalizeAddress),
      text: value.text ?? '',
      html: Array.isArray(value.html) ? value.html : value.html ? [value.html] : []
    };
  }

  async markRead(session: MailboxSession, id: string): Promise<void> {
    const response = await fetch(`${API}/messages/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: auth(session.token)
    });
    if (!response.ok) throw new Error('Unable to mark the message as read.');
  }

  async deleteMessage(session: MailboxSession, id: string): Promise<void> {
    const response = await fetch(`${API}/messages/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: auth(session.token)
    });
    if (!response.ok && response.status !== 404) throw new Error('Unable to delete the message.');
  }

  async deleteMailbox(accountId: string, token: string): Promise<void> {
    const response = await fetch(`${API}/accounts/${encodeURIComponent(accountId)}`, {
      method: 'DELETE',
      headers: auth(token)
    });
    if (!response.ok && response.status !== 404) throw new Error('Unable to delete the mailbox.');
  }
}
