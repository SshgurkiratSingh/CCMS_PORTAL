## CCMS Portal Frontend

This app is a Next.js operator console scaffold for the CCMS AWS architecture.

### Routes

- `/login`: Captures the Dashboard and Admin keys.
- `/dashboard`: GET `/api/v1/dashboard/summary`
- `/panels`: GET `/api/v1/panels` with status, limit, and offset.
- `/panel?id={panelId}`: GET `/status` and POST `/command`.
- `/analytics`: GET `/api/v1/panels/{panelId}/telemetry?start=&end=`
- `/alerts`: GET `/api/v1/alerts?severity=` and PATCH `/api/v1/alerts/{alertId}`.

### Environment Variables

Copy `.env.example` values into your local `.env.local` and fill real values:

- `NEXT_PUBLIC_API_BASE_URL` (Set this to the Lambda API endpoint prefix)

### Notes

- Keys are held in `localStorage` client state and attached as `x-dashboard-key` and `x-admin-key` headers on API requests.
- Next.js is configured with static export mode (`output: "export"`), so Vercel can host this without Vercel serverless functions.

### Run

```bash
npm run dev
```
