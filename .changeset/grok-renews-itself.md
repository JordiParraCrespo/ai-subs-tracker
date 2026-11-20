---
"@flama/usage-providers": minor
---

A lapsed Grok Build session is renewed by Grok Build itself instead of asking for a sign-in every day. The reader starts the CLI the way Orca runs Grok with no window: `grok --permission-mode default agent --no-leader stdio`, ACP `initialize` and `authenticate` with the saved `cached_token` login, and, only when that leaves `auth.json` lapsed, Orca's headless read-only prompt, a model request that makes the CLI renew its session. ResetOwl still never reads the refresh credential or writes the file. The CLI offering no saved login is the one sign-out; where `grok` cannot run, the stale and day-old rules stay as they were.
