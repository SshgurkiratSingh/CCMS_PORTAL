## CCMS Portal Frontend

This app is a Next.js operator console scaffold for the CCMS AWS architecture.

### Routes

- `/login`: Starts Cognito Hosted UI OAuth login redirect (PKCE).
- `/auth/callback`: OAuth callback handler and token exchange.
- `/dashboard`: GET `/api/v1/dashboard/summary`
- `/panels`: GET `/api/v1/panels` with status, limit, and offset.
- `/panel?id={panelId}`: GET `/status` and POST `/command`.
- `/analytics`: GET `/api/v1/panels/{panelId}/telemetry?start=&end=`
- `/alerts`: GET `/api/v1/alerts?severity=` and PATCH `/api/v1/alerts/{alertId}`.

### Environment Variables

Copy `.env.example` values into your local `.env.local` and fill real values:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_COGNITO_REGION`
- `NEXT_PUBLIC_COGNITO_CLIENT_ID`
- `NEXT_PUBLIC_COGNITO_DOMAIN`
- `NEXT_PUBLIC_COGNITO_REDIRECT_URI`
- `NEXT_PUBLIC_COGNITO_LOGOUT_URI`
- `NEXT_PUBLIC_COGNITO_OAUTH_SCOPES`

### Notes

- Access token is held in in-memory client state and attached as `Authorization: Bearer <token>` on API requests.
- Login uses Cognito Hosted UI Authorization Code Flow with PKCE.
- Use a Cognito app client without a client secret for this frontend flow.
- Next.js is configured with static export mode (`output: "export"`), so Vercel can host this without Vercel serverless functions.

### Run

```bash
npm run dev
```
