# Median Reminder Setup

This app is ready to be hosted and wrapped in Median, but true reminders in a final APK require native push notifications plus a backend that schedules them.

## Recommended stack

- Host the web app on GitHub Pages or another static host
- Wrap it in Median
- Enable the Median JavaScript Bridge
- Enable the OneSignal plugin in Median
- Use a backend or serverless function to store reminders and call the OneSignal API

## Why this is needed

Browser timers and `window.setTimeout()` are not reliable once the app is closed or backgrounded. For production reminders, the app should:

1. Register the user/install with OneSignal
2. Save reminder schedules to your backend
3. Let the backend schedule push notifications through OneSignal
4. Open the app back to the right screen when the notification is tapped

## Files to set before production

- Copy `config.example.js` to `config.js`
- Set `window.APP_CONFIG.backendBaseUrl`
- Include `config.js` before `app.js` in `index.html`

## Median docs

- Push notifications overview: https://docs.median.co/docs/push-notifications-overview
- OneSignal plugin: https://docs.median.co/docs/onesignal
- Open URL from notification: https://docs.median.co/docs/open-url-from-notification
