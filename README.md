![Archive Cloud cover](./public/og.png)

# Archive Cloud

Archive Cloud is a multi-cloud storage gateway web app. Connect Google Drive, Dropbox, OneDrive, pCloud, Google Photos, Google Shared Drive, and iCloud into one virtual storage dashboard. Users can register with email/password or Google, connect cloud accounts, track combined quota, upload files through the backend into a dedicated `archive cloud` folder on each provider, organize files with virtual folders, preview and share files, sync the app database from connected storage, and route uploads to the account with enough free space.

## License

Copyright 2026 Archive Cloud contributors

Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE) for details.

## Features

- Multi-cloud storage gateway in one dashboard: Google Drive, Dropbox, OneDrive, pCloud, Google Photos, Google Shared Drive, and iCloud.
- Direct upload stream to connected cloud storage. Files are not stored on the server.
- Provider uploads are stored under a root `archivecloud` folder (or provider equivalent).
- Upload routing policies: most-available, round-robin, and priority-order modes.
- Cross-cloud move and copy transfers between connected accounts.
- Resumable uploads for large files.
- External API using API keys at `GET /api/v1/accounts` and `GET|POST /api/v1/transfers`.
- API key management with one-time secret display, hashed key storage, last-used tracking, and revocation.
- Email/password auth (with email OTP verification) plus Google sign-in/register.
- Password reset via email OTP (Resend).
- Multi-account storage quota summary and Quota Tracker page.
- Manual sync from the provider `archivecloud` folder back into PostgreSQL.
- Virtual folders, tags, and cross-cloud search.
- File preview, download, rename, move, share, invite, and delete actions.
- Public shared file links with preview and download.
- Bottom-right upload progress panel.
- Session cookie authentication (Better Auth).
- Global Google OAuth config stored encrypted in the database (seed command or Settings UI).
- Scheduled automation, folder sync, and real-time provider webhooks (Thunder plan).
- Optional Polar checkout for Thunder lifetime access ($9).
- Self-hosting with instance admin unlock and billing controls via environment variables.
- PostgreSQL database with Prisma migrations.
- Next.js 16 full-stack app (App Router + Route Handlers) with React 19 and TypeScript.

## Preview

- Repository: https://github.com/i-mkarmakar/archivecloud

## Project Structure

Single full-stack Next.js app at the repo root:

```
src/app/          Next.js App Router pages and API Route Handlers
src/views/        Page view components
src/server/       API handlers, provider services, config, scripts
src/components/   UI components
src/layouts/      App shell layouts
src/lib/          Client and shared utilities
prisma/           PostgreSQL schema and migrations
public/           Static assets
scripts/          Docker entrypoint and helper scripts
Dockerfile        Production image
docker-compose.prod.yml  Production / self-host stack (app + Postgres)
docker-compose.dev.yml   Local Postgres for `pnpm dev`
.dockerignore
.env.example      Starter env for self-hosting
```

## Requirements

- Node.js 20+ (or Docker / Docker Compose for containerized self-host)
- pnpm (when running outside Docker)
- PostgreSQL 18+
- Google Cloud project with Google Drive API enabled (for Google Drive connect and Google sign-in)
- Optional: Dropbox, Microsoft Azure (OneDrive), pCloud, and Resend credentials for those providers and email OTP

## 1. Quick Setup (Recommended)

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/i-mkarmakar/archivecloud.git
   cd archivecloud
   pnpm install
   ```

2. Create `.env` in the project root (see [Environment setup](#2-environment-setup) below).

3. For **your admin account** (full Thunder access, no payment):

   ```env
   ADMIN_EMAIL=you@example.com
   ADMIN_NAME=Your Name
   BILLING_ENABLED=false
   ```

4. Run migrations and start the app:

   ```bash
   pnpm prisma:migrate
   pnpm dev
   ```

5. Open http://localhost:9050 and sign up or sign in with the **exact email** listed in `ADMIN_EMAIL`.

Google Client ID/Secret can be added later; Google connect and Google sign-in stay unavailable until configured.

## 2. Environment Setup

Create `.env` in the project root:

```env
# Database (pooled URL OK at runtime, e.g. Neon pooler)
DATABASE_URL="postgresql://user:password@localhost:5432/archivecloud"
# Optional: direct URL for `pnpm prisma:migrate` on pooled hosts
# DIRECT_DATABASE_URL="postgresql://user:password@localhost:5432/archivecloud"
# Optional: shadow DB for `prisma migrate dev`
# SHADOW_DATABASE_URL="postgresql://user:password@localhost:5432/archivecloud_shadow"

PORT=9050
NEXT_PUBLIC_APP_URL="http://localhost:9050"
SITE_URL="http://localhost:9050"
BETTER_AUTH_URL="http://localhost:9050"
BETTER_AUTH_SECRET="change-this-better-auth-secret-at-least-32-chars"
TOKEN_ENCRYPTION_KEY="change-this-encryption-key-32bytes-min!"
MAX_UPLOAD_BYTES=5368709120

# Google Drive connect + Google sign-in (encrypted into DB via seed script)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="http://localhost:9050/connected-accounts/google/callback"
GOOGLE_PHOTOS_REDIRECT_URI="http://localhost:9050/connected-accounts/google-photos/callback"
GOOGLE_SHARED_DRIVE_REDIRECT_URI="http://localhost:9050/connected-accounts/google-shared-drive/callback"

# Optional providers
DROPBOX_CLIENT_ID=""
DROPBOX_CLIENT_SECRET=""
DROPBOX_REDIRECT_URI="http://localhost:9050/connected-accounts/dropbox/callback"

ONEDRIVE_CLIENT_ID=""
ONEDRIVE_CLIENT_SECRET=""
ONEDRIVE_REDIRECT_URI="http://localhost:9050/connected-accounts/onedrive/callback"

PCLOUD_CLIENT_ID=""
PCLOUD_CLIENT_SECRET=""
PCLOUD_REDIRECT_URI="http://localhost:9050/connected-accounts/pcloud/callback"

# Email OTP (sign-up verification, password reset)
RESEND_API_KEY=""
RESEND_FROM_EMAIL="Archive Cloud <onboarding@resend.dev>"

# Optional cron for scheduled transfers, folder sync, webhook renewals
# CRON_SECRET="your-cron-secret-min-16-chars"

# Optional HTTPS public URL for provider webhooks (Google Drive watches require HTTPS)
# WEBHOOK_BASE_URL="https://your-domain.com"

# Self-hosting: instance admin + billing
ADMIN_EMAIL=""
ADMIN_NAME=""
BILLING_ENABLED=false
# DEFAULT_USER_PLAN=free

# Optional Polar billing (cloud / paid upgrades)
# POLAR_ACCESS_TOKEN=""
# POLAR_WEBHOOK_SECRET=""
# POLAR_SERVER=sandbox
# POLAR_PRODUCT_THUNDER_LIFETIME=""
```

**Important:**

- `BETTER_AUTH_SECRET` and `TOKEN_ENCRYPTION_KEY` must be long and random (32+ characters).
- Do not commit `.env`.
- Google OAuth credentials are used by the seed script, then stored encrypted in the database.
- API calls from the browser use same-origin paths (`/files`, `/uploads`, etc.) with session cookies; no separate `NEXT_PUBLIC_API_URL` is required.

## 3. Run Prisma Migrations

```bash
pnpm prisma:migrate
```

If Prisma client generation is blocked on Windows by a running Node process, stop the dev server and run:

```bash
pnpm prisma:generate
```

For production deploys (does not reset the database):

```bash
pnpm db:migrate:deploy
```

## 4. Google Cloud Setup

Google setup is done in **Google Cloud Console**, not Google Search Console.

Open: https://console.cloud.google.com/

### 4.1 Create or Select Project

Create a new project or select an existing one. OAuth client and Drive API must be in the same project.

### 4.2 Enable Google Drive API

Go to **APIs & Services → Library**, search **Google Drive API**, and click **Enable**.

Direct URL pattern:

```
https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=YOUR_PROJECT_ID
```

### 4.3 Configure OAuth Consent Screen

Go to **APIs & Services → OAuth consent screen**.

- App type: **External**
- Fill required fields (app name, support email, developer contact)
- Add scopes:
  - `https://www.googleapis.com/auth/drive`
  - `https://www.googleapis.com/auth/userinfo.email`
  - `https://www.googleapis.com/auth/userinfo.profile`

If publishing status is **Testing**, add test users under **Test users**. Without test users, Google may show `Access blocked: app has not completed the Google verification process`.

### 4.4 Create OAuth Client

Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.

- Application type: **Web application**
- Authorized JavaScript origins: `http://localhost:9050`
- Authorized redirect URIs:
  - `http://localhost:9050/connected-accounts/google/callback` (Drive connect)
  - `http://localhost:9050/api/auth/callback/google` (Google sign-in via Better Auth)

Copy the Client ID and Client Secret.

### 4.5 Seed Google OAuth Config

Put values into `.env`:

```env
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:9050/connected-accounts/google/callback"
```

Then run:

```bash
pnpm seed:google-config
```

This stores the Google OAuth config as global encrypted provider config in PostgreSQL. Google sign-in and **Connect Drive** in Settings use the same credentials.

## 5. Run Development Server

```bash
pnpm dev
```

App runs at: http://localhost:9050

Production:

```bash
pnpm build
pnpm start
```

## 6. Production Deployment (VPS)

### Option A — Docker Compose (recommended self-host)

Same flow as [Typebot’s Docker self-host](https://docs.typebot.io/self-hosting/deploy/docker): compose file + `.env`, then `up -d`.

#### Requirements

Docker and Docker Compose on your server ([install docs](https://docs.docker.com/engine/install/)).

#### 1. Get the files

```bash
git clone https://github.com/i-mkarmakar/archivecloud.git
cd archivecloud
cp .env.example .env
```

#### 2. Add the required configuration

1. Generate secrets (32+ characters each):

   ```bash
   openssl rand -base64 32 | tr -d '\n' ; echo
   ```

2. Fill `.env`:
   - Set `BETTER_AUTH_SECRET` and `TOKEN_ENCRYPTION_KEY`
   - Set `ADMIN_EMAIL` and `BILLING_ENABLED=false` for private self-host
   - For the bundled Postgres service, keep:

     ```env
     DATABASE_URL=postgresql://postgres:archivecloud@archivecloud-db:5432/archivecloud
     ```

   - For an external DB (e.g. Neon), set your own `DATABASE_URL` (the local `archivecloud-db` service can stay unused, or remove it from compose)
   - Set public URLs to your domain for production:

     ```env
     NEXT_PUBLIC_APP_URL=https://your-domain.com
     SITE_URL=https://your-domain.com
     BETTER_AUTH_URL=https://your-domain.com
     GOOGLE_REDIRECT_URI=https://your-domain.com/connected-accounts/google/callback
     WEBHOOK_BASE_URL=https://your-domain.com
     ```

#### 3. Start the server

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

This will:

- Create a Postgres database
- Run Prisma migrations on container start
- Start Archive Cloud on port **9050**

Open `http://your-server:9050` and sign in with the admin email from `ADMIN_EMAIL`.

Archive Cloud does not terminate SSL. Put HTTPS in front (Nginx, Caddy, Traefik, Cloudflare, Coolify).

#### Update

```bash
git pull
docker compose -f docker-compose.prod.yml up --build -d
```

#### Local Postgres only (for `pnpm dev`)

```bash
docker compose -f docker-compose.dev.yml up -d
```

Then point `.env` `DATABASE_URL` at `localhost:5432` and run `pnpm dev`.

### Option B — Node on the host

1. Install Node.js 20+, pnpm, and PostgreSQL 18+ on your server.
2. Clone the repository and create `.env` with production URLs:

   ```env
   NEXT_PUBLIC_APP_URL="https://your-domain.com"
   SITE_URL="https://your-domain.com"
   BETTER_AUTH_URL="https://your-domain.com"
   GOOGLE_REDIRECT_URI="https://your-domain.com/connected-accounts/google/callback"
   WEBHOOK_BASE_URL="https://your-domain.com"
   ```

3. Run migrations and build:

   ```bash
   pnpm install
   pnpm db:migrate:deploy
   pnpm build
   pnpm start
   ```

4. Put the app behind HTTPS (reverse proxy such as Nginx or Caddy).
5. Update Google OAuth authorized origins and redirect URIs for your production domain.
6. Seed Google config if not already in the database:

   ```bash
   pnpm seed:google-config
   ```

7. Optional: schedule `GET|POST /cron/tick` with `Authorization: Bearer <CRON_SECRET>` for scheduled transfers, folder sync polling, and webhook renewals.

**Production notes:**

- Replace all `localhost` redirect URIs with production URLs.
- Use strong `BETTER_AUTH_SECRET` and `TOKEN_ENCRYPTION_KEY`.
- Do not expose PostgreSQL publicly.
- Set `BILLING_ENABLED=false` on private self-hosted instances unless you want Polar checkout.

## 7. Manual Test Flow

1. Open http://localhost:9050
2. Register with email/password (check inbox for OTP) or sign in with Google.
3. Open **Settings → Accounts** and connect Google Drive (or another provider).
4. Open **Quota Tracker** and confirm quota appears.
5. Open **All Files**, create nested virtual folders, and upload a file.
6. Confirm the file appears under the provider's `archivecloud` folder.
7. Add or remove a file manually in the provider folder, then click **Sync Drive** in All Files.
8. Watch the bottom-right upload progress panel.
9. Right-click a file for preview, download, rename, move, share, invite, and delete.
10. Open **Shared** and test shared links and invites.

## API Overview

Auth is handled by Better Auth at `/api/auth/*` (custom sign-in/sign-up UI).

**Connected accounts:**

- `GET /connected-accounts/google/connect-url`
- `GET /connected-accounts/google/callback`
- `GET /connected-accounts`
- `POST /connected-accounts/:id/sync-quota`
- `DELETE /connected-accounts/:id`
- Similar routes for Dropbox, OneDrive, pCloud, Google Photos, and Google Shared Drive

**Storage:**

- `GET /storage/summary`
- `GET /storage/breakdown`
- `GET /storage/routing-policy`
- `PATCH /storage/routing-policy`

**Folders:**

- `GET /folders?parentId=<id>`
- `GET /folders?all=1`
- `GET /folders/recent?limit=4`
- `POST /folders`
- `PATCH /folders/:id`
- `DELETE /folders/:id`

**Files:**

- `GET /files`, `GET /files?folderId=<id>`, `GET /files?q=<search>`
- `PATCH /files/:id`, `PATCH /files/batch`, `DELETE /files/batch`
- `POST /files/sync-google`
- `POST /files/:id/share`, `DELETE /files/:id/share`
- `POST /files/:id/preview-token`
- `GET /files/:id/download`, `DELETE /files/:id`
- `GET /files/preview/:token`

**Uploads:**

- `POST /uploads` — multipart/form-data; send `filesMeta` JSON first, then file fields
- `POST /uploads/resumable/init`
- `GET /uploads/resumable/status/:id`
- `PUT /uploads/resumable/chunk/:id`

**API keys (session auth):**

- `GET|POST /api-keys`, `DELETE /api-keys/:id`

**External API (Bearer `ack_…` API key or session):**

- `GET /api/v1/accounts`
- `GET|POST /api/v1/transfers`

**Billing:**

- `GET /billing`
- `POST /billing` (checkout; blocked when `BILLING_ENABLED=false`)

**Cron / webhooks (public with secret or provider validation):**

- `GET|POST /cron/tick` — `Authorization: Bearer <CRON_SECRET>`
- `POST /webhooks/google-drive`
- `GET|POST /webhooks/onedrive`
- `GET|POST /webhooks/dropbox`

## Security Notes

- Backend never stores uploaded files on disk; uploads stream through the backend to connected cloud storage.
- OAuth tokens are encrypted in PostgreSQL.
- Share and preview tokens are stored as hashes.
- `.env` is ignored by git.
- Do not expose `TOKEN_ENCRYPTION_KEY`, `BETTER_AUTH_SECRET`, OAuth client secrets, or raw share/preview tokens.
- Put the app behind HTTPS in production.

## Self-hosting

Interested in self-hosting Archive Cloud on your server? See [Production Deployment](#6-production-deployment-vps) (Docker Compose recommended).

Archive Cloud can run on your own server (self-hosted) or as a managed cloud deployment with Polar checkout. Self-hosted instances use environment variables to control plans — similar to [Typebot self-hosting](https://docs.typebot.io/self-hosting/configuration).

### Self-host vs cloud

| | Self-hosted | Official cloud |
|--|-------------|----------------|
| Hosting | You manage server, DB, backups | Managed service |
| Billing | Optional (`BILLING_ENABLED=false`) | Polar checkout ($9 Thunder lifetime) |
| Admin unlock | `ADMIN_EMAIL` → Thunder, all features | N/A |
| Default plan for new users | `DEFAULT_USER_PLAN` | Free until checkout |

### Instance admin

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_EMAIL` | No | Comma-separated emails that always get **Thunder** with all features and unlimited bandwidth. Bypasses stored plan at runtime. Example: `you@example.com,ops@example.com` |
| `ADMIN_NAME` | No | Display name applied to the admin account on signup |

Sign up or sign in with an email that matches `ADMIN_EMAIL` exactly (comparison is case-insensitive).

### Default plan for new users

| Variable | Default | Description |
|----------|---------|-------------|
| `DEFAULT_USER_PLAN` | `free` | Plan stored when a **non-admin** user signs up. Values: `free` or `thunder` (Thunder). |

Use `DEFAULT_USER_PLAN=thunder` if everyone on your private instance should get Thunder without Polar checkout.

### Billing / checkout

| Variable | Default | Description |
|----------|---------|-------------|
| `BILLING_ENABLED` | `true` if Polar is configured, else `false` | When `false`, upgrade UI is hidden and `POST /billing` checkout is blocked. |
| `POLAR_ACCESS_TOKEN` | — | Enables Polar checkout when `BILLING_ENABLED` is true |
| `POLAR_WEBHOOK_SECRET` | — | Polar webhook signing secret |
| `POLAR_SERVER` | `sandbox` | `sandbox` or `production` |
| `POLAR_PRODUCT_THUNDER_LIFETIME` | — | Polar product UUID for Thunder ($9 lifetime) |

**Recommended self-host `.env` snippet:**

```env
ADMIN_EMAIL=you@example.com
ADMIN_NAME=Your Name
BILLING_ENABLED=false

# Optional: give every new signup Thunder on this server
# DEFAULT_USER_PLAN=thunder
```

**Recommended cloud `.env` snippet:**

```env
BILLING_ENABLED=true
POLAR_ACCESS_TOKEN=...
POLAR_WEBHOOK_SECRET=...
POLAR_PRODUCT_THUNDER_LIFETIME=...
POLAR_SERVER=sandbox
```

### How plan resolution works

1. If user email is in `ADMIN_EMAIL` → effective plan is **Thunder** (`thunder`).
2. Else use `users.plan_id` from the database (set on signup from `DEFAULT_USER_PLAN` or Polar webhooks).
3. Frontend reads `GET /billing` → `{ planId, isAdmin, billingEnabled, ... }`.

### Thunder features (gated on Free)

- Scheduled automation
- Folder sync
- Real-time sync (provider webhooks)
- Smart file distribution / upload routing
- Unlimited monthly transfer bandwidth (Free: 50 GB/month)

## Self-Hosting Troubleshoot

### Still on Free plan or features locked

1. Check `ADMIN_EMAIL` in `.env` matches the email you sign in with (case-insensitive).
2. Restart the app after changing `.env` (`docker compose -f docker-compose.prod.yml up -d --force-recreate` if using Docker).
3. Sign out and sign in again so the session refreshes.
4. In browser devtools → Network → `GET /billing` should return:

   ```json
   { "planId": "thunder", "isAdmin": true }
   ```

5. If you signed up **before** setting `ADMIN_EMAIL`, runtime bypass still works for admin email. To fix the DB row:

   ```sql
   UPDATE users SET plan_id = 'thunder' WHERE email = 'you@example.com';
   ```

### Upgrade button still shows on self-host

Set `BILLING_ENABLED=false` and restart. Upgrade UI only appears when billing is enabled and the user is on Free.

### Everyone should have Thunder on my private server

```env
DEFAULT_USER_PLAN=thunder
```

Restart, then create **new** accounts. Existing users keep their stored plan unless you update the database or they are in `ADMIN_EMAIL`.

### Polar / checkout errors on self-host

If you do not need paid upgrades:

```env
BILLING_ENABLED=false
```

Omit `POLAR_*` vars unless you want optional checkout.

### Admin downgraded after Polar webhook

Admin accounts are protected from downgrade in subscription sync when `ADMIN_EMAIL` matches. Verify the email in `.env` matches the signed-in user.

### Bandwidth still capped

Thunder and admin accounts should show unlimited bandwidth. Confirm `/billing` returns `planId: "thunder"` and transfer usage shows no monthly cap.

## Build & Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Next.js development server |
| `pnpm build` | Prisma generate + production build |
| `pnpm start` | Run production server |
| `pnpm prisma:migrate` | Run Prisma dev migration |
| `pnpm db:migrate:deploy` | Apply migrations in production |
| `pnpm prisma:studio` | Open Prisma Studio |
| `pnpm seed:google-config` | Store encrypted Google OAuth config in DB |
| `pnpm biome:check` | Format + lint check |
| `pnpm check-types` | TypeScript check |
| `docker compose -f docker-compose.prod.yml up --build -d` | Production / self-host stack (app + Postgres) |
| `docker compose -f docker-compose.dev.yml up -d` | Local Postgres only for `pnpm dev` |
| `docker compose -f docker-compose.prod.yml down` | Stop production / self-host stack |
