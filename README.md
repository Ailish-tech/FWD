# Project Phoenix — Recover the Broken Platform

You have inherited **Phoenix**, a multi-tenant project tracker, on a Friday evening.
The previous team left three repositories and a note that says *"it worked on my machine"*.
Nothing installs. Nothing starts.

| Folder | Stack | Deploys to |
|---|---|---|
| `phoenix-backend/` | Node.js 20, TypeScript, Express, MongoDB (Mongoose) | Vercel (serverless) |
| `phoenix-frontend/` | Node.js 20, Next.js 14, React 18, TypeScript | Vercel |
| `phoenix-ci/` | GitHub Actions pipeline (YAML) + smoke test script | GitHub |

Each folder has its own README describing how it is **supposed** to behave.
The READMEs are correct. The code and the configuration are not.

---

## 1. Your MongoDB (Atlas)

1. Create a free cluster on **MongoDB Atlas**.
2. *Database Access*: add a user with a password.
3. *Network Access*: allow your IP (or `0.0.0.0/0` for the event).
4. *Connect* -> *Drivers* -> copy the `mongodb+srv://...` string and add the database name `/phoenix`.
5. Put it in `phoenix-backend/.env` together with the other settings the backend README asks for.

Your `.env` never leaves your computer — the checker below does not upload it.

## 2. Demo data & logins

Once the backend builds, the seed script creates the demo data (see the backend README).
All demo users have the password **`phoenix123`**:

| Login | Who |
|---|---|
| `alice@phoenix.dev` | Owner of **Acme Corp** (starts with 3 credits) |
| `bob@phoenix.dev` | Member of **Acme Corp** |
| `carol@phoenix.dev` | Owner of **Globex Secret Lab**, not part of Acme |

## 3. Check your score

Open the grader at **http://13.233.41.22:7070/** and test your solution there.

1. Enter your team name.
2. Select this whole folder (the one containing `phoenix-backend`, `phoenix-frontend` and `phoenix-ci`).
3. Start the check.

The grader zips your code (without `node_modules`, build output, `.git` and `.env`), installs, builds and runs **your** code
from scratch on a fresh database and runs the hidden tests. You get back how many tests pass and fail in
**Backend**, **Frontend**, **App config & CI** and **Pipeline (YAML)** — not which ones. Check as often as you like.

---

## 4. Where the bodies are buried

We won't tell you what is broken. We will tell you **where to be suspicious**.
Every line is true for at least one of the three repositories. Some are true for more than one.

**Arrival**
- *Some packages refuse to sit at the same table. One list of packages remembers a different past.*
- *A program that cannot find its own front door. A program that wakes up speaking the wrong language.*
- *Three people, three names for the same database. A settings file nobody opens.*

**The database**
- *The driver moved on years ago. The connection code did not get the memo.*
- *A model may be born only once — and it can only speak through the line it was born on.*
- *The schema, the code and the screen each believe something different about a user, a status and a number.*
- *A seed that tells you everything went fine.*
- *A promise that two people can never have the same thing — written down, but never enforced.*

**The server**
- *Order matters in a pipeline. So does the shape of a wildcard.*
- *A signature checked with a different pen than the one that signed it.*
- *A health check that is always healthy is a liar.*
- *One strange visitor should not be able to bring the whole house down.*

**Money & data**
- *Two people spend the last coin at the same time.*
- *Asking twice should cost once.*
- *What a user types is text, not a spell.*
- *Page one. Ties. A cache that remembers too much — or forgets the wrong thing.*
- *A locked door in the UI is not a locked door.*

**The browser**
- *The server has no window.*
- *Two hooks share a name and live in different houses.*
- *A key written under one name and read under another.*
- *An address that is written into the bundle long before the bundle knows where it lives.*
- *Late answers to old questions. Fast fingers. Every failure dressed up as "nothing found".*
- *A library that changed its doors between versions.*

**The launch**
- *A function in the cloud is not a server that waits by the phone.*
- *A signpost pointing to a door that does not exist.*
- *A build recipe that names a step nobody wrote.*
- *A pipeline that cannot fail, running on yesterday's engine, holding every key in the building.*

**The pipeline**
- *A key written twice: one of them is silently forgotten - or the whole file is refused.*
- *A workflow that only listens to a branch nobody pushes to.*
- *Starting a server and waiting for it to finish.*
- *Jobs that don't wait for each other, and a deploy that doesn't care who asked.*
- *A database that lives somewhere else than the address says.*
- *A secret said out loud.*
- *A smoke detector without a battery: it never goes off.*

---

## 5. How the winner is decided

1. **The first team whose submission scores every test (67 / 67) and includes a `REPORT.md`** in this
   top folder wins. The time that counts is the moment that submission was uploaded.
2. `REPORT.md` must explain every fix (symptom, root cause, fix, how you verified it) — at least 150 words,
   in your own words. The organizers read it and ask you to explain a few fixes live. A copied or empty report,
   or a team that can't explain its own fixes, loses the spot to the next team.
3. If nobody reaches 67 / 67 before time is up: highest score wins; equal scores go to the team that reached
   that score first.

## 6. Rules

1. Do not rewrite the application or switch frameworks/databases. Fix what is there.
2. Do not disable, skip or weaken tests and checks (`|| true`, `continue-on-error`, `--legacy-peer-deps`,
   `--force`, `// @ts-ignore`, `any` casts to silence the compiler, deleting tests …).
3. Every dependency upgrade or downgrade must be justified in your report.
4. The final score comes from the same grader, run on your last submission on a clean machine.

## 7. Deliverables

* Your fixed `phoenix-backend`, `phoenix-frontend` and `phoenix-ci` and your `REPORT.md`, all in this folder,
  submitted through the grader at http://13.233.41.22:7070/.

## 8. You are done when

* `npm ci`, `npm run typecheck` and `npm run build` pass in both apps.
* The backend starts against a **fresh** MongoDB, the seed creates the demo data, and `/api/health` tells the truth.
* Both apps would deploy to Vercel as their READMEs describe, and the pipeline in `phoenix-ci` would really run green on GitHub.
* `phoenix-ci/scripts/smoke.sh` passes on your running apps and fails when something is down.
* The grader at http://13.233.41.22:7070/ shows every section green.

Good luck. Trust nothing that says "OK".
