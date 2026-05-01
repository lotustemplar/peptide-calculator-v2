# Backend

This backend receives reminder schedules from the app and dispatches native push notifications through OneSignal.

## What it does

- Accepts schedule syncs from the frontend at `POST /reminders/sync`
- Stores reminders in SQLite
- Recomputes the next due send time for each reminder
- Polls for due reminders every minute
- Sends push notifications to the OneSignal `external_id` associated with the app install

## Environment

Copy `.env.example` to `.env` and configure:

- `ONESIGNAL_APP_ID`
- `ONESIGNAL_API_KEY`
- `PUBLIC_APP_URL`

## Start locally

```bash
npm install
npm start
```

## Deploy

You can deploy this as a small always-on Node service or container on platforms like Render, Railway, Fly.io, or a VPS.
