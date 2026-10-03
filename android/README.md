# Daily for Android

An installable Android app bundling the Daily tracker, olive/copper theme, offline journal, optional encrypted workspaces, and PDF/Excel reports. Minimum Android8.0 (API26), with a current Android System WebView.

The app uses a native Activity and AndroidX WebViewAssetLoader to load bundled code at a fixed HTTPS local origin. It does not depend on the public site being available. The native message channel accepts only the bundled origin's main frame; remote WebView requests are blocked, external HTTPS links open in the system browser, and a restrictive content policy prevents embedded frames. There are no analytics or cloud journal requests.

File exports use Android's Create Document picker; users choose where to save. Restore backup uses the Open Document picker. No broad filesystem/camera/microphone permissions are requested. Android cloud backups and device transfer are disabled; portable JSON backups are explicit and include plaintext notes. Uninstalling or clearing app data erases app records. App and website records are separate; transfer with a JSON backup, not a shared login.

## Build

Use Java17 and Android SDK35/build-tools35.0.0. From the repository root:

```
python android/prepare_assets.py
cd android
./gradlew :app:assembleRelease :app:lintRelease
```

The manual GitHub Actions workflow builds the unsigned release and runs Android35 emulator tests for encrypted storage/reload and native exports. Source web assets are copied from static/ at build time, so personal journal records are never included. Generated assets/builds and private signing keys are ignored by Git.

The release APK must be signed before installation. Release keys are kept outside the repository and outside GitHub Actions. Sign each future update with the SAME key and increment versionCode in app/build.gradle; otherwise existing installations cannot update safely while retaining their records. tools/SignApk.java can sign and verify an APK using Android's apksig library and a PKCS12 keystore. Pass DAILY_KEYSTORE_PASSWORD as an environment variable; do not put it in source or command-line arguments.

Bundled Gradle wrapper: Apache2 license in GRADLE-LICENSE. AndroidX WebKit uses Apache2; web export library notices are copied from static/vendor into the APK assets. No Play Store listing is created by this build.


## Version 1.1

Same signing identity as 1.0, versionCode 2. Install over the existing app; do not uninstall. Automatic saving is serialized with optimistic day revisions. This build requests notification permission only when the user enables reminders, schedules inexact local alarms, respects quiet hours, provides 30-minute snooze, and reschedules on reboot/time/time-zone changes. Android battery restrictions can delay delivery. It contains no journal content in notifications.

The app checks the original Render website's app-update.json on opening and offers a direct APK download when a newer versionCode exists. Android requires user approval to install; silent replacement is not supported. The original 1.0 APK has no updater, so its users must install 1.1 manually once. Future updates must use the same signing key and higher versionCode. Update links are restricted to this GitHub repository's Android release assets.

Cloud backup is disabled by default. See cloud/README.md for configuration and required hosted validation. Only the configured Supabase origin's authentication/database endpoints are allowed for subresource requests; its origin is added to the native content policy at build time. Remote page navigation remains external to the app.
