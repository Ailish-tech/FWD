# Project Phoenix — Quick Bug Summary (What, Why, Solved)

A concise, high-yield guide to all bugs, why they happened, and how they were resolved.

---

### 1. Environment & Build

| # | Bug | Why It Was a Bug | How It Was Solved |
|---|---|---|---|
| **1** | **`npm ci` failing** | `package.json` and lockfiles were drifted (`express 5.3` vs `4.22`, `react-dom 17` vs `react 18`). | Realigned `package.json` to match locked versions (`express: 4.22.3`, `react-dom: 18.3.1`). |
| **2** | **Cannot find `server.js`** | `tsconfig.json` built to `build/`, but `package.json` started from `dist/`. | Changed `compilerOptions.outDir` in `tsconfig.json` to `"dist"`. |
| **3** | **`exports is not defined`** | Backend `package.json` had `"type": "module"`, but `tsconfig.json` compiled CommonJS. | Removed `"type": "module"` from `phoenix-backend/package.json`. |
| **4** | **`module is not defined`** | `next.config.mjs` is an ESM file, but used CommonJS `module.exports`. | Changed to `export default nextConfig;` and removed old `experimental.appDir`. |
| **5** | **`preserveValueImports` error** | Deprecated compiler option removed in TypeScript 5.6. | Removed `"preserveValueImports": true` from `phoenix-frontend/tsconfig.json`. |
| **6** | **CORS startup crash** | `JSON.parse(CORS_ORIGINS)` threw syntax error on plain strings like `"http://localhost:3000"`. | Added safe fallback parsing (try JSON array, fallback to comma-split). |

---

### 2. Database & Models

| # | Bug | Why It Was a Bug | How It Was Solved |
|---|---|---|---|
| **7** | **Models disconnected** | `mongoose.createConnection()` created an isolated instance, leaving global models unattached. | Changed to standard `await mongoose.connect(uri)`. |
| **8** | **Unique checks unenforced** | `autoIndex: false` prevented MongoDB from creating unique indexes for email and members. | Enabled `autoIndex: true` and added `Promise.all(models.map(m => m.syncIndexes()))`. |
| **9** | **`OverwriteModelError`** | `User` model was compiled once in `models/user.ts` and again in `models/index.ts`. | Compiled `User` only in `user.ts` and cleanly re-exported in `index.ts`. |
| **10** | **Schema field mismatches** | `userSchema` looked for `password` instead of `passwordHash`; `credits` was a `String`; status lacked `doing`. | Fixed `passwordHash`, set `credits: Number`, and updated statuses to `["todo", "doing", "done"]`. |
| **11** | **Empty database after seed** | `scripts/seed.ts` called `main()` without `await`, exiting before inserting records. | Awaited `main()` before calling `process.exit(0)`. |
| **12** | **Windows Atlas DNS error** | Windows local DNS failed to resolve `mongodb+srv://` SRV records. | Added public DNS fallback (`8.8.8.8`, `1.1.1.1`) via Node's `dns.setServers`. |

---

### 3. Server & Middleware

| # | Bug | Why It Was a Bug | How It Was Solved |
|---|---|---|---|
| **13** | **POST body is `undefined`** | `express.json()` was registered *after* all routes instead of before. | Moved `app.use(express.json())` before router declarations. |
| **14** | **401 on valid tokens** | `createAccessToken` signed with `HS256`, but `decodeAccessToken` verified with `HS512`. | Changed verification algorithm in `security.ts` to `[s.JWT_ALGORITHM]`. |
| **15** | **Lying health check** | `/api/health` returned static `{ status: "ok" }` even when MongoDB was disconnected. | Checked `mongoose.connection.readyState === 1`: returns `200` if up, `503` if down. |
| **16** | **500 on bad input** | `errorHandler` didn't catch Mongoose validation or body-parser 413 errors. | Handled `mongoose.Error.ValidationError` (422) and upstream status codes (400, 413). |

---

### 4. Concurrency, Money & Data

| # | Bug | Why It Was a Bug | How It Was Solved |
|---|---|---|---|
| **17** | **Credit race condition** | Non-atomic `credits < 0` and `ws.save()` allowed concurrent overdrafting below 0. | Used atomic update: `Workspace.findOneAndUpdate({ _id, credits: { $gte: cost } }, { $inc: { credits: -cost } })`. |
| **18** | **Double-spend on retry** | Only checked underscore `idempotency_key`, and concurrent retries threw duplicate key error. | Accepted `Idempotency-Key` / `idempotency_key` and added atomic rollback/refund. |
| **19** | **ReDoS regex injection** | `new RegExp(query.q)` crashed on user inputs containing characters like `(`, `[`, `*`. | Escaped search queries with `escapeRegex()`. |
| **20** | **Skipping page 1 & ties** | `skip(page * size)` skipped items 1–10; identical timestamps caused unstable sort order. | Changed to `(page - 1) * size` and added tie-breaker `.sort({ createdAt: -1, _id: -1 })`. |
| **21** | **Project cache leak** | `cacheGet` was evaluated before verifying workspace membership. | Enforced `requireMember()` check before accessing the cache. |
| **22** | **RBAC permission bypass** | Standard members could invite teammates and top up credits. | Restricted member creation to `requireAdmin`, and top-up to `role === "owner"`. |
| **23** | **Unassigned user task bug** | Created tasks with assignees who were not workspace members. | Pre-validated `WorkspaceMember.exists()` before deducting credits. |

---

### 2. Frontend Client

| # | Bug | Why It Was a Bug | How It Was Solved |
|---|---|---|---|
| **24** | **SSR `localStorage` crash** | `localStorage.getItem()` ran on Node server where `window` is undefined. | Wrapped with `typeof window !== "undefined"` check. |
| **25** | **`NextRouter not mounted`** | Imported `useRouter` from `next/router` (Pages Router) instead of `next/navigation`. | Changed to `import { useRouter } from "next/navigation"`. |
| **26** | **Session lost on refresh** | Wrote to `"phoenix_token"` but read from `"phoenix.token"`; expected `res.token` instead of `access_token`. | Synchronized both storage keys and mapped `access_token`. |
| **27** | **`date-fns/format` error** | Subpath exports were removed in `date-fns` v3. | Changed to root import: `import { format } from "date-fns"`. |
| **28** | **Double-click duplicates** | Button lock was asynchronous (`setBusy(true)` after `await api()`). | Locked synchronously before `api()` call and sent UUID `Idempotency-Key`. |
| **29** | **Search race condition** | Out-of-order search responses overwrote newer queries, and errors were masked as empty list. | Added `activeReqId` sequence check and displayed real error messages. |

---

### 6. Deployment & CI/CD Pipeline

| # | Bug | Why It Was a Bug | How It Was Solved |
|---|---|---|---|
| **30** | **Serverless lambda hanging** | Backend `api/index.ts` called `app.listen()`, blocking cloud function execution. | Removed `app.listen()` and exported standard Express handler. |
| **31** | **Backend Vercel 404** | `vercel.json` rewrote to `/api/server` instead of `/api/index`. | Corrected rewrite target to `/api/index`. |
| **32** | **Frontend Vercel build fail** | `vercel.json` specified `npm run export` (deprecated command). | Changed `"buildCommand"` to `"npm run build"`. |
| **33** | **Pipeline never triggers** | Workflow listened to `branches: [master]`, but repo uses `main`. | Updated trigger to `branches: [main]`. |
| **34** | **Pipeline hang in E2E** | `npm start` ran in foreground without backgrounding. | Started services with `&` and polled with `wait-for.sh`. |
| **35** | **Secret leak in CI** | Workflow logged Vercel tokens via `echo "deploying with token ..."`. | Removed plaintext echo of secret. |
| **36** | **Deceptive smoke test** | `smoke.sh` lacked `set -e`, hit `/health`, and always printed `SMOKE OK`. | Rewrote with `set -euo pipefail`, hit `/api/health`, and verified tokens. |
| **37** | **CI anti-patterns** | Used Node 16, unpinned `@master` actions, `--legacy-peer-deps`, and `|| true`. | Pinned to Node 20, `@v4` actions, `npm ci`, and clean error handling. |

