# Martin Brevard House

Family hub for the Brevard, NC mountain house — stays, check-in/out, house projects, the house manual, an emergency page, a local guide, and a photo gallery. Built to `docs/user-requirements.md`.

**Stack:** Node 24 (bundled in `.toolchain/node`, no system install needed) · Express · SQLite (built-in `node:sqlite`, single file DB) · React 19 + Vite 8 · PWA via `vite-plugin-pwa`.

## Run the dev server

```sh
export PATH="$PWD/.toolchain/node/bin:$PATH"
npm run seed        # rebuild + seed the dev database (destructive)
npm run build       # build the React app into web/dist
npm start           # serve app + API on 0.0.0.0:4545
```

Then open the printed `network:` URL on any device on the same wifi (e.g. `http://192.168.x.x:4545`).

**Seeded logins** (all passwords `brevard2026`):
- Admin — `martin.andrew.94@gmail.com` (Andrew Martin)
- Members — `claire@example.com`, `ben@example.com`, `priya@example.com`, `marcus@example.com`
- Pending-account demo — `tom@example.com` (approve it in Account)

The seed also prints a **guest guide link** (`/guest/<token>`) — read-only house guide, no login.

## Layout

- `server/` — Express API (`routes.js`), schema (`db.js`), seed (`seed.js`); DB + uploads live in `server/data/` (gitignored)
- `web/` — React SPA; `npm run build --prefix web` outputs `web/dist`, which the server serves
- `scripts/backup.sh` — nightly DB + uploads backup (NFR-4); schedule with cron/launchd
- `docs/` — requirements (`user-requirements.md`), UX audit, improvement research, archived prototype

## Dev notes / known dev-mode limits

- **Email (NTF-1/2)** uses a dev transport: every message is stored in an outbox (Account → “Email outbox (dev)”) and logged to the server console. Point `lib.js#sendMail` at real SMTP for production.
- **Service worker / offline (GEN-1)** requires a secure context. It fully works on `http://localhost:4545`; on plain-HTTP LAN IPs browsers skip SW registration, so offline caching won't engage on phones until the app is served over HTTPS (fine for this testing round — the VPS deploy will have TLS).
- **Image derivatives (NFR-3)**: thumbnails are generated client-side at upload (max 480px JPEG) and served for all grids; originals are kept and served in the lightbox. If photo volume outgrows the VPS disk, the documented growth path is object storage or an Immich sidecar with deep-linked trip albums (see `docs/improvement-research.md` §B6).
- Iterating on the frontend? `npx vite` in `web/` gives hot reload with `/api` proxied to :4545.
