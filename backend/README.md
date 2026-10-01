# Backend

Vercel Functions receive reminder schedules from the app and pre-schedule native
push notifications through OneSignal. Neon Postgres stores the mapping from each
app user to the OneSignal notification ids so the next sync can cancel them.

## Routes

The Capacitor APK and the static site call the unprefixed paths. `vercel.json`
rewrites those onto the functions. Both paths return the same JSON.

| Method | Paths | Function |
| --- | --- | --- |
| GET | `/health`, `/api/health` | `api/health.js` |
| GET | `/debug/:userId`, `/api/debug/:userId` | `api/debug/[userId].js` |
| POST | `/reminders/sync`, `/api/reminders/sync` | `api/reminders/sync.js` |
| POST | `/test-push`, `/api/test-push` | `api/test-push.js` |

`POST /reminders/sync` cancels the user's previously stored OneSignal
notifications, deletes those rows, then creates up to 26 future occurrences per
schedule and stores the new ids. OneSignal sends them. Nothing polls.

## Environment

Set these on the Vercel project (production and preview). The Neon integration
supplies the database URLs. Do not commit values.

- `DATABASE_URL` — pooled Neon connection string
- `DATABASE_URL_UNPOOLED` — direct Neon connection string, used for `CREATE TABLE IF NOT EXISTS`
- `ONESIGNAL_APP_ID`
- `ONESIGNAL_API_KEY`
- `PUBLIC_APP_URL` — `https://peptide-calculator-v2-snowy.vercel.app`

`PUBLIC_APP_URL` is added to the CORS allowlist. The allowlist also includes
that Vercel origin, this project's `*.vercel.app` preview hostnames,
`https://lotustemplar.github.io`, `https://localhost`, `http://localhost`,
`capacitor://localhost`, and `ionic://localhost`.

Copy `backend/.env.example` to `backend/.env` for a local `npm start`. Local
runs still need a Postgres `DATABASE_URL`.

## Local start

```bash
npm ci --prefix backend
npm start
```

`npm start` listens on `PORT` (default `8787`) and serves the same paths.
