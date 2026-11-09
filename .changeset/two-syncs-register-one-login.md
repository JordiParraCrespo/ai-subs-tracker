---
"@flama/api": patch
---

Two syncs that register the same new login at once (the collector's run and a live reading, two windows of the app) no longer answer 500 for the one that loses the write: it records its sighting on the row the other created.
