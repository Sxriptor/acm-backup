# ACM Hub

Simplified GitHub-style backup site for the `work` folder.

## Stack

- Next.js App Router
- Supabase email/password auth
- Browser-approved CLI login with stored ACM tokens
- Supabase tables for profiles, repositories, commit history, storage quotas, and CLI device sessions
- Cloudflare bucket targeting metadata for `repos`, `releases`, and `LFA`

## Storage rules

- Max single file upload: 2 GB
- Files 300 MB and larger: route to `LFA`
- Max repo snapshot size: 5 GB
- Max account storage: 10 GB

## Setup

1. Copy `.env.example` to `.env.local` and fill in the Supabase values.
2. Run both SQL migrations in `supabase/migrations/`.
3. Start the app with `npm run dev`.
4. Create an account at `/signup`.
5. Open `/u/<username>` and click `Sync from work folder`.

## CLI

Install the local CLI into your shell:

```bash
npm link ./packages/acm-cli
```

Publish the CLI package to npm from the workspace root:

```bash
npm run publish:cli
```

Browser auth flow:

```bash
acm login
```

Basic repo flow:

```bash
acm init .
acm remote add origin https://acmhub.netlify.app/sxriptor/unlimited-rod-holders.acm
acm add .
acm commit -m "first backup"
acm push origin main
acm storage
acm help
```

## Local work scan

Generate a quick local manifest preview:

```bash
npm run sync:work
```
