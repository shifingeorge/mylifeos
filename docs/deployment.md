# Deployment

Two environments, two databases, two signing secrets. The separation is the
point: a preview build must never be able to write to the real ledger, and a
token minted by preview must never unlock production.

| | Production | Preview |
| --- | --- | --- |
| Branch | `main` | `dev` |
| Domain | `mylifeos.shiftd.in` | `dev.mylifeos.shiftd.in` |
| Neon branch | `main` | `dev` |
| App name | `LIFE_OS` | `LIFE_OS · DEV` |
| Icon | filled accent cells | outlined cells |

Both environments are `noindex`. A personal tool holding shop data does not
belong in a search index.

## Environment variables

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string. Different branch per environment. |
| `PIN_HASH` | argon2id hash of the unlock PIN. Generate with `node scripts/hash-pin.mjs <pin>`. |
| `AUTH_SECRET` | JWT signing key, 32 random bytes base64url. Must differ between environments. |
| `NEXT_PUBLIC_ENV_LABEL` | `dev` on preview, `prod` on production. Only the exact string `dev` changes app name, icon and manifest — any other value is treated as production. |

Set the scope on each variable explicitly. Untick **Development**; that scope
is only read by `vercel dev`, which this project does not use.

### The `$` trap

A local `.env` consumed by Next must escape every `$` in the argon2 hash as
`\$`. Next's dotenv layer performs variable expansion, so an unescaped
`$argon2id$v=19$...` loads as `=19=19456,t=2,p=1` and every PIN then fails
with no explanatory error. Single quotes do **not** prevent this;
backslash-escaping each `$` does.

Vercel stores values verbatim and performs no expansion. Paste the raw hash
there, unescaped.

## First deploy

1. Import the GitHub repo into Vercel. Production branch `main`, framework
   auto-detected. No build settings need changing.
2. Add the environment variables above, correctly scoped.
3. Push `dev` and confirm the preview deploy builds.
4. Assign `dev.mylifeos.shiftd.in` to the `dev` branch and
   `mylifeos.shiftd.in` to production, then add the CNAME records Vercel
   prints at the `shiftd.in` registrar.
5. Verify preview on the phone — unlock, tick, reload, airplane-mode reload —
   before merging to `main`.

## Checking a deployment

`GET /api/health` reports whether the instance is configured *and* whether
its database matches the code, without requiring the PIN — it has to answer
when auth is the thing that is broken:

```sh
curl -s https://<deployment>/api/health
{"ok":true,"env":"dev","missing":[],"problems":[],"dbHost":"ep-flat-unit-…","schema":"ok"}
```

`200` when everything checks out, `503` otherwise. `dbHost` confirms the
environment is pointed at the right Neon branch, which is the mistake with
the worst consequences.

`schema` is a live query against `tasks` and `categories.updated_at`. It
reads `schema behind code — run drizzle-kit migrate` when the deploy ran
ahead of the migrations below — the failure that otherwise shows up nowhere,
because `/api/sync` 500s and the sync loop swallows it by design:

```sh
{"ok":false,…,"schema":"schema behind code — run drizzle-kit migrate"}
```

Any other database failure reads `query failed (<code>)`. No secret value,
connection string or raw driver message is ever included in the response.

## Deployment protection

Vercel enables **Vercel Authentication** on new projects, which bounces every
request to a Vercel login page. It must be disabled: a service worker cannot
authenticate through that redirect, so the PWA would never install or work
offline, and the app would be unreachable on the phone.

The app is not left unprotected by this. `proxy.ts` matches on a denylist,
not an allowlist: every route is guarded except an explicit public list
(`/unlock`, `/api/auth`, `/api/health`, the manifests, the icons and Next's
own static output). A route added tomorrow is therefore guarded by default —
forgetting to protect a new screen is not a mistake this configuration lets
you make. The PIN itself is argon2id-hashed and verified server-side with a
lockout that doubles to an hour. Anyone reaching the URL sees only the unlock
screen.

## Migrations

`drizzle-kit migrate` reads `DATABASE_URL` from the environment. Run it once
per Neon branch:

```sh
npm run db:migrate                       # uses .env (dev branch)
DATABASE_URL="<prod string>" npm run db:migrate
```

Migrations are not run at deploy time on purpose. A schema change that fails
halfway during a build would leave the app pointing at a database it does not
match; running it by hand keeps the two steps separately verifiable.

Seed data is not inserted by the migration. The sync endpoint upserts
categories and habits from `src/lib/db/seed.ts` on every request, so a fresh
production database populates itself on the first sync from the phone.
