# iNeedPrayer Backend – API Documentation

Base URL: `http://localhost:3004` (or your `PORT` from `.env`)

---

## Health

### GET /health

Check if the server is running.

**Response** `200 OK`

```json
{
  "status": "ok"
}
```

---

## Auth

All auth endpoints are under `/api/auth`.

### Register

**POST** `/api/auth/register`

Create a new user. Returns user and JWT.

**Request body**

| Field    | Type   | Required | Description        |
|----------|--------|----------|--------------------|
| email    | string | Yes      | Unique, lowercase  |
| password | string | Yes      | Min 6 characters   |
| name     | string | Yes      | Display name       |

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
    "createdAt": "...",
    "updatedAt": "..."
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors**

| Status | Message                          |
|--------|----------------------------------|
| 400    | Please provide email, password, and name |
| 409    | User already exists with this email       |
| 500    | Registration failed                      |

---

### Login

**POST** `/api/auth/login`

Authenticate and get user + JWT.

**Request body**

| Field    | Type   | Required |
|----------|--------|----------|
| email    | string | Yes      |
| password | string | Yes      |

**Example**

```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

**Success** `200 OK`

```json
{
  "user": {
    "_id": "...",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "..."
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Errors**

| Status | Message                |
|--------|------------------------|
| 400    | Please provide email and password |
| 401    | Invalid email or password         |
| 500    | Login failed                      |

---

### POST /api/auth/social-login

Links or creates an account using a provider id + email from your mobile SDK (Google / Apple / Facebook / Twitter). The server does **not** verify the OAuth token; the app must obtain `email`, `name`, and stable `socialLoginId` from the provider first, then send them here.

**Body (JSON)**

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `email` | string | Yes | Normalised to lowercase |
| `name` | string | Yes | Display name |
| `socialLoginProvider` | string | Yes | One of: `google`, `apple`, `facebook`, `twitter`, `x` |
| `socialLoginId` | string | Yes | Stable id from the provider (subject / user id) |
| `profilePicture` | string | No | URL string; stored as `avatar` if avatar is empty |

**Success** `200 OK`

```json
{
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

---

### POST /api/auth/reset-password

Set a new password using registered **email** + fixed **code** (default `1234`).

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

---

### Get current user (protected)

**GET** `/api/auth/me`

Returns the authenticated user. Requires a valid JWT in the `Authorization` header.

**Headers**

| Header          | Value              |
|-----------------|--------------------|
| Authorization   | Bearer \<token\>   |

**Example**

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" http://localhost:3004/api/auth/me
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

**Errors**

| Status | Message                     |
|--------|-----------------------------|
| 401    | Not authorized; no token    |
| 401    | Invalid or expired token    |
| 401    | User no longer exists       |
| 404    | User not found              |
| 500    | Failed to get user          |

---

## Authentication

- **Register** or **Login** to get a `token`.
- Send the token in protected requests:
  ```
  Authorization: Bearer <token>
  ```
- Token expiry is set by `JWT_EXPIRES_IN` (default: `7d`). After expiry, use **Login** again to get a new token.
