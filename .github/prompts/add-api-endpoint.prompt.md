---
description: "Scaffold a new API endpoint with Express route, client service method, and TypeScript types."
agent: "agent"
argument-hint: "HTTP method, path, and purpose (e.g., 'GET /api/reports/monthly - fetch monthly Zakat report')"
---

Scaffold a new API endpoint for the Nesab Reminder app following existing patterns.

## Input

The user will provide:
- **HTTP method**: GET, POST, PUT, or DELETE
- **Route path**: e.g., `/api/reports/monthly`
- **Purpose**: What the endpoint does

## Steps

### 1. Determine if this needs a new route file or fits an existing one

Existing route files:
- [server/src/routes/assets.ts](../../server/src/routes/assets.ts) — Asset CRUD
- [server/src/routes/zakat.ts](../../server/src/routes/zakat.ts) — Zakat records, settings, price fetching
- [server/src/routes/auth.ts](../../server/src/routes/auth.ts) — Login and token verification (public)

If a new route file is needed, create it in `server/src/routes/` and register it in [server/src/index.ts](../../server/src/index.ts) under `authMiddleware` (unless it should be public).

### 2. Add types — if the endpoint returns a new shape

- Add the response/request interface to [server/src/types.ts](../../server/src/types.ts)
- Mirror it in [client/src/types.ts](../../client/src/types.ts)

### 3. Implement the server route

Follow the existing pattern in the route files:
- Use `express-validator` for input validation (`body()`, `param()`, `query()`)
- Check `validationResult(req)` before processing
- Return JSON responses
- Typed `Request` and `Response` from Express

Example pattern:
```typescript
router.get('/path', async (_req: Request, res: Response) => {
  const result = await someModel.getData();
  res.json(result);
});
```

### 4. Add client service method — [client/src/services/api.ts](../../client/src/services/api.ts)

Use the existing `request<T>()` helper which auto-attaches the Bearer token and handles 401 redirects:

```typescript
export const getExample = () =>
  request<ExampleType>('/route/path');

export const createExample = (data: Partial<ExampleType>) =>
  request<ExampleType>('/route/path', {
    method: 'POST',
    body: JSON.stringify(data),
  });
```

### 5. Wire up in the UI (if requested)

- Add the call in the relevant page component
- Handle loading/error states following existing patterns (toast notifications via the App-level toast system)

## Constraints

- Protected routes must be registered under `authMiddleware` in `server/src/index.ts`
- Auth routes (`/api/auth/*`) are the only public routes
- Use `express-validator` for all input validation — do not validate manually
- Client API methods always go through `request<T>()` — never use raw `fetch`
- Run `npm run build` to verify no TypeScript errors after changes
