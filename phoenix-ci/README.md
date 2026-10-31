# Project Phoenix — CI/CD pipeline (YAML)

GitHub Actions pipeline for the two Phoenix apps. This repo contains no application code — only
configuration and scripts.

```
phoenix-ci/
|-- .github/workflows/pipeline.yml   test -> run together -> smoke -> deploy -> verify
|-- .github/dependabot.yml           keeps the action versions up to date
`-- scripts/
    |-- smoke.sh                     end-to-end smoke test of a running stack
    `-- wait-for.sh                  waits until a URL answers
```

## What the pipeline must do

| Job | Runs when | Does |
|---|---|---|
| `backend` | every push / PR | checks out `phoenix-backend`, Node 20, MongoDB service, `npm ci`, typecheck, build, test |
| `frontend` | every push / PR | checks out `phoenix-frontend`, Node 20, `npm ci`, typecheck, build |
| `e2e` | after **both** succeed | real MongoDB, seeds, starts both apps **in the background**, waits for them, runs `smoke.sh` |
| `deploy` | after `e2e`, **only on push to `main`** | deploys both apps to Vercel with a pinned Vercel CLI |
| `verify` | after `deploy` | runs `smoke.sh` against production and checks the live version is this commit |

Rules: least-privilege `permissions`, actions pinned to versions (never `@master`/`@main`), no step that
can hide a failure (`|| true`, `continue-on-error`, `--legacy-peer-deps`, `--force`), secrets never printed,
every job has a timeout, caches keyed on the lockfile.

## Secrets / variables (repo settings)
* Secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_BACKEND_PROJECT_ID`, `VERCEL_FRONTEND_PROJECT_ID`
* Variables: `BACKEND_URL`, `FRONTEND_URL` (production URLs)

## Smoke test locally
```bash
./scripts/smoke.sh http://localhost:8000 http://localhost:3000            # any running stack
./scripts/smoke.sh https://<backend>.vercel.app https://<frontend>.vercel.app <expected-version>
```
It must print `SMOKE OK` when everything works and **exit non-zero** as soon as anything is wrong.
