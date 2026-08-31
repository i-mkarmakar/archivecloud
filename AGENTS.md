# AGENTS.md

## Project Overview

ArchiveCloud is a Google Drive storage gateway. It lets users sign up/sign in with email/password or Google, connect Google Drive accounts, track combined quota, upload files through the backend into a dedicated Google Drive `archivecloud` folder, organize files in virtual folders, preview/download/share files, sync app database file records from Google Drive, invite other users to files/folders, and route uploads to a connected Drive account with enough free space.

## Repository Structure

Single full-stack Next.js app at the repo root:

- `src/app/**`: Next.js App Router pages and API Route Handlers (`route.ts`).
- `src/views/**`: page view components (not `src/pages/` — avoids Next.js conflict).
- `src/server/handlers/**`: API handler logic (auth, files, uploads, etc.).
- `src/server/http/**`: shared Route Handler utilities (auth, responses, API key).
- `src/server/modules/**`: provider services (Google, S3), streaming helpers, config, scripts.
- `src/components/**`, `src/layouts/**`, `src/lib/**`, `src/context/**`: UI and client utilities.
- `prisma/`: PostgreSQL 18+ schema and migrations.
- `public/`: static assets.

## Requirements

- Node.js 20+
- pnpm
- PostgreSQL 18+
- Google Cloud project with Google Drive API enabled
- Google OAuth client ID and secret

## Stack

- Next.js 16 (App Router + Route Handlers) + React 19 + TypeScript + Tailwind CSS 4 + HeroUI v3 (`@heroui/react`, `@heroui/styles`)
- Prisma 7 + PostgreSQL 18 (`@prisma/adapter-pg`, generated client in `src/generated/prisma`)
- Zod, Better Auth, Busboy streaming uploads, Google APIs client, Undici

## Important Files

Server and API:
- `src/app/**/route.ts`: native Next.js Route Handlers (e.g. `/files`, `/uploads`).
- `src/server/handlers/**`: handler functions invoked by Route Handlers.
- `src/server/http/auth.ts`: Better Auth session auth (`requireAuthUser` reads session user id).
- `src/lib/auth.ts`: Better Auth server instance (`export const auth`).
- `src/lib/auth-client.ts`: Better Auth React client (`createAuthClient`).
- `src/lib/auth-user.ts`: UI helpers (`sessionUserToAuthUser`).
- `src/app/api/auth/[...all]/route.ts`: Better Auth API handler.
- `src/server/http/responses.ts`: `json`, `errorJson`, `handleRoute`.
- `src/server/config/env.ts`: environment validation (`APP_URL`, `PORT`, etc.).
- `prisma.config.ts`: database URL for Prisma CLI (migrations); uses `DIRECT_DATABASE_URL` when set.
- `src/server/config/prisma.ts`: Prisma client singleton (`server-only`, `PrismaPg` adapter).
- `src/server/modules/files/stream-google-file.ts`: Google file preview/download streaming.
- `src/server/scripts/seed-google-config.ts`: stores encrypted global Google OAuth config.
- `src/proxy.ts`: session cookie gate and public route list.

UI:
- `src/layouts/DriveLayout.tsx`: protected app shell, sidebar, header search, storage sidebar stats.
- `src/views/AllFilesPage.tsx`: core file/folder UI, uploads, context menus, preview, share/invite modals.
- `src/views/SharedPage.tsx`: shared links and invites UI.
- `src/views/QuotaTrackerPage.tsx`: connected-account quota UI.
- `src/views/SettingsPage.tsx`: Google account/settings UI.
- `src/views/SignInPage.tsx`, `src/views/SignUpPage.tsx`: custom sign-in/sign-up UI via Better Auth client.
- `src/views/GoogleAuthPage.tsx`: legacy redirect to `/signin`.
- `src/views/PublicFilePage.tsx`: public shared file viewer/embed page.
- `src/lib/api.ts`: API helper (`API_URL` is same-origin `''`), same-origin cookies, formatting utilities.
- `src/app/globals.css`: Tailwind import and global styles.

## Commands

From repo root:

- `pnpm dev`: start Next.js development server.
- `pnpm build`: Prisma generate + Next.js production build.
- `pnpm start`: run production Next.js server (`NODE_ENV=production` recommended).
- `pnpm prisma:migrate`: run Prisma dev migration.
- `pnpm prisma:studio`: open Prisma Studio.
- `pnpm db:push`: push schema without migration (dev only).
- `pnpm seed:google-config`: store encrypted Google OAuth config.
- `pnpm biome:check`: Biome format + lint check.
- `pnpm format` / `pnpm lint`: auto-fix format and lint.
- `pnpm check-format` / `pnpm check-lint` / `pnpm check-types`: pre-commit checks.

## Environment

Root `.env`:

- `DATABASE_URL` (PostgreSQL 18; pooled URL OK at runtime, e.g. Neon pooler)
- `DIRECT_DATABASE_URL` (optional; direct URL for `pnpm prisma:migrate` on pooled hosts)
- `SHADOW_DATABASE_URL` (optional; shadow DB for `prisma migrate dev`)
- `PORT` (default 3000)
- `BETTER_AUTH_URL` (auth base URL; defaults to `NEXT_PUBLIC_APP_URL`)
- `NEXT_PUBLIC_APP_URL` (public app URL for links, OAuth, client auth — same as freefallinterface)
- `SITE_URL` (alternate public URL, same as freefallinterface)
- `TOKEN_ENCRYPTION_KEY`
- `MAX_UPLOAD_BYTES`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (Drive connect + seed script)

API calls from the browser use same-origin paths (`/files`, `/uploads`, etc.) with Better Auth session cookies; no separate `NEXT_PUBLIC_API_URL` is required.

## Backend Conventions

- Put route handler logic under `src/server/handlers/<feature>.ts`.
- Add thin `src/app/**/route.ts` files that call handlers via `handleRoute` from `src/server/http/responses.ts`.
- Use `requireAuthUser` from `src/server/http/auth.ts` for authenticated routes.
- Validate request bodies/query params with Zod inside handlers.
- Use Prisma from `src/server/config/prisma.ts`.
- Return JSON errors with stable `code` and human-readable `message`.
- Convert `bigint` values to strings before sending JSON responses.
- Keep Google-specific OAuth/Drive behavior in `src/server/modules/google/`.
- Keep public-token routes unauthenticated; verify token hash, status, and expiry before streaming/returning data.
- Google Drive connect OAuth is separate from app login (`/connected-accounts/google/*` vs `/api/auth/callback/google`).
- Route Handlers that use Node APIs (uploads, streaming, Busboy) should export `runtime = 'nodejs'` and `dynamic = 'force-dynamic'`.

## Frontend Conventions

- Use `@/*` imports for files under `src`.
- Keep route registration in `src/app/**`.
- Use `apiFetch` for normal JSON API calls.
- Use raw `fetch` with `credentials: 'same-origin'` when response streaming/blob/progress requires it.
- Use `authClient.useSession()` for sign-in state in client components.
- Use `@heroui/react` components (`Button`, `Card`, `Input`, `Modal`, etc.) before adding new UI primitives. Import `@heroui/styles` in `src/app/globals.css`.
- Use `cn` from `src/lib/utils.ts` for conditional class names.
- Preserve current Tailwind visual style unless task explicitly asks redesign.
- Keep protected dashboard pages inside `ProtectedRoute` and `DriveLayout`.
- Keep file/folder URL state in query params when it affects navigation, e.g. `folderId` and file search `q`.

## Security Rules

- Never commit `.env` files or secrets.
- Never log OAuth client secrets, Better Auth secrets, encryption keys, or raw public share tokens.
- Google tokens are encrypted before database storage.
- Share and preview tokens are stored as hashes where applicable.
- Uploaded files must stream through backend to Google Drive folder `archivecloud`; do not store uploaded files on disk.
- Keep Better Auth session handling centralized; do not change without explicit reason.

## Database Rules

- Change DB schema through Prisma schema and migrations in `prisma/`.
- Do not hand-edit generated Prisma client files.
- After schema changes, run `pnpm prisma:migrate` and `pnpm build`.
- Add indexes for new common filters before relying on them in hot paths.
- Target PostgreSQL 18+.

## API Notes

General:
- `GET /health`
- Authenticated routes require a valid Better Auth session (cookie) unless listed as public. API keys use `Authorization: Bearer <apiKey>` on `/api/v1/*`.

Auth is handled by Better Auth (custom sign-in/sign-up UI). Users are stored in the local `users` table with Better Auth `auth_sessions` / `auth_accounts` tables.
- `POST /provider-configs/google`
- `GET /provider-configs`
- `DELETE /provider-configs/:id`

Google connected accounts:
- `GET /connected-accounts/google/connect-url`
- `GET /connected-accounts/google/connect`
- `GET /connected-accounts/google/callback`
- `GET /connected-accounts`
- `POST /connected-accounts/:id/sync-quota`
- `DELETE /connected-accounts/:id`

Storage:
- `GET /storage/summary`
- `GET /storage/breakdown`
- `GET /storage/routing-policy`
- `PATCH /storage/routing-policy`

Folders:
- `GET /folders?parentId=<id>`
- `GET /folders?all=1`
- `GET /folders/recent?limit=4`
- `POST /folders`
- `PATCH /folders/:id`
- `DELETE /folders/:id`

Files:
- `GET /files`
- `GET /files?folderId=<id>`
- `GET /files?q=<search>`
- `GET /files/shared-links`
- `GET /files/:id`
- `PATCH /files/:id`
- `PATCH /files/batch`
- `DELETE /files/batch`
- `POST /files/sync-google`
- `POST /files/:id/share`
- `DELETE /files/:id/share`
- `POST /files/:id/preview-token`
- `GET /files/:id/view-url`
- `GET /files/:id/download`
- `DELETE /files/:id`
- `GET /files/preview/:token`

Invites:
- `GET /invites`
- `POST /invites`
- `DELETE /invites/:id`

Public shared files:
- `GET /api/public/files/:token` (JSON metadata; page UI is `/public/files/:token`)
- `GET /public/files/:token/download`
- `GET /public/files/:token/preview`

Uploads:
- `POST /uploads`
- `POST /uploads/resumable/init`
- `GET /uploads/resumable/status/:id`
- `PUT /uploads/resumable/chunk/:id`
- Content type: `multipart/form-data`.
- Frontend sends metadata first as `filesMeta`: JSON array of `{ fieldName, fileName, mimeType, sizeBytes, folderId? }`.
- File fields then match `filesMeta[*].fieldName`, e.g. `file-0`, `file-1`.
- Backend selects a connected storage account with enough available quota and streams each file to Google Drive or S3.
- Google Drive uploads are placed under the root Drive folder named `archivecloud`; virtual folders remain app/database-only.
- `POST /files/sync-google` treats Google Drive folder `archivecloud` as source of truth for physical files.

External API:
- `POST /api/v1/uploads` (API key auth, scope `files:upload`)

## Verification

Before finishing code changes:
- `pnpm build`

Before finishing schema changes:
- `pnpm prisma:migrate`
- `pnpm build`

Manual smoke test:
- Sign up / sign in.
- Open Settings.
- Connect Google Drive.
- Verify connected account appears.
- Open Quota Tracker and sync quota.
- Create nested folders in All Files.
- Use header search for an uploaded file name.
- Upload one or more files and verify progress panel.
- Switch file list/grid view.
- Right-click file and test preview/download/rename/move/share/invite/delete where relevant.
- Open Shared page and verify shared links/invites.
- Open public file link and test preview/download.

## Agent Rules

- Prefer small, targeted changes.
- Preserve existing architecture and naming.
- Do not introduce new dependencies unless necessary.
- Do not commit secrets.
- Do not edit `node_modules`, build output, or `src/generated/prisma` (run `pnpm prisma:generate`).
- Do not change auth/token storage behavior without explicit reason.
- Do not change Google OAuth scopes or redirect behavior without checking env requirements.
- Do not change upload behavior to write files to disk.
