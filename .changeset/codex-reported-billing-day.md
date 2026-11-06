---
"@flama/api": minor
"@flama/api-client": minor
"@flama/shared": minor
"@flama/web": minor
"@flama/frontend-consumer": minor
"@flama/translations": minor
"@flama/usage-providers": minor
---

Put Codex plans on the Renewals calendar without asking. The Codex reader takes the end of the paid period from the `id_token` in `auth.json` (`chatgpt_subscription_active_until`, an undocumented claim, read locally with no new request) and syncs only its day of the month, in the machine's local time, with when ChatGPT last checked the subscription (`reportedRenewal` on `POST /v1/accounts/sync`, optional so older collectors still sync). The token is reissued only when Codex refreshes its login, so the date itself can be a period or more behind; the day a plan bills does not move. The API keeps it beside the person's own day (`reportedRenewalDay`, `renewalCheckedAt`): `renewalDay` is the person's, else the reported one, and `renewalDayOverridden` says which. The edit form leaves the field empty for a reported day and shows it as the placeholder, so clearing an override falls back to the login, and Next 30 days says where a reported day came from. Claude Code reports no billing day and keeps "Set day".
