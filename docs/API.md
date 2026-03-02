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
    "createdAt": "...",
    "updatedAt": "..."
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors**

| Status | Message                |
|--------|------------------------|
| 400    | Please provide email and password |
| 401    | Invalid email or password         |
| 500    | Login failed                      |

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
