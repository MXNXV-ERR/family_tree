# Infra / hardening

Free-tier (Spark) security setup. Nothing here requires a billing account.

## 1. Gemini key proxy (Cloudflare Worker — free)

**Problem:** `EXPO_PUBLIC_GEMINI_API_KEY` is compiled into the client bundle, so anyone
can extract it and spend against your Gemini quota/bill. A frontend-only app cannot hide a
key — it must call a server that holds the key. Cloudflare Workers' free tier (100k
req/day) is enough.

**Deploy:**

```bash
npm i -g wrangler            # Cloudflare CLI
wrangler login              # opens browser, free account
# from infra/:
wrangler deploy gemini-proxy-worker.js --name gemini-proxy --compatibility-date 2024-11-01
wrangler secret put GEMINI_KEY     # paste your Gemini API key when prompted
# optional: lock the proxy to your site origin
wrangler secret put ALLOW_ORIGIN   # e.g. https://family-tree-6a597.web.app
```

This prints a URL like `https://gemini-proxy.<you>.workers.dev`.

**Point the app at it, and REMOVE the key from the client:** in `mobile/.env`

```
# delete / comment this so it no longer ships in the bundle:
# EXPO_PUBLIC_GEMINI_API_KEY=...
EXPO_PUBLIC_GEMINI_PROXY_URL=https://gemini-proxy.<you>.workers.dev
```

`mobile/src/shared/gemini.ts` automatically uses the proxy when `EXPO_PUBLIC_GEMINI_PROXY_URL`
is set; with the key unset, it never reaches the client. Rebuild/redeploy the web app.

> Rotate the Gemini key after removing it from the client (the old one was exposed in every
> prior build).

## 2. Firebase App Check (free) — block non-app clients

App Check attests that requests come from *your* app, not a script using your public config.

1. Firebase console → **App Check** → register the **Web app** with **reCAPTCHA v3**; copy the
   site key.
2. Add to `mobile/.env`: `EXPO_PUBLIC_RECAPTCHA_SITE_KEY=<site key>`.
   `mobile/src/firebase/config.ts` initializes App Check on web when this is set.
3. Console → App Check → **Enforce** for Firestore (and Storage) once the app is sending tokens.
   (Native apps need Play Integrity / DeviceCheck providers + an EAS build — do that later.)

## 3. Firestore rules

Already tightened in repo-root `firestore.rules`:
- Tree docs are now readable only by members (`allow get: if isMember()`); invite-code
  lookup still works via the collection query.
- Join requests + events are owner/admin gated.

Deploy: `firebase deploy --only firestore:rules`

## 4. Budget alerts (free)

Google Cloud console → Billing → **Budgets & alerts** → create a $1 budget with email alerts,
so any unexpected spend (e.g. a leaked key before rotation) pings you immediately.

## Deferred (enable later)

- **Email verification** before sensitive reads (`request.auth.token.email_verified`).
- **Native App Check** providers (Play Integrity / DeviceCheck).
