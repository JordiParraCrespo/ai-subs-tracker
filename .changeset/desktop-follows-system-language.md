---
"@flama/desktop": minor
"@flama/frontend-web": minor
"@flama/shared": minor
"@flama/translations": minor
---

The desktop app speaks the person's language. The screens start from the
operating system's preferred languages (the bridge's new `systemLocales`)
when nothing was picked on the device, and report what they show through
`setLocale`, so the tray menu, tooltip and headline read the same. Tray copy
lives in the new `desktop` translation area (English and Spanish).
