import { afterEach, describe, expect, it, vi } from 'vitest';
import { MailTmProvider } from './mailtm';

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

describe('MailTmProvider', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('creates an authenticated mailbox from an active domain', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ 'hydra:member': [
        { domain: 'long-disposable-domain.example', isActive: true },
        { domain: 'x.test', isActive: true }
      ] }))
      .mockResolvedValueOnce(json({ id: 'acct-1', address: 'anon@example.test' }))
      .mockResolvedValueOnce(json({ token: 'secret-token' }));
    vi.stubGlobal('fetch', fetchMock);

    const mailbox = await new MailTmProvider().createMailbox(1234);
    expect(mailbox.accountId).toBe('acct-1');
    expect(mailbox.token).toBe('secret-token');
    expect(mailbox.providerPassword).toHaveLength(32);
    expect(mailbox.expiresAt).toBe(1234);
    const createRequest = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(createRequest.body as string).address).toMatch(/^a[a-z2-9]{5}@x\.test$/);
  });

  it('normalizes message lists and unread flags', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({
      'hydra:member': [{
        id: 'message-1', from: { address: 'hello@example.com', name: null }, to: [],
        subject: null, intro: 'Code 123', seen: false, hasAttachments: false,
        createdAt: '2026-07-24T00:00:00.000Z', text: '', html: []
      }]
    })));
    const messages = await new MailTmProvider().listMessages({
      accountId: 'a', address: 'anon@example.test', providerPassword: 'p', token: 't', createdAt: 1, expiresAt: null, unreadCount: 0
    });
    expect(messages).toEqual([expect.objectContaining({ id: 'message-1', subject: '', seen: false })]);
  });

  it('marks a message read with the bodyless PATCH required by Mail.tm', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ seen: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const mailbox = {
      accountId: 'a', address: 'anon@example.test', providerPassword: 'p', token: 'secret-token',
      createdAt: 1, expiresAt: null, unreadCount: 1
    };

    await new MailTmProvider().markRead(mailbox, 'message/1');

    expect(fetchMock).toHaveBeenCalledWith('https://api.mail.tm/messages/message%2F1', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer secret-token' }
    });
  });

  it('deletes a selected message', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const mailbox = {
      accountId: 'a', address: 'anon@example.test', providerPassword: 'p', token: 'secret-token',
      createdAt: 1, expiresAt: null, unreadCount: 1
    };

    await new MailTmProvider().deleteMessage(mailbox, 'message/1');

    expect(fetchMock).toHaveBeenCalledWith('https://api.mail.tm/messages/message%2F1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer secret-token' }
    });
  });
});
