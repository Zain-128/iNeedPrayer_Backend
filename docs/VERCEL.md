# Deploy on Vercel

This backend can run on **Vercel** as a **serverless Express** app. Realtime **Socket.IO chat does not run on Vercel** (stateless functions); use **Render / Railway / Fly.io / a VPS** with `yarn start` if you need WebSockets, or a hosted pub/sub (Ably, Pusher) later.

## Prerequisites

- GitHub/GitLab/Bitbucket repo connected to Vercel (or Vercel CLI).
- **MongoDB Atlas** (or other) — set `MONGO_URI` in Vercel **Environment Variables**.
- **JWT_SECRET** (and other secrets from `.env.example`).

## Project settings (Vercel dashboard)

| Setting | Value |
|--------|--------|
| **Root Directory** | `iNeedPrayer_Backend` (if the repo root is the monorepo; if the repo is only the backend, leave default `.`) |
| **Framework Preset** | Other |
| **Build Command** | Leave empty / default (no separate build needed; Vercel bundles `api/index.ts`). |
| **Output Directory** | Leave empty |
| **Install Command** | `yarn install` (or `npm install`) |

**Node.js:** Set **20.x** (or 22.x) under Project → Settings → General → Node.js Version. Required for native deps (e.g. `sharp`).

## Environment variables

Add the same variables as `.env`, at minimum:

- `MONGO_URI`
- `JWT_SECRET`
- Optional: `ALLOWED_ORIGINS` (include your app origins and `https://your-project.vercel.app` if the web client calls the API from a browser).
- **Image uploads on Vercel:** Prefer **Backblaze B2** (`B2_*` in `.env.example`). Local `./uploads` is **not durable** on serverless (ephemeral disk).
- Optional: `PUBLIC_BASE_URL` or production API URL if your clients need absolute URLs.

## After deploy

- **Health:** `GET https://<your-deployment>.vercel.app/health`
- **API:** `https://<your-deployment>.vercel.app/api/auth/login`, etc.

## Limits to know

1. **Request body size** (serverless): ~**4.5 MB** on typical plans — very large raw uploads may fail before Sharp runs. Prefer smaller photos client-side or **direct-to-B2** uploads in a future iteration.
2. **Cold starts:** First request after idle can be slower.
3. **Socket.IO:** Not supported on this Vercel deployment; REST + MongoDB work.

## Local Vercel simulation

```bash
npm i -g vercel
cd iNeedPrayer_Backend
vercel login
vercel dev
```

`vercel dev` serves the same `api/index.ts` entry.

## Monorepo

If the repo root contains `frontend/` and `iNeedPrayer_Backend/`, create a Vercel project with **Root Directory** = `iNeedPrayer_Backend` so `vercel.json` and `api/` resolve correctly.
