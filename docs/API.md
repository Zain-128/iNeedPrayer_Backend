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

## Using the token

1. Call **register** or **login** and read `token` from the JSON body.
2. For protected routes, send:

   ```http
   Authorization: Bearer <token>
   ```

3. Expiry follows `JWT_EXPIRES_IN`. After expiry, call **login** again.

---

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
```
