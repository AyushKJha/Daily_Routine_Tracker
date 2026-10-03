# Daily — A little better, every day

## Live website

[Open Daily Routine Tracker](https://daily-routine-journal.onrender.com)

Use this public link on your phone, tablet, or laptop. No installation is needed.

A free personal routine tracker for phones, tablets, and laptops. Five editable intentions, daily notes, progress charts, light/dark themes, offline access after the first successful load, and portable backups.

## Data storage

The current frontend is a static, device-local app. It stores your name, routine, notes, and check-ins in **IndexedDB in your browser**. Password protection is optional. There is no cloud account, automatic sync, or hosted journal database. Theme preferences and the last protected workspace ID use localStorage; passwords and decryption keys are never stored there.

- Each browser/device and website address has separate records. Localhost records do not automatically appear at the public address.
- Unprotected workspaces open without a password. My routine → Add a password optionally moves existing records into an encrypted workspace after the user confirms saving their recovery details.
- Protected workspaces receive a reusable UUID-based ID. AES-GCM encrypts the journal; a salted PBKDF2-SHA-256 key (600,000 iterations) protects the encryption key. The independent recovery key can reset a forgotten password on the browser that still holds the workspace. Closing or reloading drops the in-memory key. This is device-local protection, not server authentication or cross-device login.
- Save the workspace ID, recovery key, and separate JSON backups. Recovery details contain no journal data and cannot restore records after browser data is cleared. JSON backups contain plaintext notes and should be kept private. Imported backups preserve the current protected workspace ID/password.
- Clearing site data, private browsing, or browser storage eviction can remove records. Download JSON backups regularly.
- My routine → Download backup / Restore backup transfers records between browsers or devices. Restore replaces matching dates and keeps other saved days. Invalid backups are rejected before writing.
- Progress → Download CSV exports saved dates, completion percentages, five habit statuses, without notes. Open in Excel or import into Google Sheets. Select Date and Completion percent to insert a line/column chart. This is a manual export, not Google account integration.
- Scores exclude skipped intentions. Concurrent saves from another tab are detected to avoid silently overwriting a newer check-in.

The Coach view uses simple on-device observations from saved check-ins. The public edition has no external AI chat or medical answering service and contains no API keys.

## Run locally

Python 3.10+ (standard library):

```sh
python -m http.server 8000 --directory static --bind 127.0.0.1
```

Open http://localhost:8000. HTTPS or localhost is required for offline caching and secure browser APIs.

## Static hosting

Publish only the `static` directory using a static host. No build step or backend process is needed. Relative asset URLs support a subdirectory deployment. Never publish `.env`, `tracker.db`, or personal backup files.

## Retained optional server source

`server.py` and `test_server.py` preserve the earlier Python/SQLite backend for development. The current static frontend does **not** call its account, database, or Apify APIs. Running `python server.py` also serves the current static interface, but its records still stay in IndexedDB.

The backend source supports hashed passwords, revocable HttpOnly sessions, same-origin checks, validation, export, and a configurable Apify adapter. Its adapter has only been tested with mocked responses; no provider token has been configured or live response quality evaluated. A server-based release would require a deliberately connected frontend, durable database/backups, HTTPS gateway, operational rate limits, and provider configuration. Do not expose a secret key in static JavaScript.

## Development checks

```sh
python -m unittest -v test_server
node --check static/storage.js
node --check static/app.js
node --check static/theme.js
node --check static/sw.js
```

Server tests use disposable temporary databases. The static edition must also be checked in a browser for save/reload, restore, export, and device layouts.

## Interface and weekly reports (October 2026)

Olive and copper accents, glass navigation and onboarding, light/dark themes, and a brief opening with Skip and My routine → Replay intro. The opening runs once per tab session and is skipped for reduced-motion preferences.

Reports provides Monday–Sunday pie/bar charts, saved records, previous/next/current week controls, and browser Print / Save PDF. Missing days are excluded from the average. Notes stay out of report analytics and CSV, while JSON backups retain notes. Identical print attempts show a confirmation. Attempt history cannot verify whether a file was saved, still exists, or was printed.

Reports are prepared in the app from saved check-ins for any selected week. Email delivery and background scheduled downloads are not included. Existing unprotected workspaces and JSON backups remain compatible.

## Install Daily and download PDF reports

My routine → Install Daily offers the browser install prompt when supported, or instructions for Add to Home Screen. The installed app uses the same public website address and local browser records, with no automatic cloud sync. Browser installation behavior differs by platform; native-store distribution is not included.

Reports → Download PDF saves a weekly report (multiple pages for larger routines) with charts and records, excluding notes. The PDF uses a high-resolution image (text is not searchable). The report has been reopened and rendered for visual verification. Browser generation, repeat-download confirmation, and installation fallback help were checked locally; native-device installation has not been tested.

Download attempts are recorded in IndexedDB. Unchanged reports prompt before requesting another PDF download, including after reload. This record does not prove the download completed or that the file still exists. PDF tools are bundled for offline use after a successful online load. Third-party licensing is preserved under static/vendor.

## Excel reports and account validation

Reports → Download Excel creates a genuine .xlsx workbook with typed dates, percentages, recalculating summaries, and two editable native Excel charts. Missing days remain blank in completion calculations; habit notes are excluded. Download history prompts before requesting an unchanged report again, separately for Excel and PDF. Browser receipts record attempts, not file existence.

The workbook template was authored with @oai/artifact-tool, then populated in the browser using bundled JSZip and XML APIs. Source: tools/build-weekly-template.mjs (requires the artifact-tool authoring runtime; the deployed site requires no build). License notices for bundled libraries are under static/vendor. No journal data is embedded in the template.

Run npm install --ignore-scripts, then npm test for disposable IndexedDB tests covering encryption at rest, migration, preserved notes, invalid credentials, session locking, account separation, recovery, restore identity, cancelled/concurrent migration, and stale-tab saves. Development dependencies are not required to host static/.

Browser QA used a disposable local origin: legacy save/reload, opt-in migration, reusable ID login, and Excel downloads. Exported Excel reports were reopened and rendered for chart/table review. Native app installation and opening the workbook in desktop Excel have not been tested.

## Daily 1.1

Automatic serialized check-in saves, quick starter routines, up to 12 custom habits with weekdays and pauses, historical plan snapshots, clearer saved-day insights, and weekly backup prompts. Legacy scores remain intact. Excel reports expand for custom habits; PDF habit tables span pages as needed. Missing dates remain unknown, not failures.

Android reminders are opt-in, respect quiet hours, include snooze, and reschedule after reboot/time-zone changes. Android may delay inexact alarms. Browser reminders require the page to stay open. APK 1.1 is signed with the same release key and checks the existing website for future updates; Android requires installation approval. Physical-device behavior remains untested.

Optional encrypted Supabase backup integration is prepared under cloud/. No hosted project is configured, so cloud backup remains disabled. Tokens stay in session memory, uploads require opt-in, remote revisions prevent silent overwrite, and restores require the workspace password. Hosted RLS/SMTP needs staging verification when configured.

