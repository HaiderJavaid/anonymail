import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSafeEmailDocument, InboxApp } from './InboxApp';
import { DEFAULT_SETTINGS } from '../lib/storage';

const emptyState = {
  settings: { ...DEFAULT_SETTINGS, onboardingSeen: true },
  mailbox: null,
  messages: [],
  lastSignupPassword: null,
  initialSetup: false,
  loading: false,
  error: null
};

const populatedState = {
  ...emptyState,
  mailbox: {
    accountId: 'account', address: 'a2bcde@x.test', providerPassword: 'provider-secret', token: 'token',
    createdAt: Date.now(), expiresAt: Date.now() + 60_000, unreadCount: 1
  },
  messages: [{
    id: 'message-1', from: { name: 'Acme', address: 'verify@acme.test' }, subject: 'Confirm email',
    intro: 'Your code', seen: false, hasAttachments: false, createdAt: new Date().toISOString()
  }]
};

describe('InboxApp', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    vi.stubGlobal('chrome', {
      runtime: {
        sendMessage: vi.fn().mockResolvedValue({
          ok: true,
          state: emptyState
        })
      }
    });
  });

  it('opens the one-time setup route in settings while normal launches stay on inbox', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true, state: emptyState });
    vi.stubGlobal('chrome', { runtime: { sendMessage } });
    window.history.replaceState({}, '', '/dashboard.html?view=settings&setup=1');
    render(<InboxApp surface="dashboard" />);
    expect(await screen.findByRole('heading', { name: 'Set up Anonymail before you start.' })).toBeVisible();
    expect(sendMessage).not.toHaveBeenCalledWith({ type: 'COMPLETE_INITIAL_SETUP' });
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith({ type: 'COMPLETE_INITIAL_SETUP' }));
    expect(await screen.findByRole('heading', { name: 'No disposable email yet.' })).toBeVisible();
  });

  it('renders the empty mailbox action', async () => {
    render(<InboxApp surface="sidepanel" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create disposable email' })).toBeVisible());
    expect(screen.getByRole('heading', { name: 'No disposable email yet.' })).toBeVisible();
    expect(screen.getByText('Right-click any signup form')).toBeVisible();
    expect(screen.queryByText(/active disposable address/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows a circular loading state while creating a mailbox', async () => {
    let resolveCreate: ((value: unknown) => void) | undefined;
    const sendMessage = vi.fn((request: { type: string }) => {
      if (request.type === 'CREATE_MAILBOX') return new Promise((resolve) => { resolveCreate = resolve; });
      return Promise.resolve({ ok: true, state: emptyState });
    });
    vi.stubGlobal('chrome', { runtime: { sendMessage } });
    render(<InboxApp surface="sidepanel" />);
    const button = await screen.findByRole('button', { name: 'Create disposable email' });
    fireEvent.click(button);
    expect(screen.getByRole('status')).toHaveTextContent('Creating your disposable email');
    resolveCreate?.({ ok: true, state: emptyState });
  });

  it('returns to the empty inbox after deleting the active mailbox from settings', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const sendMessage = vi.fn((request: { type: string }) => Promise.resolve({
      ok: true,
      state: request.type === 'DELETE_MAILBOX' ? emptyState : populatedState
    }));
    vi.stubGlobal('chrome', { runtime: { sendMessage } });
    render(<InboxApp surface="sidepanel" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('heading', { name: 'No disposable email yet.' })).toBeVisible();
  });

  it('saves settings and returns to the inbox view', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true, state: populatedState });
    vi.stubGlobal('chrome', { runtime: { sendMessage } });
    render(<InboxApp surface="sidepanel" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByText('Active disposable address')).toBeVisible();
  });

  it('renders dashboard navigation separately from the side panel', async () => {
    const { rerender } = render(<InboxApp surface="dashboard" />);
    await waitFor(() => expect(screen.getByRole('navigation', { name: 'Mailbox navigation' })).toBeVisible());
    rerender(<InboxApp surface="sidepanel" />);
    expect(screen.queryByRole('navigation', { name: 'Mailbox navigation' })).not.toBeInTheDocument();
  });

  it('uses the row checkbox as a bulk selector', async () => {
    vi.stubGlobal('chrome', { runtime: { sendMessage: vi.fn().mockResolvedValue({ ok: true, state: populatedState }) } });
    render(<InboxApp surface="dashboard" />);
    const selector = await screen.findByRole('checkbox', { name: 'Select Confirm email' });
    fireEvent.click(selector);
    expect(screen.getByRole('button', { name: 'Delete selected messages' })).toBeVisible();
    expect(screen.getByText('1 selected')).toBeVisible();
  });

  it('optimistically unbolds an unread row and switches the dashboard to its reader', async () => {
    const readState = {
      ...populatedState,
      mailbox: { ...populatedState.mailbox, unreadCount: 0 },
      messages: [{ ...populatedState.messages[0]!, seen: true }]
    };
    const sendMessage = vi.fn((request: { type: string }) => Promise.resolve(request.type === 'READ_MESSAGE'
      ? {
          ok: true,
          state: readState,
          message: { ...readState.messages[0]!, to: [], text: 'Code 123', html: [] }
        }
      : { ok: true, state: populatedState }));
    vi.stubGlobal('chrome', { runtime: { sendMessage } });
    const { container } = render(<InboxApp surface="dashboard" />);
    await waitFor(() => expect(container.querySelector('.message-open')).toBeInTheDocument());
    const rowButton = container.querySelector('.message-open') as HTMLButtonElement;
    expect(rowButton.closest('.message-row')).toHaveClass('unread');
    fireEvent.click(rowButton);
    await waitFor(() => expect(container.querySelector('.mail-content')).toHaveClass('reading'));
    expect(rowButton.closest('.message-row')).not.toHaveClass('unread');
    expect(container.querySelector('.reader-back')).toBeVisible();
  });

  it('keeps email CSS while removing executable and remote content', () => {
    const document = buildSafeEmailDocument([
      '<style>.hero{color:red}</style><div class="hero" style="font-weight:700">Hello</div><script>alert(1)</script><img src="https://tracker.test/pixel">'
    ]);
    expect(document).toContain('.hero{color:red}');
    expect(document).toContain('font-weight:700');
    expect(document).not.toContain('<script');
    expect(document).not.toContain('<img');
    expect(document).toContain("default-src 'none'");
  });
});
