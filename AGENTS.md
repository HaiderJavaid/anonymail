# Anonymail agent guidance

Read `docs/HANDOFF.yaml`, then `docs/README.md`, before changing code.

- Preserve the privacy-first permission model: never add broad website access without an explicit product decision.
- Keep Mail.tm behind the provider adapter and keep its attribution visible.
- Provider credentials and signup passwords must remain distinct.
- Do not persist signup passwords beyond the short `chrome.storage.session` handoff.
- Run build, typecheck, lint, and tests before claiming completion.
- Do not commit, publish, or deploy without explicit user authorization.
