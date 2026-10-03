# Optional encrypted cloud backup setup

This release works locally without any provider account. Cloud backup is disabled until a project is configured. No paid service has been provisioned.

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

This is prepared integration, not active cloud sync, and it does not implement background Android sync or unattended web sync. Apply a data retention policy and a user deletion flow before offering this service broadly.
