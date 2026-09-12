# Android internal-test APK (Issue #18)

Free Capacitor 7 + Gradle debug APK. Not Google Play. Not a production deploy.
Median / paid APK services are out of scope.

## What this APK is

A WebView wrapper around the **existing** static web app on current `main`
(`index.html` and the scripts it already loads, plus Stage 2 icons/assets).
Calculator formulas, option ordering, and reminder architecture semantics are
unchanged. Retired runtime `*-fix.js` patches are **not** restored into `www/`.

Application id: `com.fitgen.peptidecalculator`  
Build: `assembleDebug` (Gradle debug keystore generated on the Actions runner)

## How to get the APK

1. Open the **Android APK** GitHub Actions run for the exact source commit.
2. Download the `fitgen-internal-test-apk` artifact (private to this repo).
3. The APK filename is `FitGen-Peptide-Calculator-internal-test-debug-<sha>.apk`.
4. Verify the attached `.sha256` file.

This workflow must **not** create or update a GitHub Release (including draft
releases). Do not host the APK on an external public file service.

## Signing

- Internal-test uses the Android **debug** keystore.
- Do not commit `*.keystore`, `*.jks`, or release passwords.
- A later Play / production signing key needs a separate Filipe decision.

## Permissions

The wrapper requests **INTERNET** only. Capacitor's local HTTPS WebView and the
existing Google Fonts / optional HTTPS backend calls use it.

This first APK does **not** add:

- `POST_NOTIFICATIONS`
- exact-alarm / boot-complete receivers
- Capacitor Local Notifications
- OneSignal / Median native bridges

OS Auto Backup and Android 12+ device-to-device transfer are **fail-closed**:
`android:allowBackup="false"` plus exclude-all `fullBackupContent` and
`dataExtractionRules` for cloud backup and device transfer. This does not add
cloud sync or a new data-handling path.

Emulator install+launch is a **required** Android APK workflow gate (not
best-effort / not `continue-on-error`).

## Honest behavior (do not over-claim)

| Area | Status |
| --- | --- |
| Embedded static calculator / cabinet / schedule / calendar UI | Expected to load from packaged assets. Confirm on emulator install+launch when the job succeeds; **real device UNVERIFIED** until a device pass. |
| Offline calculator | Packaged assets should load without a network. Google Fonts may fall back to system fonts offline. **UNVERIFIED** until tested. |
| `localStorage` continuity with desktop Chrome | **Does not transfer.** The WebView store is separate. Use the existing export/import backup if you need to move data. **UNVERIFIED** on device. |
| Web Notification API / in-app timers | Same web code as the browser app. Timers are not a background engine. **UNVERIFIED** in this APK. |
| Native / lock-screen / killed-app reminders | **Not implemented** in this Capacitor wrapper. Existing on-screen copy about native APK reminders is the prior Median-oriented web UI and is **UNVERIFIED** here. |
| Force-close + reboot persistence | **UNVERIFIED** (real device). |
| Android back button / system permissions UX | **UNVERIFIED**. |
| Play update install | Out of scope. |

## Rollback

Delete the feature branch / close draft PR #23. No persisted user data or
calculator formulas are changed by this packaging wrapper. Generated `www/`
and Gradle outputs are gitignored.

## CI

Existing `npm run ci` quality gates stay required. Generated `www/` and
`android/` copies are skipped by the file walker so copied grandfathered
`runtime-fixes.js` cannot look like a new runtime patch.
