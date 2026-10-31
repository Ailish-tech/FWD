# Project Phoenix — Frontend

Next.js 14 (App Router) + React 18 + TypeScript.

Screens: login, workspace list, workspace detail (projects + credit balance), members
(owner/admin only), and a task board with search, status filter, pagination and
"create task" (costs 1 credit).

## Requirements
* Node.js **20** (>= 18.17 works locally)
* The Phoenix API running (see `phoenix-backend`)

## Run locally
```bash
npm ci
cp .env.example .env.local      # point NEXT_PUBLIC_API_URL at the API
npm run dev                     # http://localhost:3000
```

## Production build
```bash
npm ci && npm run typecheck && npm run build && npm start
```
`NEXT_PUBLIC_*` variables are inlined into the browser bundle at **build** time.

## Deploy to Vercel
1. Import this repository in Vercel (framework preset: **Next.js**).
2. Project -> Settings -> Environment Variables:
   * `NEXT_PUBLIC_API_URL` - the backend URL, e.g. `https://phoenix-backend.vercel.app`
     (it is baked into the bundle at build time, so redeploy after changing it)
3. Add the frontend URL to the backend's `CORS_ORIGINS` and redeploy the backend.

## Expected behaviour
* Login with `alice@phoenix.dev` / `phoenix123`; the session survives a page refresh.
* Search shows results for the latest text typed; changing a filter returns to page 1.
* Double-clicking "Create task" creates exactly one task.
* Server errors, expired sessions and genuinely empty results are shown differently.
* Logging out and in as another user never shows the previous user's data.
* API JSON is snake_case (`created_at`, `access_token`, …).
