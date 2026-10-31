# Project Phoenix — Backend API

Node.js 20 + TypeScript + Express 4 + **MongoDB** (Mongoose 8).

A small multi-tenant project tracker: users belong to **workspaces** (roles: owner/admin/member),
workspaces have **projects**, projects have **tasks**. Creating a task costs **1 credit**.
Every credit change is also written to a **credit ledger** (history).

## 1. Get a MongoDB
Use any MongoDB 6+ you like:
* **MongoDB Atlas (free tier)**: create a cluster -> *Connect* -> *Drivers* -> copy the
  `mongodb+srv://...` string. Add your IP under *Network Access*.
* **Local** (optional): a locally installed `mongod` -> `mongodb://localhost:27017/phoenix`

## 2. Configure
```bash
cp .env.example .env
# edit .env:
#   MONGODB_URI=<your connection string, include a database name e.g. /phoenix>
#   JWT_SECRET=<any random string, 32+ characters>
```

## 3. Install, build, seed, run
```bash
npm ci
npm run build
npm run seed          # creates demo data (safe to run again)
npm start             # http://localhost:8000/api/health
```
`npm run seed:reset` wipes the Phoenix collections and seeds again. Dev mode with reload: `npm run dev`.

## Deploy to Vercel
1. Import this repository in Vercel (framework preset: **Other**). `vercel.json` routes every request
   to the serverless function in `api/index.ts`.
2. Project -> Settings -> Environment Variables:
   * `MONGODB_URI` - your Atlas connection string (Atlas -> Network Access must allow `0.0.0.0/0`,
     because Vercel has no fixed IPs)
   * `JWT_SECRET` - random string, 32+ characters
   * `CORS_ORIGINS` - the frontend URL, e.g. `https://phoenix-frontend.vercel.app`
3. Deploy, then seed once from your machine with the same `MONGODB_URI`: `npm run build && npm run seed`.
4. Check `https://<your-backend>.vercel.app/api/health`.

## Demo logins (password for all: `phoenix123`)
| Email | Role |
|---|---|
| `alice@phoenix.dev` | owner of **Acme Corp** (starts with 3 credits) |
| `bob@phoenix.dev` | member of **Acme Corp** |
| `carol@phoenix.dev` | owner of **Globex Secret Lab**, NOT in Acme |

Seed data: Acme has *Website Revamp* (25 tasks imported in one batch) and *Mobile App* (5 tasks);
Globex has a confidential project *Project Nightingale*.

## Tests
```bash
MONGODB_URI=mongodb://localhost:27017/phoenix_test npm test
```
The tests wipe that database — use a separate, disposable one.

## API summary
| Method | Path | Notes |
|---|---|---|
| GET | /api/health | 200 only when MongoDB answers; `{status, version, db}` |
| POST | /api/auth/register, /api/auth/login | returns `{access_token, token_type, user}` |
| GET | /api/auth/me | |
| GET/POST | /api/workspaces | |
| GET | /api/workspaces/{id} | |
| GET/POST | /api/workspaces/{id}/members | POST: owner/admin only |
| GET | /api/workspaces/{id}/credits | |
| POST | /api/workspaces/{id}/credits/topup | owner only |
| GET/POST | /api/workspaces/{id}/projects | |
| GET | /api/projects/{id} | |
| GET/POST | /api/projects/{id}/tasks | GET: `q` (plain text search), `status`, `page`, `page_size`. POST: honours `Idempotency-Key` header, costs 1 credit, 402 when out of credits |

Ids are strings. All JSON is **snake_case** (`created_at`, `created_by_id`, …). Errors are `{"detail": ...}`.
Unknown or malformed ids return 404, never 500.
