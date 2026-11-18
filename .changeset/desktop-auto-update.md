---
"@flama/desktop": minor
"@flama/web": minor
"@flama/shared": minor
"@flama/translations": minor
---

The desktop app updates itself. It looks for a new release shortly after it
starts and every six hours, downloads it in the background and installs it
when the app quits. A card in the bottom corner offers "Restart now" once a
version is ready, reports a download that failed, and after an update says
which version it replaced. Settings › Updates shows the version and the last
check, checks on demand, and turns installing on quit off. The tray offers
"Restart to update". Builds that cannot replace themselves (a development
run, a Linux install other than the AppImage) point to the download page.
