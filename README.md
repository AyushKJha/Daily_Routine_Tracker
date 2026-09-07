# Daily — A little better, every day

## Live website

[Open Daily Routine Tracker](https://daily-routine-journal.onrender.com)

Use this public link on your phone, tablet, or laptop. No installation is needed.

A free personal routine tracker for phones, tablets, and laptops. Five editable intentions, daily notes, progress charts, light/dark themes, offline access after the first successful load, and portable backups.

## Data storage

The current frontend is a static, device-local app. It stores your name, routine, notes, and check-ins in **IndexedDB in your browser**. No cloud account, password, automatic sync, or hosted database is required. The theme preference uses localStorage.

- Each browser/device and website address has separate records. Localhost records do not automatically appear at the public address.
- Anyone using that browser profile can open the workspace. Closing the workspace is not an authentication lock; records are not encrypted by this app.
- Clearing site data, private browsing, or browser storage eviction can remove records. Download JSON backups regularly.
- My routine → Download backup / Restore backup transfers records between browsers or devices. Restore replaces matching dates and keeps other saved days. Invalid backups are rejected before writing.
- Progress → Excel / Sheets CSV exports saved dates, completion percentages, five habit statuses, and notes. Open in Excel or import into Google Sheets. Select Date and Completion percent to insert a line/column chart. This is a manual export, not Google account integration.
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
