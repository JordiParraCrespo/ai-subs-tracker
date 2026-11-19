---
"@flama/usage-providers": patch
"@flama/shared": patch
"@flama/web": patch
---

A Grok Build account now shows on Renewals. xAI's billing views name no tier, so the Grok reader asks the CLI's own settings call (`GET cli-chat-proxy.grok.com/v1/settings`, `subscription_tier_display`, not a documented API) when the billing view gave none, only after a good billing read, and treats any failure there as "tier unknown". The catalog gains SuperGrok Plus, SuperGrok Lite, X Premium and X Premium+, each by its slug and display name, with no list price: none of them is on xAI's pricing pages, so the account carries what it pays. Renewals' "no renewal day" list now also takes an account whose plan or price is unknown, so it asks for its day instead of vanishing.
