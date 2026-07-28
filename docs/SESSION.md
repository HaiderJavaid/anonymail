# Session

Started: 2026-07-24 · Updated: 2026-07-26

- Started the empty Anonymail workspace.
- Confirmed product choices: Mail.tm prototype, ZIP beta, local receive-only MVP, side-panel default, privacy-user positioning.
- Selected the supplied cool-gray rounded inbox reference as the visual target.
- Generated an original Anonymail envelope/privacy-mask application icon.
- Built the Manifest V3 extension, Mail.tm provider adapter, side panel, dashboard, settings, privacy disclosure, autofill flow, expiry handling, badge updates, and retry queue.
- Built the static Astro landing and privacy pages with a downloadable developer-mode beta.
- Verified the dashboard and side panel against the supplied visual reference at desktop and narrow-panel viewports.
- Automated checks pass; the final Developer Mode install still requires a manual Chrome verification because browser automation cannot access `chrome://extensions`.
- Reworked the no-mailbox state to show only an empty message and create button, with a circular creation loader.
- Moved the fixed mailbox countdown to the top of a cleaner responsive address card and reduced replacement to an icon action.
- Added whole-form local classification with default email/password filling, optional dummy name/address filling, native events, and unconditional phone exclusion.
- Added side-panel access to settings and verified all new visible states at 420 px.
- Fixed Mail.tm read-status handling to use its bodyless PATCH contract; message content now opens even if persisting the seen flag fails.
- Shortened newly generated mailbox local-parts to eight characters, changed unread badges to red, and bolded unread message rows.
- Reduced new mailbox local-parts to six characters and select the shortest currently active Mail.tm domain.
- Moved the side-panel timer beside the address label and kept received times visible at narrow widths.
- Converted row boxes into real bulk selectors with provider-backed deletion.
- Made read styling and badge counts update optimistically and persist across service-worker suspension.
- Changed the dashboard to the same single-pane list/reader flow as the side panel.
- Added sandboxed HTML-email rendering that preserves sanitized CSS while blocking scripts, forms, remote media, and external resources.
- Added one-time first-install Settings routing with a dashboard fallback for Chrome's side-panel gesture restriction.
- Added a visible 500 ms generation phase and centered in-page autofill feedback.
- Matched signup-password session retention to mailbox lifetime and clear it with mailbox deletion or expiry.
- Refreshed extension/site icons from the supplied metallic mask-envelope direction.
- Added the requested three landing feature clips and relaxed main-heading letter spacing.
- Moved one-time Settings onboarding from install time to the first toolbar/context-menu activation so the side panel can open within Chrome's gesture rule.
- Reduced hero heading size and replaced install cards with the requested privacy-enhanced YouTube tutorial player.
- Enabled Chrome's native action-click side-panel behavior; installation now waits for a toolbar gesture and opens first-run setup in the side panel without creating a dashboard tab.
- Made mailbox deletion and the new Save settings button return to Inbox.
- Replaced the empty mailbox copy with a concise right-click/manual creation prompt and “Create disposable email.”
- Removed inbox search from the extension and landing mockup.
- Reduced and centered the landing tutorial player, supporting copy, and download action.
