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

## Notes

- Saved fills and reminders are stored in `localStorage`
- Browser notifications depend on device/browser permission support
- This app is for calculation planning only
