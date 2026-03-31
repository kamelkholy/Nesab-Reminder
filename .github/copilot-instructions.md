# Nesab Reminder — Project Guidelines

Islamic Zakat tracking app: React + Vite frontend, Express + MongoDB backend. Single-user, JWT-authenticated.

## Architecture

- **Client** (`client/`): React 18, React Router v6, Vite, TypeScript (strict). Dev proxy on `/api` → `localhost:3001`.
- **Server** (`server/`): Express 4, Mongoose 8 (MongoDB 7), TypeScript (strict). Runs on port 3001.
- **Auth**: Single-user JWT. Credentials from `AUTH_USERNAME`/`AUTH_PASSWORD` env vars. Token stored in `localStorage`.
- **DB**: MongoDB via Mongoose. Settings stored as individual documents, not env vars.
- **Email**: Azure Communication Services only (not SMTP).

## Build and Test

```bash
npm run install:all   # Install root + server + client deps
npm run dev           # Start both (concurrently) — server:3001, client:5173
npm run build         # Build both for production
npm start             # Production: node server/dist/index.js (serves client/dist)
```

No test framework is configured yet.

## Conventions

- **Dual dates**: Every asset stores both Gregorian (`YYYY-MM-DD`) and Hijri (`YYYY/MM/DD`) dates. Always populate both.
- **Currency**: All amounts consolidated to EGP for Zakat calculation. USD→EGP conversion via rate in settings.
- **Hijri utils**: Server uses `moment-hijri` (CommonJS `require()`). Client has a minimal standalone formatter — do not import `moment-hijri` on the client.
- **Asset types**: `'cash' | 'investment' | 'stock'`. Stocks have `quantity` and `ticker` fields.
- **Types are mirrored**: `server/src/types.ts` and `client/src/types.ts` define the same interfaces. Keep them in sync when changing shared types.
- **API pattern**: Client uses a generic `request<T>()` helper in `client/src/services/api.ts`. Auto-attaches Bearer token; 401 → clear token + redirect to `/login`.
- **Route protection**: Server applies `authMiddleware` to `/api/assets` and `/api/zakat`. Auth routes (`/api/auth/*`) are public.
- **Cron job** (`0 8 * * *`): Auto-fetches exchange/gold/stock rates (if enabled), generates Zakat records, sends email reminders. Logic lives in `server/src/index.ts`.

## Domain Concepts

- **Nisab**: 85 grams of gold (threshold for Zakat obligation).
- **Hawl**: One full Hijri year. Starts when wealth first exceeds Nisab. Resets if wealth drops below.
- **Zakat rate**: 2.5% of zakatable wealth in EGP.
- **Excluded assets**: Assets acquired after Hawl completion date belong to the next cycle.

## Deployment

See [DEPLOY.md](../DEPLOY.md) for Azure deployment (Cosmos DB + App Service). Key env vars: `MONGODB_URI`, `JWT_SECRET`, `AUTH_USERNAME`, `AUTH_PASSWORD`, optionally `ACS_CONNECTION_STRING`, `ACS_SENDER_ADDRESS`, `EMAIL_TO`.
