# Product truth

Anonymail helps privacy-conscious Chrome users create and use a disposable mailbox without leaving a signup page. Version 0.1 is free, local-only, receive-only, and limited to one active inbox.

## Success criteria

- A context-menu action creates or reuses an inbox and fills the focused signup field.
- A distinct strong password is generated for the website, never reusing the mail-provider secret.
- The global side panel remains useful across tabs in the same Chrome window.
- The user may choose a side panel or dashboard tab and select mailbox lifetime.
- Inbox data is fetched directly from Mail.tm; browsing activity is not collected.
- Right-clicking any editable field classifies the containing form and fills every enabled category, even when the clicked field is not an email field.
- Empty and mailbox-creation states are explicit, calm, and free of placeholder inbox chrome.
- First user activation after installation leads to one-time side-panel setup; normal surface launches begin in Inbox.
- Signup-password retention follows the mailbox lifetime without leaving trusted session storage.
- Toolbar activation reliably opens the configured surface; deletion and settings completion always return to Inbox.
