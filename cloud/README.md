# Optional encrypted cloud backup setup

The hosted Supabase project is configured on the free plan. The public website and Android app can use optional encrypted cloud backup. Email OTP connects an account; it does not decrypt journal data.

1. Create a Supabase project and run `supabase.sql` in its SQL editor.
2. Enable Email authentication. In the Magic Link email template, send the numeric `{{ .Token }}` rather than a link. Configure production SMTP and appropriate OTP rate limits before inviting users. Cloud sign-in uses email OTP; workspace passwords are never sent to Supabase.
3. Put the project HTTPS URL and **publishable** key in `static/cloud-config.js`. Never use a secret/service_role key. Example:

```js
window.DAILY_CLOUD={url:'https://PROJECT.supabase.co',publishableKey:'PUBLIC_PUBLISHABLE_KEY'};
```

4. Rebuild web and Android releases. Android asset preparation generates a precise allowlist for this origin's `/auth/v1/` and `/rest/v1/` endpoints. Remote pages remain blocked. Do not broaden it to a wildcard.
5. Validate in a staging project with two separate users: neither can read the other's rows; anonymous reads/RPC calls fail; direct inserts/updates fail; two devices updating the same version produce one success and one conflict. This repository's mocked tests do not substitute for hosted RLS/SMTP checks.

The cloud stores only the existing AES-GCM encrypted envelope, random workspace ID, revision, owner, and timestamp. Email is held by Supabase Auth. Plain JSON exports remain explicitly local downloads. Encryption protects journal content; it cannot recover a lost workspace password AND recovery key. Email OTP alone cannot decrypt a workspace.

Users explicitly connect cloud backup for each session and opt into uploads after changes. The client retains only a per-account remote revision locally; cloud access tokens stay in memory and expire. Expired sessions stop uploads. Cloud restores replace that workspace after explicit confirmation and relock it. Unknown remote revisions fail safely; no last-write-wins merge. Restore the cloud copy after taking a local backup to reconcile different devices. Local-only records are unaffected by an unavailable provider.

Cloud backup is user initiated and encrypted. Automatic uploads operate only while a workspace is open and the user opts in; background Android sync is not implemented. There is no in-app cloud-account deletion flow yet. Do not promote this as a managed multi-user service until users have a documented way to export and remove cloud accounts and backups.
