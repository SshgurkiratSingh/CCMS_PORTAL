# Web Portal

The operator console is a **Next.js 16** application with static export (`output: "export"`) that provides a real-time fleet management interface for streetlight monitoring and control.

![Fleet Overview](Assets/fleet%20screen.png)

![Panel Command Center](Assets/Panel%20command%20center.png)

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (`output: "export"`) |
| UI Runtime | React 19 |
| UI Components | HeroUI v3 |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Maps | Leaflet + React-Leaflet |
| Animations | Framer Motion |
| Icons | Lucide React |
| Dates | date-fns |
| Languages | TypeScript |

## Project Structure

```
ccms/
├── app/                          ← Route definitions and pages
│   ├── page.tsx                  ← Landing page
│   ├── layout.tsx                ← Root layout
│   ├── providers.tsx             ← Client-side providers (auth, HeroUI)
│   ├── globals.css               ← Global styles + Tailwind
│   ├── login/page.tsx            ← Authentication page
│   └── (console)/
│       ├── layout.tsx            ← Console layout with AppShell
│       ├── dashboard/page.tsx    ← Fleet summary dashboard
│       ├── panels/page.tsx       ← Panel inventory (map/grid/table)
│       ├── panel/page.tsx        ← Single panel detail + commands
│       ├── manage-panel/page.tsx ← Panel provisioning/editing
│       ├── analytics/page.tsx    ← Historical telemetry viewer
│       └── alerts/page.tsx       ← Alert management
├── components/                   ← Shared React components
│   ├── app-shell.tsx             ← Console navigation shell
│   ├── auth-provider.tsx         ← Auth context + localStorage management
│   ├── require-auth.tsx          ← Route guard wrapper
│   ├── fleet-map.tsx             ← Map view of all panels
│   ├── location-picker-map.tsx   ← GPS coordinate picker for provisioning
│   └── ui.tsx                    ← Shared UI primitives
└── lib/
    ├── api/
    │   ├── http.ts               ← HTTP client with auth header injection
    │   ├── ccms-api.ts           ← Domain API functions (snapshot, history, commands)
    │   └── types.ts              ← TypeScript type definitions
    ├── auth/
    │   └── session-store.ts      ← localStorage session read/write
    ├── alert-generator.ts        ← Client-side alert simulation/mapping
    └── register-map.json         ← Default GPS coordinates for registration
```

## Routes

| Route | Description | API Dependencies |
|-------|-------------|-----------------|
| `/` | Landing page with branding and login/dashboard links | None |
| `/login` | Two-field form (Dashboard Key, Admin Key); stores in localStorage | None (client-only) |
| `/dashboard` | Fleet KPI cards, health bar chart, recent alerts | `DashboardAPIHandler?enquiry=snapshot` |
| `/panels` | Fleet inventory with status filter, search, sort, pagination; 3 view modes (map/grid/table) | `DashboardAPIHandler?enquiry=snapshot` |
| `/panel?id={panelId}` | Live status polling, command dispatch (relay ON/OFF, RTC schedule, shadow keys), telemetry charts (1H/24H/7D), anomaly insights | `enquiry=snapshot` + `enquiry=history` |
| `/manage-panel` | Create new panel or edit existing; GPS map picker; requires admin key | `POST`/`PATCH` to `DashboardAPIHandler` |
| `/analytics` | Multi-panel historical telemetry; charts, compare mode, raw data table, CSV export | `enquiry=history` |
| `/alerts` | Alert list with severity/status filters; acknowledge action | `enquiry=snapshot` (derived from fault panels) |

## Authentication

Auth is **key-based** and fully client-managed:

1. **Login page** captures:
   - `dashboardKey` (required) — sent as `x-dashboard-key` header
   - `adminKey` (optional) — sent as `x-admin-key` header; required for mutations
2. Session is stored in `localStorage` under `ccms_dashboard_session`.
3. Role is derived client-side:
   - **Admin** — when `adminKey` is present
   - **Operator** — when only `dashboardKey` is present
4. Route protection via `<RequireAuth>` wrapper redirects unauthenticated users to `/login`.
5. The `AppShell` component displays role chip and logout button in the header.

## API Integration

All backend calls go through a centralized HTTP client (`lib/api/http.ts`):

- Reads `NEXT_PUBLIC_API_BASE_URL` environment variable
- Injects `x-dashboard-key` and `x-admin-key` headers from session
- Handles JSON serialization/deserialization
- Throws on non-2xx responses

Domain logic is encapsulated in `lib/api/ccms-api.ts`, which:

- Transforms Lambda raw snapshot/history data into typed UI structures
- Computes derived metrics (e.g., estimated 24h energy from current fleet load)
- Isolates UI components from backend response shape changes

## Components

### AppShell
The console layout wrapper providing:
- Header with "CCMS Command Console" branding and role chip
- Navigation tabs: Dashboard, Panels, Analytics, Alerts
- Active route highlighting with glow effect
- Responsive design with max-width container

### FleetMap
Dynamic Leaflet map showing all panel locations with:
- Color-coded markers by status (Online/Offline/Fault)
- Popups with panel name, status, and link to detail page
- Dynamically imported to avoid SSR Leaflet issues

### LocationPickerMap
Used in panel registration for GPS coordinate selection:
- Click-to-set marker on map
- Returns latitude/longitude for form submission

### RequireAuth
Route guard that:
- Checks for valid session on mount
- Redirects to `/login` if unauthenticated
- Wraps all console routes

## Running Locally

```bash
cd ccms
npm install
npm run dev        # Development server at http://localhost:3000
npm run build      # Static export to ccms/out/
```

### Environment Variables

```env
NEXT_PUBLIC_API_BASE_URL=https://your-api-gateway-endpoint.execute-api.region.amazonaws.com/prod/
```

Copy values into `ccms/.env.local`.

## Deployment

Since `output: "export"` is configured in `next.config.ts`:

- The app builds entirely static files into `ccms/out/`
- Can be hosted on any static hosting (CDN, S3, GitHub Pages, Vercel without server functions)
- API base URL must be externally reachable and configured at build time