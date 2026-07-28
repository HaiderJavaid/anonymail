# Decisions

- Chrome-only Manifest V3 MVP; minimum Chrome 116.
- WXT, React, TypeScript, Tailwind CSS, Mail.tm, DOMPurify, Zod, Vitest, and Playwright-compatible smoke testing.
- Use `activeTab`, not persistent all-site access.
- Reuse one active mailbox; generate a unique website password per invocation.
- Side panel is the default; dashboard tab is optional.
- Lifetimes: 10 minutes, 1 hour, 6 hours, 24 hours, or no Anonymail expiry.
- No account, cloud sync, outbound mail, attachments, analytics, or payment in MVP.
- Free ZIP beta first; Chrome Web Store later.
- No monetization while the product merely wraps Mail.tm.
- Smart form detection is local DOM classification, not a remote AI service; page contents never leave the browser.
- Email and password autofill are enabled by default. Dummy name and address filling are opt-in, and phone fields are always excluded.
- Styled HTML email is isolated in a sandboxed iframe. Sanitized inline CSS is allowed; scripts, forms, remote images, external resources, and attachments remain blocked.
- Signup passwords stay in trusted session storage, follow the active mailbox lifetime, and clear with the mailbox; “Until deleted” remains limited to the current Chrome session.
- First activation after install opens the side panel in Settings once. Chrome requires that user gesture and does not allow extensions to pin themselves.
- Chrome's native `openPanelOnActionClick` behavior handles side-panel toolbar activation. Since installation is not a valid side-panel gesture, Anonymail waits for the user's first toolbar click and opens setup inside the side panel.
- Landing motion uses a small local IntersectionObserver with no third-party runtime. Reveals reset outside the viewport, feature hover is pointer-only, and reduced-motion preferences disable animation.
