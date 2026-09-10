# Auth API — Frontend Integration Guide

Base path: **`/api/auth`**

Local base URL: `http://localhost:3004`

---

## Screens → APIs

| Screen / Flow | API |
|---------------|-----|
| `RegisterScreen` → submit | `POST /api/auth/register` |
| `LoginScreen` → submit | `POST /api/auth/login` |
| Google / Apple sign-in | `POST /api/auth/social-login` |
| `ForgotPasswordScreen` | `POST /api/auth/forgot-password` |
| `ResetPasswordScreen` | `POST /api/auth/reset-password` |
| App launch / token refresh | `GET /api/auth/me` |
| `SettingsScreen` → Delete Account | `POST /api/auth/delete-account` |

---

## POST /api/auth/register

**Body**

```json
{
  "email": "user@example.com",
  "password": "mypassword123",
  "name": "Zain Raza"
}
```

**Response** `201`

```json
{
  "user": {
    "_id": "665f...",
    "email": "user@example.com",
    "name": "Zain Raza",
    "createdAt": "2026-01-15T08:30:00.000Z"
  },
  "token": "eyJhbGci..."
}
```

**Errors:** `400` missing fields · `409` email already exists

---

## POST /api/auth/login

**Body**

```json
{
  "email": "user@example.com",
  "password": "mypassword123"
}
```

**Response** `200` — same shape as register (`user` + `token`).

**Errors:** `400` missing fields · `401` invalid credentials · `403` account blocked (`code: "ACCOUNT_BLOCKED"`)

---

## POST /api/auth/social-login

Used after Google / Apple / Facebook / Twitter SDK gives you `email`, `name`, `socialLoginId`.

**Body**

```json
{
  "email": "user@gmail.com",
  "name": "Zain Raza",
  "socialLoginProvider": "google",
  "socialLoginId": "110248495931234567890",
  "profilePicture": "https://lh3.googleusercontent.com/..."
}
```

`profilePicture` is optional (used as `avatar` for new accounts).

**Response** `200`

```json
{
  "message": "User login successfully",
  "user": {
    "_id": "665f...",
    "email": "user@gmail.com",
    "name": "Zain Raza",
    "avatar": "https://lh3.googleusercontent.com/...",
    "createdAt": "2026-01-15T08:30:00.000Z"
  },
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "token": "eyJhbGci..."
}
```

`token` = `accessToken` (for clients that only read `token`). Use `accessToken` in `Authorization: Bearer ...` header.

**Errors:** `400` missing fields or invalid provider · `409` email taken by password account

Providers: `google`, `apple`, `facebook`, `twitter`

---

## POST /api/auth/forgot-password

Sends nothing — just acknowledges the request.

**Body**

```json
{
  "email": "user@example.com"
}
```

**Response** `200`

```json
{
  "message": "If this email is registered, you can reset your password using the reset code."
}
```

Always returns 200 (no email enumeration).

---

## POST /api/auth/reset-password

**Body**

```json
{
  "email": "user@example.com",
  "code": "1234",
  "password": "newpassword123"
}
```

`code` is the reset code (default `1234` in dev).

**Response** `200`

```json
{
  "message": "Password has been reset"
}
```

**Errors:** `400` invalid email/code or short password

---

## GET /api/auth/me

Returns the authenticated user's profile.

**Headers**

```http
Authorization: Bearer <token>
```

**Response** `200`

```json
{
  "user": {
    "_id": "665f...",
    "email": "user@example.com",
    "name": "Zain Raza",
    "avatar": "https://...",
    "coverImage": "",
    "bio": "Prayer warrior",
    "preferredLanguage": "en",
    "city": "Lahore",
    "state": "Punjab",
    "country": "Pakistan",
    "followersCount": 120,
    "followingCount": 45,
    "postsCount": 12,
    "role": "user",
    "status": "active",
    "createdAt": "2026-01-15T08:30:00.000Z",
    "updatedAt": "2026-09-01T10:00:00.000Z"
  }
}
```

**Errors:** `401` not authenticated · `403` blocked · `404` user not found

---

## POST /api/auth/delete-account

Soft-deletes the authenticated user's account. Sets `deletedAt` timestamp and changes `status` to `"inactive"`. The account can no longer log in, appear in searches, or be invited to groups.

**Headers**

```http
Authorization: Bearer <token>
```

**Body** — none required

**Response** `200`

```json
{
  "message": "Account deleted successfully"
}
```

**Errors:** `401` not authenticated · `400` account already deleted

After this call, clear local tokens and navigate to the login/register screen.
