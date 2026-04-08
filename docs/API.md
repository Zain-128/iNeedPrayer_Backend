# iNeedPrayer Backend – Documentation

Express + MongoDB (Mongoose) API. TypeScript runs with [tsx](https://github.com/privatenumber/tsx).

---

## Setup

### Requirements

- Node.js 18+ recommended
- Yarn or npm
- MongoDB (local or [Atlas](https://www.mongodb.com/atlas))

### Install

```bash
yarn install
```

### Environment

Copy `.env.example` to `.env` and fill values:

| Variable         | Description                                      |
|------------------|--------------------------------------------------|
| `PORT`           | HTTP port (default `3004` if omitted)            |
| `MONGO_URI`      | MongoDB connection string                        |
| `JWT_SECRET`     | Secret for signing JWTs (use a long random value in production) |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `7d`, `24h` ([jsonwebtoken](https://github.com/auth0/node-jsonwebtoken)) |
| `PASSWORD_RESET_CODE` | Fixed code for **reset-password** (default `1234`). Not for production as-is. |

### Run locally

| Command       | Description                    |
|---------------|--------------------------------|
| `yarn dev`    | Dev server with file watch     |
| `yarn start`  | Production-style run (tsx)     |

Server listens on `http://localhost:<PORT>`.

---

## Base URL

- Local: `http://localhost:3004` (or your `PORT`)
- Production: your host (e.g. Render URL)

All JSON APIs expect `Content-Type: application/json` where a body is sent.

---

## Health

### GET /health

Liveness check (no database required for the route itself).

**Response** `200 OK`

```json
{
  "status": "ok"
}
```

---

## Test

### GET /api/test

Simple route to verify routing and deployment.

**Response** `200 OK`

```json
{
  "ok": true,
  "message": "test route"
}
```

---

## Auth

Base path: `/api/auth`.

### POST /api/auth/register

Create a user; returns user (without password) and JWT.

**Body**

| Field     | Type   | Required | Notes              |
|-----------|--------|----------|--------------------|
| `email`   | string | Yes      | Stored lowercase   |
| `password`| string | Yes      | Min 6 characters   |
| `name`    | string | Yes      | Trimmed            |

**Example**

```json
{
  "email": "user@example.com",
  "password": "secret123",
  "name": "John Doe"
}
```

**Success** `201 Created`

```json
{
  "user": {
    "_id": "...",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "..."
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors**

| Status | Typical message |
|--------|-----------------|
| 400    | Please provide email, password, and name |
| 409    | User already exists with this email |
| 500    | Registration failed / server error |

---

### POST /api/auth/login

**Body**

| Field      | Type   | Required |
|------------|--------|----------|
| `email`    | string | Yes      |
| `password` | string | Yes      |

**Success** `200 OK` — same `user` + `token` shape as register (without `updatedAt` in the mapped user object).

**Errors**

| Status | Typical message |
|--------|-----------------|
| 400    | Please provide email and password |
| 401    | Invalid email or password |
| 500    | Login failed / server error |

---

### POST /api/auth/social-login

Links or creates an account using a provider id + email from your mobile SDK (Google / Apple / Facebook / Twitter). The server does **not** verify the OAuth token; the app must obtain `email`, `name`, and stable `socialLoginId` from the provider first, then send them here.

**Body (JSON)**

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `email` | string | Yes | Normalised to lowercase |
| `name` | string | Yes | Display name |
| `socialLoginProvider` | string | Yes | One of: `google`, `apple`, `facebook`, `twitter` |
| `socialLoginId` | string | Yes | Stable id from the provider (subject / user id) |
| `profilePicture` | string | No | URL string; stored as `avatar` on **new** users only |

**Behaviour**

- **Existing user** (same `socialLoginProvider` + `socialLoginId`): logs in; `email` must match the stored email.
- **New user**: if `email` is not already registered, creates account with a random internal password and optional `avatar`.
- **Conflict**: if `email` is already taken by another account type, returns `409` (use password login or the same social provider).

**Success** `200 OK`

```json
{
  "message": "User login successfully",
  "user": {
    "_id": "...",
    "email": "user@example.com",
    "name": "Jane",
    "avatar": "https://...",
    "createdAt": "..."
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

`token` is the same value as `accessToken` (for clients that only read `token`). Use `accessToken` in `Authorization: Bearer ...` for protected routes.

**Errors**

| Status | Typical message |
|--------|-----------------|
| 400 | Please provide email, name, socialLoginProvider, and socialLoginId |
| 400 | socialLoginProvider must be one of: google, apple, facebook, twitter |
| 400 | Email does not match this social account |
| 409 | An account with this email already exists. Sign in with password or use the same social provider. |
| 500 | Social login failed |

---

### POST /api/auth/forgot-password

Placeholder flow (no email). Same response for every request so email existence is not revealed.

**Body**

| Field   | Type   | Required |
|---------|--------|----------|
| `email` | string | Yes      |

**Success** `200 OK`

```json
{
  "message": "If this email is registered, you can reset your password using the reset code."
}
```

Use **reset-password** with the fixed code from the server (default `1234`, overridable via `PASSWORD_RESET_CODE`).

---

### POST /api/auth/reset-password

Set a new password using registered **email** + fixed **code** (default `1234`). No email is sent.

**Body**

| Field      | Type   | Required | Notes |
|------------|--------|----------|-------|
| `email`    | string | Yes      | Account email |
| `code`     | string / number | Yes | Must match `PASSWORD_RESET_CODE` (default `1234`) |
| `password` | string | Yes      | New password, min 6 characters |

**Success** `200 OK`

```json
{
  "message": "Password has been reset"
}
```

**Errors**

| Status | Typical message |
|--------|-----------------|
| 400    | Please provide email, code, and password |
| 400    | Password must be at least 6 characters |
| 400    | Invalid email or reset code |
| 500    | Password reset failed |

---

### GET /api/auth/me

Current user; requires JWT.

**Headers**

| Header            | Value              |
|-------------------|--------------------|
| `Authorization`   | `Bearer <token>`   |

**Example**

```bash
curl -s -H "Authorization: Bearer YOUR_JWT_TOKEN" http://localhost:3004/api/auth/me
```

**Success** `200 OK`

```json
{
  "user": {
    "_id": "...",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

(`updatedAt` appears when the full user document is returned from the database.)

**Errors**

| Status | Typical message |
|--------|-----------------|
| 401    | Not authorized; no token |
| 401    | Invalid or expired token |
| 401    | User no longer exists |
| 404    | User not found |
| 500    | Failed to get user |

---

## Posts

Base path: `/api/posts`. Post bodies are JSON (`Content-Type: application/json`).

Unless noted, **protected** routes require:

```http
Authorization: Bearer <accessToken or token>
```

**Optional auth** routes accept requests without a token; if a valid `Bearer` token is sent, the response can include viewer-specific fields (for example `isPrayedByMe` / `isPraisedByMe`, and blocked users are filtered when the viewer is known).

### GET /api/posts

List posts (newest first). **Optional auth.**

**Query parameters**

| Param | Type | Default | Notes |
|-------|------|---------|--------|
| `page` | number | `1` | Page index (≥ 1) |
| `limit` | number | `20` | Page size (clamped 1–50) |
| `q` | string | — | Search text (matches post text or posts by users whose name/email matches) |
| `groupId` | string | — | MongoDB ObjectId; filter posts in that group |
| `churchId` | string | — | MongoDB ObjectId; filter posts for that church |
| `authorId` | string | — | MongoDB ObjectId; only posts by that author (empty if viewer blocked them) |

**Success** `200 OK`

```json
{
  "posts": [
    {
      "id": "...",
      "author": {
        "id": "...",
        "name": "...",
        "avatar": "",
        "location": "City, State, Country"
      },
      "time": "2h ago",
      "text": "...",
      "image": "https://...",
      "mode": "prayer",
      "stats": {
        "prays": 0,
        "praises": 0,
        "comments": 0,
        "shares": 0
      },
      "isPrayedByMe": false,
      "isPraisedByMe": false
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 100
}
```

`mode` is `"prayer"` or `"praise"`. `image` is a URL string (often from `POST /api/upload/image` first).

---

### POST /api/posts

Create a post. **Protected.**

**Body**

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `text` | string | No | Body text (stored trimmed; can be empty if `image` is set) |
| `image` | string | No | Image URL |
| `mode` | string | No | `"prayer"` (default) or `"praise"` |
| `groupId` | string | No | If set, user must be a **member** of that group (`403` otherwise) |
| `churchId` | string | No | Associate post with a church |

**Success** `201 Created` — `{ "post": { ... } }` (same shape as items in `GET /api/posts`).

**Errors**

| Status | Typical message |
|--------|-----------------|
| 401 | Unauthorized |
| 403 | Not a member of this group |
| 500 | Server error |

---

### GET /api/posts/:id

Single post. **Optional auth** (blocked / reaction flags when logged in).

**Success** `200 OK` — `{ "post": { ... } }`

**Errors:** `400` invalid id · `404` Post not found (includes blocked author case)

---

### PATCH /api/posts/:id

Update own post. **Protected.** Author only.

**Body** (all optional)

| Field | Type | Notes |
|-------|------|--------|
| `text` | string | |
| `image` | string | URL |
| `mode` | string | `prayer` or `praise` |

**Success** `200 OK` — `{ "post": { ... } }`

**Errors:** `400` invalid id · `403` Not allowed · `404` Post not found

---

### DELETE /api/posts/:id

Delete own post (also removes reactions and comments for that post). **Protected.**

**Success** `200 OK`

```json
{ "message": "Deleted" }
```

**Errors:** `400` invalid id · `403` Not allowed · `404` Post not found

---

### POST /api/posts/:id/pray

Toggle “pray” reaction for the current user. **Protected.**

**Success** `200 OK`

```json
{ "active": true, "praysCount": 5 }
```

`active` is whether the reaction is now on after the toggle.

---

### POST /api/posts/:id/praise

Toggle “praise” reaction. **Protected.**

**Success** `200 OK`

```json
{ "active": true, "praisesCount": 3 }
```

---

### POST /api/posts/:id/share

Increment share count (no body). **Optional auth.**

**Success** `200 OK`

```json
{ "sharesCount": 12 }
```

---

### GET /api/posts/:id/pray-praise-users

Users who prayed or praised. **Optional auth.**

**Query**

| Param | Type | Default |
|-------|------|---------|
| `type` | `pray` or `praise` | `pray` |

**Success** `200 OK`

```json
{
  "users": [
    { "id": "...", "name": "...", "avatar": "", "type": "pray" }
  ]
}
```

---

### GET /api/posts/:id/comments

List comments (tree) for the post. **Optional auth.**

**Success** `200 OK` — `{ "comments": [ ... ] }` (nested `replies` where applicable)

---

### POST /api/posts/:id/comments

Add a comment. **Protected.**

**Body**

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `text` | string | Yes | Comment body |
| `parentCommentId` | string | No | For a reply, parent comment id |

**Success** `201 Created` — `{ "comments": [ ... ] }` (full tree for the post)

---

### POST /api/posts/:id/report

Report a post. **Protected.**

**Body**

| Field | Type | Required |
|-------|------|----------|
| `reasonKey` | string | Yes |
| `otherText` | string | No |

**Success** `200 OK` — `{ "message": "Report submitted" }`

---

## Using the token

1. Call **register**, **login**, or **social-login** and read `token` (or `accessToken` after social login) from the JSON body.
2. For protected routes, send:

   ```http
   Authorization: Bearer <token>
   ```

3. Expiry follows `JWT_EXPIRES_IN` / `JWT_ACCESS_EXPIRES_IN`. After expiry, sign in again (a dedicated refresh route may be added later; `refreshToken` is returned for future use).

---

## Deploy (Vercel)

Serverless Express via `api/index.ts` + `vercel.json`. See **[docs/VERCEL.md](./VERCEL.md)** for Root Directory, env vars, and limits (**Socket.IO is not supported** on Vercel; use REST-only or deploy `server.ts` elsewhere for chat).

## Deploy (Render)

- **Build command:** `yarn install` (or `npm install`)
- **Start command:** `yarn start` (or `npm start`) — do **not** use `node index.js`; the entry file is `server.ts` via `tsx`.
- Set the same env vars as `.env` in the service **Environment** tab (especially `MONGO_URI`, `JWT_SECRET`).
- In MongoDB Atlas, allow Render’s outbound IPs or `0.0.0.0/0` for testing, and ensure the DB user password in `MONGO_URI` is correct (URL-encode special characters in passwords).

---

## Quick test (curl)

```bash
# Register
curl -s -X POST http://localhost:3004/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"a@b.com","password":"secret12","name":"A"}'

# Login
curl -s -X POST http://localhost:3004/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"a@b.com","password":"secret12"}'

# Me (replace TOKEN)
curl -s http://localhost:3004/api/auth/me \
  -H "Authorization: Bearer TOKEN"

# Forgot password (informational only; code is fixed on server, default 1234)
curl -s -X POST http://localhost:3004/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"a@b.com"}'

# Reset password (code 1234 unless PASSWORD_RESET_CODE is set)
curl -s -X POST http://localhost:3004/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"email":"a@b.com","code":"1234","password":"newsecret12"}'

# Social login (replace SUB with provider’s stable user id)
curl -s -X POST http://localhost:3004/api/auth/social-login \
  -H "Content-Type: application/json" \
  -d '{"email":"social@example.com","name":"Social User","socialLoginProvider":"google","socialLoginId":"SUB","profilePicture":"https://example.com/pic.jpg"}'

# List posts (optional: -H "Authorization: Bearer TOKEN")
curl -s "http://localhost:3004/api/posts?page=1&limit=10"

# Create post (replace TOKEN)
curl -s -X POST http://localhost:3004/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"text":"Prayer request","mode":"prayer","image":""}'
```
