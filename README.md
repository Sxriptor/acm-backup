# ACM Hub

Simplified GitHub-style backup site for the `work` folder.

## Stack

- Next.js App Router
- Supabase email/password auth
- Supabase tables for profiles, repositories, and commit history
- Local `acm` CLI workspace package
- Cloudflare bucket seam ready through `ACM_BACKUP_BUCKET`

## Setup

1. Copy `.env.example` to `.env.local` and fill in the Supabase values.
2. Run the SQL in `supabase/migrations/20260707235500_initial_acmhub.sql`.
3. Start the app with `npm run dev`.
4. Create an account at `/signup`.
5. Open `/u/<username>` and click `Sync from work folder`.

## CLI

Install the local CLI into your shell:

```bash
npm link ./packages/acm-cli
```

Basic flow:

```bash
acm init .
acm remote add origin https://acmhub.netlify.app/sxriptor/unlimited-rod-holders.acm
acm add .
acm commit -m "first backup"
acm push origin main
```

The CLI reads these env vars before push:

- `ACM_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
- `ACM_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `ACM_EMAIL`
- `ACM_PASSWORD`

## Local work scan

Generate a quick local manifest preview:

```bash
npm run sync:work
```
