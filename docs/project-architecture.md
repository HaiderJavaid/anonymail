# Architecture

The pnpm workspace contains:

- `apps/extension`: WXT Manifest V3 extension.
- `apps/site`: Astro landing and privacy pages.

The extension service worker owns provider calls, lifecycle, storage, badge state, context-menu handling, and surface opening. React side-panel and dashboard entrypoints share one inbox application. A `MailProvider` interface isolates Mail.tm. Website access is granted only after explicit user gestures through `activeTab`.

Persistent local storage contains settings and the active provider session. Ephemeral session storage contains the current website password and dashboard tab ID. Message bodies are fetched on demand and are not persisted.

Autofill uses a self-contained injected classifier that scans only the explicitly activated form. It recognizes email, password, first/last/full name, and common postal-address fields; applies user category toggles; dispatches native input/change events; and never fills phone inputs. Dummy identity generation is local and ephemeral.
