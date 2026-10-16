<img src="docs/banner.svg" alt="Daily Routine Tracker project illustration" width="100%">

# Daily
### A little better, every day.

[Open the website](https://daily-routine-journal.onrender.com) · [Download Android APK · 1.1.0](https://github.com/AyushKJha/Daily_Routine_Tracker/releases/download/android-v1.1.0/Daily-1.1.0.apk) · [Release notes](https://github.com/AyushKJha/Daily_Routine_Tracker/releases/tag/android-v1.1.0)

A personal routine journal for planning habits, saving daily check-ins, and looking back at progress. Built after a friend and I struggled to find a routine system we kept returning to.

**JavaScript · IndexedDB · Web Crypto · Android / Java**

> **[Step-by-step user guide (PDF)](docs/USER_GUIDE.pdf)**

## What you can do

- Create up to 12 habits with scheduled weekdays and pauses.
- Save check-ins and notes, with automatic saves and historical routine snapshots.
- Review weekly charts and export PDF, Excel, CSV, or JSON.
- Add an optional password to encrypt a local workspace.
- Use the web app offline after its first successful load.
- Install the Android app for local reminders, snooze, and quiet hours.

## Try it

The website needs no installation. On supported browsers, use **My routine → Install Daily** to add it to your home screen.

For Android, download the APK above. It requires **Android 8+** and an up-to-date Android System WebView. Install over the earlier release to retain app records.

**The website and Android app have separate local records.** Transfer them with a JSON backup and restore. Uninstalling the app or clearing browser data removes local records. Keep backups somewhere safe.

## How data works

The current journal stores records in IndexedDB on your device. There is no automatic cloud sync. Optional passwords protect an AES-GCM encrypted workspace; they are not a server account. Recovery details help unlock existing local data but do not replace a backup.

JSON backups include plaintext notes. CSV, PDF, and Excel reports exclude notes. The coach uses saved check-ins on the device; it is not an external AI service.

## Run locally

Use Python 3.10+ from the repository root:

```sh
git clone https://github.com/AyushKJha/Daily_Routine_Tracker.git
cd Daily_Routine_Tracker
python -m http.server 8000 --directory static --bind 127.0.0.1
```

Open http://localhost:8000. Publish only `static/` for web hosting; no build step is required.

## Project map

| Path | Purpose |
| --- | --- |
| [static/](static/) | Web interface, storage, encryption, reports, and offline cache |
| [android/](android/) | Native wrapper, packaged assets, exports, and reminders |
| [android/README.md](android/README.md) | Android build instructions |
| [cloud/](cloud/) | Optional encrypted backup integration; not configured in the public release |
| [tests/](tests/) | Routine and encrypted-storage checks |
| [server.py](server.py) | Retained earlier backend; the static app does not use its database |

## Development checks

```sh
npm install --ignore-scripts
npm test
python -m unittest -v test_server
```

These cover different components; passing server tests does not verify the browser interface. See [technical notes](TECHNICAL_NOTES.md) for storage behavior, export details, and previous verification scope.

## Current boundaries

Android reminders may be delayed by the OS. Browser reminders need the page to remain open. The release records emulator checks; physical-device behavior still needs verification. Cloud backup is disabled until a hosted project is configured.
