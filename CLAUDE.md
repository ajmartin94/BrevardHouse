# Martin Brevard House — project instructions

Family hub app for the Brevard, NC house. Requirements live in `docs/user-requirements.md` (the baseline); `README.md` has run instructions.

## Git workflow

- **Never commit directly on `main`.** All work happens on feature branches (`feature/<topic>`), merged via PR.
- **Commit often.** Small, logically scoped commits as work progresses — don't batch a day of work into one commit.

## Quick reference

- Node lives in `.toolchain/node` (no system install): `export PATH="$PWD/.toolchain/node/bin:$PATH"`
- `npm run seed` — rebuild + seed the dev DB (destructive); `npm run build` — build frontend; `npm start` — serve on 0.0.0.0:4545
- Backend: `server/` (Express + node:sqlite). Frontend: `web/` (React + Vite PWA). DB/uploads in `server/data/` (gitignored).
- Dev email is an outbox (Account → admin panel), not real SMTP. Offline/PWA needs HTTPS or localhost.
