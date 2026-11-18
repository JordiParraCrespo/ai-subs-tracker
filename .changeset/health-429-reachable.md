---
"@flama/frontend-web": patch
---

A rate-limited health probe (429) no longer puts the console behind the "Can't reach" screen: any answer from the API counts as reachable, and only a 5xx or a failed request does not.
