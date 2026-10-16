<img src="docs/banner.svg" alt="Daily Routine Tracker project illustration" width="100%">

# Daily
### A little better, every day.

[Open the website](https://daily-routine-journal.onrender.com) · [Latest Android APK](https://github.com/AyushKJha/Daily_Routine_Tracker/releases/latest) · [Release notes](https://github.com/AyushKJha/Daily_Routine_Tracker/releases)

A personal routine journal for planning habits, saving daily check-ins, and looking back at progress.

**JavaScript · IndexedDB · Web Crypto · Supabase · Android / Java**

## Start your routine

1. Open the website and create a workspace. Save the workspace ID and recovery details shown during setup.
2. Add habits, choose the weekdays for each one, and save your routine.
3. Check in during the day and add an optional note. Use the weekly view to review progress and export a report.
4. In Settings, optionally protect the workspace with a password. Download a JSON backup before moving devices or clearing browser data.
5. To back up across devices, connect an email account in Cloud backup, then opt in to upload the encrypted workspace. On another device, sign in and unlock it with the workspace password or recovery key.

For Android, install the latest APK from the release link above. Updates should be installed over the existing app to retain local records. Web and Android workspaces are separate; use a JSON backup to transfer records between them.

## What you can do

- Create up to 12 habits with scheduled weekdays and pauses.
- Save check-ins and notes with automatic saves and historical routine snapshots.
- Review weekly charts and export PDF, Excel, CSV, or JSON.
- Encrypt a local workspace with an optional password.
- Use the web app offline after its first successful load.
- Set Android reminders, snooze, and quiet hours.
- Optionally back up encrypted workspaces to Supabase while the app is open.

## How data works

Journal records are stored in IndexedDB on the device. Cloud backup is optional and stores encrypted workspace data; email identifies the cloud account but does not unlock the journal. Your workspace password or recovery key is still required. Revision checks prevent silent overwrites between devices. Automatic background Android sync is not implemented.

JSON backups include plaintext notes. CSV, PDF, and Excel reports exclude notes. The coach uses saved check-ins on the device; it is not an external AI service. See [cloud usage query](cloud/usage.sql) for what account and backup activity it counts.

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
| [cloud/](cloud/) | Optional encrypted backup integration and SQL checks |
| [tests/](tests/) | Routine and encrypted-storage checks |
| [server.py](server.py) | Retained earlier backend; the static app does not use its database |

## Development checks

```sh
npm install --ignore-scripts
npm test
python -m unittest -v test_server
```

These cover different components; passing server tests does not verify the browser interface. See [technical notes](TECHNICAL_NOTES.md) for storage behavior, export details, and verification scope.

## Current boundaries

Cloud uploads are opt-in and occur while the app is open. Email access alone cannot recover an encrypted journal. Browser reminders need the page to remain open; Android reminders may be delayed by the operating system. Physical-device behavior still needs verification.