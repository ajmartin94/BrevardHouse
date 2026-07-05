# Deployment — DigitalOcean VPS

Step-by-step for a first deploy of Martin Brevard House to a DigitalOcean droplet, with HTTPS and a real admin login (no seeded demo data).

**Assumes:** a droplet you already rent, a domain (or subdomain) you can point at it, and the Gmail SMTP credentials from the app's SMTP setup.

---

## 1. Point DNS at the droplet

In your domain's DNS settings, add an **A record** for the (sub)domain you'll use (e.g. `house.yourdomain.com`) pointing at the droplet's public IPv4 address. This can take a few minutes to propagate — start it now so it's ready by the time you need it (step 8).

## 2. Initial server setup

SSH in as root, then create a non-root deploy user and lock down the firewall:

```sh
adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy   # copy your SSH key so you can still log in

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

Log out and back in as `deploy` (`ssh deploy@your-droplet-ip`) for the rest of the steps.

## 3. Install Node.js 24

The app uses `node:sqlite`, which needs Node ≥ 22.5; this project is built/tested on Node 24. Install via NodeSource:

```sh
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # expect v24.x
```

## 4. Install Caddy (reverse proxy + automatic HTTPS)

Caddy gets you a valid Let's Encrypt cert with almost no config — appropriate for a single small app on one droplet.

```sh
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

## 5. Get the code onto the droplet

```sh
sudo mkdir -p /srv/brevardhouse
sudo chown deploy:deploy /srv/brevardhouse
git clone https://github.com/ajmartin94/BrevardHouse.git /srv/brevardhouse
cd /srv/brevardhouse
git checkout main   # or whichever branch you're deploying
```

For private-repo access without pasting a personal token into shell history, set up a [deploy key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys) instead of HTTPS.

## 6. Install dependencies and build the frontend

```sh
npm ci
npm ci --prefix web
npm run build
```

`npm run build` outputs `web/dist`, which the server serves directly — no separate frontend host needed.

## 7. Configure `.env`

```sh
cp .env.example .env
nano .env
```

Fill in:
- `PORT=4545` (fine to leave as-is; Caddy will proxy to it)
- `APP_URL=https://house.yourdomain.com` (the domain from step 1 — used to build the admin sign-in link in step 10)
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` — the Gmail app-password credentials

`.env` is gitignored; it never leaves this server.

## 8. Run the app as a systemd service

```sh
sudo tee /etc/systemd/system/brevardhouse.service > /dev/null <<'EOF'
[Unit]
Description=Martin Brevard House
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/srv/brevardhouse
ExecStart=/usr/bin/node server/server.js
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now brevardhouse
sudo systemctl status brevardhouse   # should show "active (running)"
```

`EnvironmentFile` isn't needed — the app loads `/srv/brevardhouse/.env` itself via `dotenv`.

## 9. Configure Caddy

```sh
sudo tee /etc/caddy/Caddyfile > /dev/null <<'EOF'
house.yourdomain.com {
    reverse_proxy 127.0.0.1:4545
}
EOF

sudo systemctl reload caddy
```

Replace `house.yourdomain.com` with your real domain. Caddy will automatically obtain and renew a Let's Encrypt certificate on first request — visiting `https://house.yourdomain.com` should now load the app over HTTPS (required for the PWA/offline features to work on phones).

## 10. Create the first admin account

The repo ships with **no seeded users** in production — `npm run seed` is for local dev only and must never be run here (it wipes and rebuilds the DB with fake demo data). Instead, bootstrap the one real admin account:

```sh
npm run create-admin -- "Your Full Name" you@example.com
```

This creates an active admin account with an unusable random password and prints (and emails, via the SMTP you just configured) a one-time sign-in link valid for 24 hours. Open that link in a browser — you'll be logged in as admin. From there, go to **Account → Change password** to set a real password (or just keep using magic-link sign-in going forward).

If you ever get locked out, re-run the same command with the same email — it reuses the existing account and issues a fresh sign-in link.

## 11. Verify

- Visit `https://house.yourdomain.com` — the app should load.
- Log in as the admin you just created.
- Send yourself a test notification (or check **Account → Email outbox**) to confirm SMTP delivery is working in production, the same way it was verified in dev.
- Invite family members: with the admin account, they can either register directly (accounts are active immediately — see the registration-flow commit) or you can send them a magic-link invite.

## 12. Backups

`scripts/backup.sh` already exists for this — schedule it on the droplet:

```sh
crontab -e
# add:
0 3 * * * sh /srv/brevardhouse/scripts/backup.sh >> /srv/brevardhouse/backup.log 2>&1
```

Back up `/srv/brevardhouse/backups/` off-box periodically (e.g. `scp`/`rsync` to your own machine, or sync to object storage) — a droplet-local backup doesn't protect against losing the droplet itself.

## Redeploying after changes

```sh
cd /srv/brevardhouse
git pull
npm ci
npm ci --prefix web
npm run build
sudo systemctl restart brevardhouse
```

The SQLite DB and uploads live in `server/data/` (gitignored) and are untouched by `git pull` — only code changes.
