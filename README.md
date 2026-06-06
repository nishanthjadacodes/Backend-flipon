# FliponeX Backend

Node/Express + Sequelize API serving the customer Android app, the agent app, the admin dashboard, and the customer website. Deployed on Render; production DB is MySQL/TiDB.

---

## Local development

```bash
npm install
cp .env.example .env       # then fill in DB creds + JWT_SECRET
npm run dev                # nodemon, autoreloads
```

Boot migrations run automatically on every server start (see `src/utils/bootMigrations.js`) — schema and code ship together, no manual `ALTER TABLE` step.

---

## First-time setup — creating the first Super Admin

The admin signup endpoint is **closed by default in production** (see [Admin auth model](#admin-auth-model) below). To bootstrap a fresh deployment with a Super Admin, run the `create-admin.js` script:

```bash
node scripts/create-admin.js <email> <password> <name> <mobile> <role>

# Example — replace with your real founder details:
node scripts/create-admin.js admin@fliponex.com "MyStrong#Pass1" "Founder Name" "+91XXXXXXXXXX" super_admin
```

The script:
- Hashes the password with bcrypt (compatible with `/api/auth/admin/login`)
- Validates the role against the allowed list
- **Idempotent UPSERT** — re-running with the same email *resets* the password (this is also the "forgot password" recovery path)
- Uses raw SQL, so it survives Sequelize model drift

`role` must be one of: `super_admin`, `operations_manager`, `b2b_admin`, `finance_admin`, `customer_support`.

### Running against production from a local machine

The script reads DB connection details from `.env`. To run it against production:

1. Copy `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSL=true`, `NODE_ENV=production` from your Render dashboard's Environment tab into a temp file `.env.prod` (in this repo).
2. Run with `node --env-file=.env.prod scripts/create-admin.js …`.
3. **Delete `.env.prod` immediately afterwards** — production creds shouldn't linger on a laptop.

---

## Adding more admins after the first

Once the first Super Admin can log in, **don't use the CLI script again** for routine onboarding. Use the in-app invite flow:

1. Super Admin → dashboard → **Team** section → **Invite admin**.
2. Enter teammate's email + role → a one-shot link is generated.
3. Share the link via WhatsApp / Slack / email (the link is shown exactly once).
4. The teammate redeems via `/accept-invite?token=…`, sets their own password, lands logged in.

This avoids ever having a "temporary password" in plaintext that needs handover.

---

## Admin auth model

- `/api/auth/admin/signup` is **gated by `ADMIN_SIGNUP_TOKEN` env var in production** (returns 410 Gone if the env var is unset). This is intentional — the route was previously open to the internet.
- `/api/auth/admin/login` — email + password, returns a 30-day JWT.
- Per-role uniqueness was removed (multiple users can share a role for shift coverage).
- Invite-link flow lives at `/api/admin/users/invites` (Super-Admin-only create/list/revoke) + `/api/auth/admin/invite/:token` + `/api/auth/admin/accept-invite` (public — token is the auth).

See `src/controllers/adminAuthController.js`, `src/controllers/adminInviteController.js`, and `src/middleware/rbac.js` for the full flow.

---

## Common operations

| Task | Command |
|---|---|
| First-time Super Admin | `node scripts/create-admin.js <email> <pass> <name> <mobile> super_admin` |
| Forgot Super Admin password | Re-run the same command — UPSERT resets the password |
| Reset all admin seats (dev) | `node scripts/reset-admin-seats.js --all --hard --confirm` (destructive) |
| Production data bootstrap | `npm run bootstrap:prod` — runs all migrations + seeds (services + admin roles) |

---

## Deployment

- Production deploys via the `backend-flipon` git remote (NOT `origin`). Render watches it.
- Push to `backend-flipon/master` → Render auto-rebuilds → `bootMigrations.js` applies any new schema changes on first request.

Environment variables of note (set in Render dashboard):
- `JWT_SECRET` — required, long random string
- `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` / `DB_SSL` — MySQL/TiDB connection
- `NODE_ENV=production` — switches on prod-only behavior (closed admin signup, prod OTP sender, etc.)
- `ADMIN_SIGNUP_TOKEN` — leave EMPTY to close `/admin/signup`; set to a long random string for emergency-only one-off signup
- `ADMIN_DASHBOARD_URL` — host the dashboard runs at (e.g. `https://www.fliponex.com`). Used to build invite links.
- `ADMIN_INVITE_TTL_DAYS` — optional, defaults to 7
