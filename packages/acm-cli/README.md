# ACM CLI

`acm` is the command line tool for ACM Hub.

## Install

```bash
npm install -g @sxriptor/acm
```

## Commands

```bash
acm login
acm logout
acm storage
acm init .
acm remote add origin https://acmhub.netlify.app/sxriptor/unlimited-rod-holders.acm
acm add .
acm commit -m "backup snapshot"
acm push origin main
```

## Notes

- `acm login` authorizes through the ACM website and stores a local app token.
- `acm storage` shows account and repository storage usage.
- `acm push` sends commit metadata to ACM Hub.

## Environment

Optional environment variables:

- `ACM_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
