<img src="docs/banner.svg" alt="Daily Routine Tracker project illustration" width="100%">


# Daily
### A little better, every day.


[Open the website](https://daily-routine-journal.onrender.com) · [Download Android APK · 1.4.0](https://github.com/AyushKJha/Daily_Routine_Tracker/releases/download/android-v1.4.0/Daily-1.4.0.apk)


A personal routine journal for planning habits, saving daily check-ins, and looking back at progress.


**JavaScript · IndexedDB · Web Crypto · Supabase · Android / Java**


## What you can do


- Create up to 12 habits with scheduled weekdays and pauses.
- Save check-ins and notes, with automatic saves and historical routine snapshots.
- Review weekly charts and export PDF, Excel, CSV, or JSON.
- Add a password to encrypt a local workspace.
- Use the web app offline after its first successful load.
- Install the Android app for local reminders, snooze, and quiet hours.
- Optionally back up encrypted workspaces to your cloud account.


## Try it


The website needs no installation. On supported browsers, use **My routine → Install Daily** to add it to your home screen. Android requires **8+** and an up-to-date Android System WebView. Install APK updates over the existing app to retain records.


Web and Android records are separate local workspaces. JSON backup can transfer records between them. Uninstalling the app or clearing browser data removes local records. Keep backups somewhere safe.


## How data works


Journal data stays in IndexedDB on your device. Optional cloud backup stores only encrypted workspace envelopes in Supabase. Email sign-in identifies your cloud account; your workspace password (or recovery key) is still required to unlock the journal on each device. Uploads are opt-in and occur while the app is open. Devices use revision checks to prevent silent overwrites.


JSON backups include plaintext notes. CSV, PDF, and Excel reports exclude notes. The coach uses saved check-ins on the device; it is not an external AI service.


The usage query in [cloud/usage.sql](cloud/usage.sql) counts cloud accounts and backup activity, not offline-only users or app installations.


## Run locally


Use Python 3.10+ from the repository root:


```sh
python -m http.server 8000 --directory static --bind 127.0.0.1
```


Open http://localhost:8000. Publish only `static/` for web hosting; no build step is required.


## Project map


| Path | Purpose |
| --- | --- |
| [static/](static/) | Web interface, storage, encryption, reports, and offline cache |
