# Peptide Calculator V2

Peptide Calculator V2 is a clean static web app designed to be easy to host and easy to wrap into a Median APK.

## What it does

- Calculates several bacteriostatic water options up to 3 mL
- Shows the draw amount needed for a chosen dose
- Saves named peptide fills and groups them in a Current Peptides organizer
- Lets the user build recurring reminders every X days at a chosen time
- Shows an upcoming calendar agenda across multiple peptides
- Supports browser notifications during web use
- Includes Median and OneSignal readiness for production APK reminders

## Project shape

- `index.html` - app structure
- `styles.css` - responsive visual design
- `app.js` - calculator, organizer, reminders, and backend sync hooks
- `config.example.js` - production config placeholder
- `MEDIAN_SETUP.md` - Median APK and native reminder setup notes
- `manifest.webmanifest` - install metadata for PWA-style hosting
- `icon.svg` - app icon

## Hosting

Because this is a static app, it can be hosted on any simple website host or static hosting provider and then wrapped in Median.

## Production reminders

True production reminders for a final APK should use Median plus OneSignal plus a backend or serverless function to schedule native push notifications. The built-in web timer is useful for testing, but not reliable as the only reminder engine once the app is closed or backgrounded.

Median docs:

- Push notifications overview: https://docs.median.co/docs/push-notifications-overview
- OneSignal plugin: https://docs.median.co/docs/onesignal
- Open URL from notification: https://docs.median.co/docs/open-url-from-notification

## Android internal-test APK (Issue #18)

A free Capacitor 7 wrapper lives in `android/` and is documented in
`docs/android-internal-test-apk.md`. GitHub Actions builds a **debug** APK and
uploads it only as a workflow artifact (`fitgen-internal-test-apk`). It does
**not** create or update a GitHub Release.

This is not a Play Store or production release. Reminder / background delivery
is **UNVERIFIED** on this wrapper. Real-device behavior stays labeled
**UNVERIFIED** unless a device pass is recorded.

## CI (P0.0)

Pull-request quality gates live in `.github/workflows/ci.yml` and are documented
in `scripts/ci/README.md`. Keep-alive is not a PR quality check. Lockfiles for
the root package and `backend/` are committed and used by CI installs. Lint
covers `scripts/` plus changed/new JS/CJS/MJS/TS/TSX outside the legacy-path
allowlist. TypeScript/TSX is parsed with typescript-eslint (Issue #9).
`npm test` also runs P0.1 dual-path calculator **legacy-evidence** goldens and
FR-CALC-010 domain fixtures (`scripts/calc/`). Those snapshots lock current
outputs; they are not target correctness oracles.

## Notes

- Saved fills and reminders are stored in `localStorage`
- Browser notifications depend on device/browser permission support
- This app is for calculation planning only
