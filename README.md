# Peptide Calculator V2

Peptide Calculator V2 is a clean static web app designed to be easy to host and easy to wrap into a Median APK.

## What it does

- Calculates several bacteriostatic water options up to 3 mL
- Shows the draw amount needed for a chosen dose
- Saves fill presets locally in the browser
- Lets the user build recurring reminders every X days at a chosen time
- Supports browser notifications when permission is granted

## Project shape

- `index.html` - app structure
- `styles.css` - responsive visual design
- `app.js` - calculator, saved fills, and reminders
- `manifest.webmanifest` - install metadata for PWA-style hosting
- `icon.svg` - app icon

## Hosting

Because this is a static app, it can be hosted on any simple website host or static hosting provider and then wrapped in Median.

## Notes

- Saved fills and reminders are stored in `localStorage`
- Browser notifications depend on device/browser permission support
- This app is for calculation planning only
