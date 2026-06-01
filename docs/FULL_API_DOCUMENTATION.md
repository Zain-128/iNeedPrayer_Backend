# iNeedPrayer Backend — Full API Documentation

> **Single source of truth** for all REST + Socket.IO APIs.  
> Stack: **Express 5 · MongoDB · JWT · Socket.IO · Google Translate (posts)**

---

## Table of contents

1. [Setup & conventions](#1-setup--conventions)
2. [Environment variables](#2-environment-variables)
3. [Authentication](#3-authentication)
4. [Health & test](#4-health--test)
5. [Auth module](#5-auth-module-apiauth)
6. [Profile module](#6-profile-module-apiprofile)
7. [Users module (legacy)](#7-users-module-legacy-apiusers)
8. [Friends module](#8-friends-module-apifriends)
9. [Social module](#9-social-module-api)
10. [Posts module](#10-posts-module-apiposts)
11. [Comments module](#11-comments-module-apicomments)
12. [Upload module](#12-upload-module-apiupload)
13. [Churches module](#13-churches-module-apichurches)
14. [Groups module](#14-groups-module-apigroups)
15. [Chat / conversations](#15-chat--conversations-apiconversations)
16. [Socket.IO (realtime chat)](#16-socketio-realtime-chat)
17. [Notifications](#17-notifications-apinotifications)
18. [Payment methods](#18-payment-methods-apipayment-methods)
19. [Subscription](#19-subscription-apisubscription)
20. [Shared data shapes](#20-shared-data-shapes)
21. [Error reference](#21-error-reference)
22. [Frontend screen → API map](#22-frontend-screen--api-map)
23. [Deployment notes](#23-deployment-notes)

---

## 1. Setup & conventions

### Base URLs

| Environment | URL |
|-------------|-----|
| Local | `http://localhost:3004` |
| Production | Your deployed domain (Hostinger, etc.) |

### Headers

```http
Content-Type: application/json
Authorization: Bearer <JWT access token>
```

Multipart uploads: **omit** `Content-Type` (client sets boundary automatically).

### Auth legend

| Symbol | Meaning |
|--------|---------|
| 🌐 | Public — no token |
| 🔒 | Required — `Authorization: Bearer <token>` |
| 🔓 | Optional — token adds viewer-specific fields |

### IDs

All resource IDs are MongoDB ObjectIds (24-character hex string).

### Standard error body

```json
{ "message": "Human readable error" }
```

### Pagination defaults

- `page`: default `1`
- `limit`: default `20`, max `50` (posts), `100` (chat messages), `80` (notifications)

---

## 2. Environment variables

Copy `.env.example` → `.env`.

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | HTTP port (Hostinger sets automatically) |
| `MONGO_URI` | **Yes** | MongoDB Atlas connection string |
| `JWT_SECRET` | **Yes** | JWT signing secret |
| `JWT_EXPIRES_IN` | No | Default `7d` |
| `JWT_ACCESS_EXPIRES_IN` | No | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | No | Refresh token TTL |
| `JWT_REFRESH_SECRET` | No | Defaults to `JWT_SECRET` |
| `PASSWORD_RESET_CODE` | No | Dev reset code (default `1234`) |
| `CHURCH_VERIFY_CODE` | No | Dev church OTP (default `12345`) |
| `ALLOWED_ORIGINS` | No | CORS comma-list; omit = `*` |
| `PUBLIC_BASE_URL` | No | Absolute URL prefix for local uploads |
| `GOOGLE_TRANSLATE_API_KEY` | No* | Post auto-translation |
| `TRANSLATION_TARGET_LANGUAGES` | No | Default `es,fr,ar,hi,ur,pt` |
| `B2_S3_ENDPOINT` | No | Backblaze B2 uploads |
| `B2_REGION` | No | B2 region |
| `B2_KEY_ID` | No | B2 key ID |
| `B2_APPLICATION_KEY` | No | B2 secret |
| `B2_BUCKET` | No | B2 bucket name |
| `B2_PUBLIC_URL_BASE` | No | Public CDN/base URL for B2 files |

\*Without translate key, posts store original text only.

---

## 3. Authentication

### JWT usage

After login/register/social-login, store `token` (or `accessToken`) and send:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

Token payload includes `userId`. Expired/invalid token → `401`.

### Socket.IO auth

Same JWT via handshake:

```js
io("https://api.example.com", {
  auth: { token: "<JWT>" },
});
```

---

## 4. Health & test

### GET /health 🌐

**Response `200`**

```json
{ "status": "ok" }
```

---

### GET /api/test 🌐

**Response `200`**

```json
{ "ok": true, "message": "test route" }
```

---

### GET /api/test/ping 🌐

**Response `200`**

```json
{ "ok": true, "ping": "pong" }
```

---

## 5. Auth module — `/api/auth`

### POST /api/auth/register 🌐

Create account.

**Body**

| Field | Type | Required |
|-------|------|----------|
| `email` | string | Yes |
| `password` | string | Yes (min 6) |
| `name` | string | Yes |

```json
{
  "email": "user@example.com",
  "password": "secret123",
  "name": "John Doe"
}
```

**Success `201`**

```json
{
  "user": {
    "_id": "665f1a2b3c4d5e6f7a8b9c0d",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2026-06-01T12:00:00.000Z"
  },
  "token": "eyJ..."
}
```

**Errors:** `400` missing fields · `409` email exists · `500` server

---

### POST /api/auth/login 🌐

**Body:** `{ "email", "password" }`

**Success `200`:** Same `{ user, token }` as register.

**Errors:** `400` missing · `401` invalid credentials

---

### POST /api/auth/social-login 🌐

**Body**

| Field | Type | Required |
|-------|------|----------|
| `email` | string | Yes |
| `name` | string | Yes |
| `socialLoginProvider` | string | Yes — `google` \| `facebook` \| `apple` \| `twitter` |
| `socialLoginId` | string | Yes — Firebase/provider UID |
| `profilePicture` | string | No — saved as `avatar` on new users |

**Success `200`**

```json
{
  "message": "User login successfully",
  "user": {
    "_id": "...",
    "email": "user@gmail.com",
    "name": "John",
    "avatar": "https://...",
    "createdAt": "..."
  },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "token": "eyJ..."
}
```

**Errors:** `400` validation · `409` email taken by password account

---

### POST /api/auth/forgot-password 🌐

**Body:** `{ "email": "user@example.com" }`

**Success `200`**

```json
{
  "message": "If this email is registered, you can reset your password using the reset code."
}
```

> Dev stub — no email sent yet. Use `PASSWORD_RESET_CODE` from env.

---

### POST /api/auth/reset-password 🌐

**Body**

```json
{
  "email": "user@example.com",
  "code": "1234",
  "password": "newpassword123"
}
```

**Success `200`:** `{ "message": "Password has been reset" }`

**Errors:** `400` invalid email/code or short password

---

### GET /api/auth/me 🔒

Basic auth user (minimal fields).

**Success `200`:** `{ "user": { full Mongoose user document fields } }`

---

## 6. Profile module — `/api/profile`

Primary module for **INeedPrayer** profile screens.

### GET /api/profile/me 🔒

**Success `200`**

```json
{
  "profile": {
    "id": "665f...",
    "_id": "665f...",
    "name": "Martin Man",
    "email": "martin@example.com",
    "avatar": "https://cdn.../avatar.jpg",
    "coverImage": "https://cdn.../cover.jpg",
    "bio": "Prayer warrior",
    "preferredLanguage": "en",
    "city": "New York",
    "state": "NY",
    "country": "USA",
    "location": "New York, NY, USA",
    "followersCount": 3500,
    "followingCount": 180,
    "postsCount": 120,
    "followersLabel": "3.5k followers",
    "followingLabel": "180 following",
    "postsLabel": "120 posts",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

---

### PATCH /api/profile/me 🔒

Update profile. Password **not** here — use change-password.

**Body (all optional)**

```json
{
  "name": "Martin Man",
  "email": "new@example.com",
  "avatar": "https://...",
  "coverImage": "https://...",
  "bio": "About me text",
  "preferredLanguage": "ur",
  "city": "New York",
  "state": "NY",
  "country": "USA"
}
```

**Success `200`:** `{ "profile": { ... } }`

**Errors:** `409` email in use

---

### POST /api/profile/me/avatar 🔒

Upload profile photo.

- **Content-Type:** `multipart/form-data`
- **Field name:** `image` or `file`
- Max size: 10 MB
- Formats: JPEG, PNG, WebP, GIF

**Success `201`**

```json
{
  "url": "https://cdn.../avatar.jpg",
  "profile": { "...updated profile..." }
}
```

---

### POST /api/profile/me/cover 🔒

Upload cover/banner image. Same multipart rules as avatar.

**Success `201`:** `{ "url", "profile" }`

---

### POST /api/profile/change-password 🔒

**Body**

```json
{
  "currentPassword": "oldpass123",
  "newPassword": "newpass456"
}
```

**Success `200`:** `{ "message": "Password updated" }`

**Errors:** `400` missing/short password · `401` wrong current password

---

### GET /api/profile/:userId 🔓

Public profile. **Email hidden.**

**Success `200`**

```json
{
  "profile": {
    "id": "...",
    "name": "Lisa Marie",
    "avatar": "...",
    "coverImage": "...",
    "bio": "...",
    "location": "Houston, TX, USA",
    "followersCount": 1200,
    "followingCount": 90,
    "postsCount": 45,
    "followersLabel": "1.2k followers",
    "followingLabel": "90 following",
    "postsLabel": "45 posts",
    "author": {
      "id": "...",
      "name": "Lisa Marie",
      "avatar": "...",
      "location": "Houston, TX, USA"
    },
    "isFollowing": false,
    "friendStatus": "none"
  }
}
```

`friendStatus`: `none` | `pending_sent` | `pending_received` | `friends`

**Errors:** `404` if blocked or user not found

---

### GET /api/profile/:userId/posts 🔓

**Query**

| Param | Description |
|-------|-------------|
| `page` | Page number (default 1) |
| `limit` | Per page (default 20, max 50) |
| `lang` | Translation language code (`ur`, `hi`, `es`, etc.) |

**Success `200`**

```json
{
  "posts": [ /* Post objects — see §10 */ ],
  "page": 1,
  "limit": 20,
  "total": 42
}
```

---

### GET /api/profile/:userId/followers 🔓

**Success `200`**

```json
{
  "users": [
    {
      "id": "665b...",
      "name": "John Smith",
      "avatar": "https://...",
      "location": "New York, USA"
    }
  ]
}
```

Blocked users filtered for logged-in viewer.

---

### GET /api/profile/:userId/following 🔓

Same response shape as followers.

---

### GET /api/profile/:userId/friends 🔓

**Success `200`**

```json
{
  "friends": [
    {
      "id": "665c...",
      "name": "Hannah R.",
      "avatar": "https://...",
      "location": "Chicago, IL, USA"
    }
  ]
}
```

---

## 7. Users module (legacy) — `/api/users`

Alternate paths — prefer `/api/profile` for new frontend code.

| Method | Path | Auth | Body / Query | Response |
|--------|------|------|--------------|----------|
| GET | `/api/users/me` | 🔒 | — | `{ "profile": {...} }` |
| PATCH | `/api/users/me` | 🔒 | same as profile patch | `{ "profile": {...} }` |
| GET | `/api/users/me/blocked` | 🔒 | — | `{ "users": [{ id, name, avatar }] }` |
| POST | `/api/users/me/blocks` | 🔒 | `{ "userId": "..." }` | `{ "message": "Blocked" }` |
| DELETE | `/api/users/me/blocks/:blockedUserId` | 🔒 | — | `{ "message": "Unblocked" }` |
| GET | `/api/users/search?q=` | 🔒 | `q` required | `{ "users": [author objects] }` |
| GET | `/api/users/:userId` | 🔓 | — | `{ "profile": {...} }` |
| POST | `/api/users/:userId/follow` | 🔒 | — | `{ "following": true\|false }` toggle |

---

## 8. Friends module — `/api/friends`

Facebook-style friend requests (mutual friends after accept).

### POST /api/friends/request 🔒

**Body:** `{ "userId": "<targetUserId>" }`

**Success `200`**

```json
{ "status": "pending", "message": "Friend request sent" }
```

Or if reverse request exists → auto-accept:

```json
{ "status": "accepted", "message": "Friend request accepted" }
```

**Errors:** `400` self-request · `403` blocked · `404` user not found

---

### POST /api/friends/accept 🔒

**Body:** `{ "userId": "<requesterUserId>" }` — the person who sent the request.

**Success `200`:** `{ "status": "accepted", "message": "Friend request accepted" }`

**Errors:** `404` no pending request

---

### POST /api/friends/reject 🔒

**Body:** `{ "userId": "<requesterUserId>" }`

**Success `200`:** `{ "message": "Friend request rejected" }`

---

### GET /api/friends 🔒

Logged-in user's friends list.

**Success `200`:** `{ "friends": [ author objects ] }`

---

## 9. Social module — `/api`

Shortcut routes (frontend spec paths).

### POST /api/follow 🔒

**Body:** `{ "userId": "..." }`

**Success `200`:** `{ "following": true, "message": "Following" }`

Already following: `{ "following": true, "message": "Already following" }`

---

### POST /api/unfollow 🔒

**Body:** `{ "userId": "..." }`

**Success `200`:** `{ "following": false, "message": "Unfollowed" }`

---

### GET /api/followers 🔒

**Query:** `?userId=` optional (default: logged-in user)

**Success `200`:** `{ "users": [...] }`

---

### GET /api/following 🔒

**Query:** `?userId=` optional

**Success `200`:** `{ "users": [...] }`

---

### POST /api/block 🔒

**Body:** `{ "userId": "..." }`

Removes mutual follows and friend requests.

**Success `200`:** `{ "message": "Blocked" }`

---

### POST /api/unblock 🔒

**Body:** `{ "userId": "..." }`

**Success `200`:** `{ "message": "Unblocked" }`

---

## 10. Posts module — `/api/posts`

### Post translation (automatic)

On **create** and **text update**:

1. Detect source language (or use `sourceLanguage` from body)
2. Translate to: `es`, `fr`, `ar`, `hi`, `ur`, `pt` (configurable via env)
3. Store in `translations` map on post document

Read with `?lang=ur` to get translated `text` field.

### Post rules

- Belongs to **group OR church** — not both (`400`)
- Group post: author must be group member (`403`)
- Church post: author must be church member (`403`)
- Personal feed post: omit both `groupId` and `churchId`

### Post object (response)

```json
{
  "id": "665f...",
  "author": {
    "id": "...",
    "name": "Martin",
    "avatar": "https://...",
    "location": "New York, USA"
  },
  "time": "5 mins",
  "text": "Urdu translated text when ?lang=ur",
  "originalText": "Please pray for my family",
  "sourceLanguage": "en",
  "translations": {
    "en": "Please pray for my family",
    "es": "Por favor oren por mi familia",
    "fr": "...",
    "ar": "...",
    "hi": "...",
    "ur": "...",
    "pt": "..."
  },
  "image": "https://...",
  "mode": "prayer",
  "groupId": "665a...",
  "churchId": null,
  "stats": {
    "prays": 2400,
    "praises": 1200,
    "likes": 800,
    "comments": 2600,
    "shares": 1000
  },
  "isPrayedByMe": false,
  "isPraisedByMe": false,
  "isLikedByMe": false
}
```

`mode`: `prayer` | `praise`

---

### GET /api/posts 🔓

**Query**

| Param | Description |
|-------|-------------|
| `q` | Search post text or author name/email |
| `page`, `limit` | Pagination |
| `groupId` | Filter by group |
| `churchId` | Filter by church |
| `authorId` | Filter by user |
| `lang` | Return translated text |

**Success `200`:** `{ "posts", "page", "limit", "total" }`

---

### POST /api/posts 🔒

**Body**

```json
{
  "text": "Please pray for my family",
  "image": "https://cdn.../photo.jpg",
  "mode": "prayer",
  "groupId": null,
  "churchId": "665church...",
  "sourceLanguage": "en"
}
```

**Success `201`:** `{ "post": { ... } }`

---

### GET /api/posts/:id 🔓

**Query:** `lang`

**Success `200`:** `{ "post": { ... } }`

**Errors:** `404` not found or blocked author

---

### PATCH /api/posts/:id 🔒

Author only. Re-translates if `text` changes.

**Body:** `{ "text?", "image?", "mode?", "sourceLanguage?" }`

**Success `200`:** `{ "post": { ... } }`

---

### DELETE /api/posts/:id 🔒

Author only.

**Success `200`:** `{ "message": "Deleted" }`

---

### POST /api/posts/:id/pray 🔒

Toggle pray (amen). One pray per user per post.

**Success `200`**

```json
{ "active": true, "praysCount": 2401 }
```

Toggle off: `{ "active": false, "praysCount": 2400 }`

---

### POST /api/posts/:id/praise 🔒

Toggle praise. Same response shape with `praisesCount`.

---

### POST /api/posts/:id/like 🔒

Toggle like.

**Success `200`**

```json
{ "liked": true, "likesCount": 801 }
```

---

### POST /api/posts/:id/unlike 🔒

Remove like only (no toggle-on).

**Success `200`:** `{ "liked": false, "likesCount": N }`

---

### POST /api/posts/:id/share 🔓

Increment share counter.

**Success `200`:** `{ "sharesCount": 1001 }`

---

### GET /api/posts/:id/comments 🔓

**Success `200`**

```json
{
  "comments": [
    {
      "id": "c1",
      "author": { "name": "Lisa", "avatar": "..." },
      "time": "5 mins",
      "text": "Praying with you!",
      "replies": [
        {
          "id": "c2",
          "author": { "name": "John", "avatar": "..." },
          "time": "2 mins",
          "text": "Amen"
        }
      ]
    }
  ]
}
```

---

### POST /api/posts/:id/comments 🔒

**Body**

```json
{
  "text": "Praying with you",
  "parentCommentId": "665comment..."
}
```

`parentCommentId` optional — omit for top-level comment.

**Success `201`:** `{ "comments": [ full updated tree ] }`

---

### POST /api/posts/:id/report 🔒

**Body**

```json
{
  "reasonKey": "spam",
  "otherText": "Optional details"
}
```

**Success `200`:** `{ "message": "Report submitted" }`

---

### GET /api/posts/:id/pray-praise-users 🔓

**Query:** `type=pray` (default) or `type=praise`

**Success `200`**

```json
{
  "users": [
    {
      "id": "...",
      "name": "John Smith",
      "avatar": "...",
      "type": "pray"
    }
  ]
}
```

---

## 11. Comments module — `/api/comments`

### DELETE /api/comments/:id 🔒

Delete own comment (and reply subtree).

**Success `200`:** `{ "message": "Deleted" }`

---

### POST /api/comments/:id/report 🔒

**Body:** `{ "reasonKey": "...", "otherText?": "..." }`

**Success `200`:** `{ "message": "Report submitted" }`

---

## 12. Upload module — `/api/upload`

### POST /api/upload/image 🔒

Generic image upload before create/patch.

- **Multipart field:** `image` or `file`
- **Query/body `kind`:** `post` | `avatar` | `cover` | `group` | `church_logo` | `church_banner`

**Success `201`**

```json
{
  "kind": "post",
  "storage": "b2",
  "url": "https://cdn.../image.jpg"
}
```

Local storage also returns `absoluteUrl` when `PUBLIC_BASE_URL` is set.

Static files served at: `GET /uploads/<filename>`

---

## 13. Churches module — `/api/churches`

**Business rule:** Each user can create **only one church** → `409 You can only create one church`.

### Church object

```json
{
  "id": "665f...",
  "name": "Grace Community Church",
  "locationShort": "Houston, TX",
  "locationFull": "3700 Southwest Fwy, Houston, Texas, United States",
  "country": "United States",
  "state": "Texas",
  "city": "Houston",
  "streetAddress": "3700 Southwest Fwy",
  "landmark": "Near Greenway Plaza",
  "followersLabel": "12.4k followers",
  "membersLabel": "3 members",
  "image": "https://.../logo.png",
  "bannerImage": "https://.../banner.jpg",
  "banner": "https://.../banner.jpg",
  "website": "https://example.com",
  "email": "info@church.com",
  "phone": "+1 713-555-0100",
  "denomination": "Non-denominational",
  "shortBio": "One line",
  "about": "Long description",
  "liveStreamUrl": "https://...",
  "isVerified": true,
  "isFollowed": false,
  "isMyChurch": true,
  "followerCount": 12400,
  "memberCount": 3
}
```

### UI field mapping (CreateChurchScreen)

| UI field | API field |
|----------|-----------|
| `churchName` | `name` |
| `businessEmail` | `email` |
| `businessPhone` | `phone` |
| `aboutChurch` | `about` |
| `logo` | `image` |
| `bannerImage` | `bannerImage` |

---

### GET /api/churches/discover 🔓

Churches user does not own/follow.

**Query:** `q`

**Success `200`:** `{ "churches": [ Church[] ] }`

---

### GET /api/churches 🔓

**Query**

| Param | Values |
|-------|--------|
| `tab` | `my` \| `followed` |
| `q` | search |
| `filter` | `recommended` \| `most_followed` \| `nearest` \| `trending_posts` \| `trending_search` |

**Success `200`:** `{ "churches": [...] }`

---

### POST /api/churches 🔒

**Body (UI names OK)**

```json
{
  "churchName": "Lakewood Church",
  "website": "https://www.lakewoodchurch.com",
  "country": "United States",
  "state": "Texas",
  "city": "Houston",
  "streetAddress": "3700 Southwest Fwy",
  "landmark": "Near Greenway Plaza",
  "businessEmail": "info@lakewoodchurch.com",
  "businessPhone": "+1 713-635-4154",
  "shortBio": "Optional",
  "aboutChurch": "Long text",
  "logo": "https://...",
  "bannerImage": "https://..."
}
```

**Success `201`**

```json
{
  "church": { "...": "Church object" },
  "verificationRequired": true,
  "devVerificationCode": "48291"
}
```

`devVerificationCode` only in development.

---

### GET /api/churches/:id 🔓

**Success `200`:** `{ "church": { ... } }`

---

### PATCH /api/churches/:id 🔒

Owner or church admin. Same body fields as create.

**Success `200`:** `{ "church": { ... } }`

---

### DELETE /api/churches/:id 🔒

Original owner only.

**Success `200`:** `{ "ok": true }`

---

### POST /api/churches/:id/follow 🔒

Toggle follow.

**Success `200`**

```json
{
  "following": true,
  "followerCount": 12401,
  "followersLabel": "12.4k followers"
}
```

---

### POST /api/churches/:id/verification/send 🔒

Resend OTP. Owner/admin only.

**Success `200`:** includes `devVerificationCode` in dev.

---

### POST /api/churches/:id/verify 🔓

**Body:** `{ "code": "12345" }`

Dev stub: `CHURCH_VERIFY_CODE=12345` in env.

**Success `200`**

```json
{
  "ok": true,
  "church": { "...": "isVerified: true" }
}
```

---

### GET /api/churches/:id/members 🔒

Owner/admin only.

**Success `200`**

```json
{
  "members": [
    {
      "id": "...",
      "userId": "...",
      "name": "Jane",
      "email": "jane@example.com",
      "avatar": "...",
      "role": "admin",
      "joinedAt": "2026-05-18T12:00:00.000Z"
    }
  ]
}
```

Roles: `owner` | `admin` | `member`

---

### POST /api/churches/:id/members 🔒

**Body:** `{ "email": "...", "role": "admin" }` OR `{ "userId": "...", "role": "member" }`

**Success `201`:** `{ "member": {...}, "memberCount": 4 }`

---

### DELETE /api/churches/:id/members/:userId 🔒

Cannot remove church owner.

**Success `200`:** `{ "ok": true }`

---

### PATCH /api/churches/:id/members/:userId 🔒

**Body:** `{ "role": "admin" }` — allowed: `admin` | `member`. Owner only.

---

### Church feed

```http
GET /api/posts?churchId=<churchId>
POST /api/posts  { "churchId": "...", "text": "..." }
```

---

## 14. Groups module — `/api/groups`

### Group object

```json
{
  "id": "...",
  "name": "Prayer Warriors Group",
  "membersLabel": "11k members",
  "memberCount": 11000,
  "image": "https://...",
  "description": "Weekly prayer",
  "isMyGroup": true,
  "isJoined": true,
  "isMember": true,
  "createdBy": "userId",
  "myRole": "owner",
  "isCreatorOrAdmin": true
}
```

---

### GET /api/groups/discover 🔓

Groups user is **not** a member of.

**Query:** `q`

**Success `200`:** `{ "groups": [...] }`

---

### GET /api/groups/mine 🔒

Shortcut for user's created groups.

---

### GET /api/groups 🔓

**Query**

| Param | Description |
|-------|-------------|
| `tab=joined` | Member of |
| `tab=my` | Created by user |
| `q` | Search |
| `mine=true` | Legacy alias for `tab=my` |

**Success `200`:** `{ "groups": [...] }`

---

### POST /api/groups 🔒

**Body**

```json
{
  "groupName": "Prayer Warriors Group",
  "image": "https://...",
  "description": "About this group"
}
```

**Success `201`:** `{ "group": { ... } }`

---

### GET /api/groups/:id 🔓

**Success `200`:** `{ "group": { ... } }`

---

### PATCH /api/groups/:id 🔒

Owner or admin.

**Body:** `{ "groupName?", "image?", "description?" }`

---

### DELETE /api/groups/:id 🔒

Owner only.

---

### POST /api/groups/:id/join 🔒

Join public group.

---

### POST /api/groups/:id/leave 🔒

**Success `200`:** `{ "ok": true, "memberCount": N }`

Owner cannot leave — must delete group.

---

### POST /api/groups/:id/invite 🔒

**Body**

```json
{ "userIds": ["665b...", "665c..."] }
```

or

```json
{ "emails": ["friend@example.com"] }
```

**Success `200`**

```json
{
  "invited": 2,
  "memberCount": 3,
  "membersLabel": "3 members"
}
```

---

### GET /api/groups/:id/invite-candidates 🔒

**Query:** `q`

**Success `200`**

```json
{
  "users": [
    { "id": "...", "name": "John", "avatar": "...", "email": "john@example.com" }
  ]
}
```

---

### Group members CRUD

Same pattern as churches:

- `GET /api/groups/:id/members`
- `POST /api/groups/:id/members` — `{ userId/email, role }`
- `DELETE /api/groups/:id/members/:userId`
- `PATCH /api/groups/:id/members/:userId` — `{ role }`

---

### Group feed

```http
GET /api/posts?groupId=<groupId>
POST /api/posts  { "groupId": "...", "text": "..." }
```

---

## 15. Chat / Conversations — `/api/conversations`

REST for chat history. Realtime via Socket.IO (§16).

### GET /api/conversations 🔒

**Success `200`**

```json
{
  "conversations": [
    {
      "id": "...",
      "isGroup": false,
      "peer": { "id": "...", "name": "Lisa", "avatar": "..." },
      "lastMessage": "See you Sunday",
      "time": "2 hrs"
    },
    {
      "id": "...",
      "isGroup": true,
      "title": "Prayer Group Chat",
      "image": "...",
      "memberCount": 5,
      "lastMessage": "Amen",
      "time": "1 day"
    }
  ]
}
```

---

### POST /api/conversations 🔒

Open or create DM.

**Body:** `{ "peerUserId": "665f..." }`

**Success `200`:** `{ "conversationId": "..." }`

**Errors:** `403` blocked users · `404` peer not found

---

### POST /api/conversations/group 🔒

Create group chat.

**Body**

```json
{
  "title": "Family Prayer",
  "memberIds": ["665b...", "665c..."],
  "image": "https://..."
}
```

**Success `201`:** `{ "conversationId": "..." }`

---

### GET /api/conversations/:id/messages 🔒

**Query:** `limit` (max 100), `before` (message id for pagination)

**Success `200`**

```json
{
  "messages": [
    {
      "id": "...",
      "text": "Hello!",
      "messageType": "text",
      "sender": "me",
      "senderUserId": "...",
      "senderName": "Martin",
      "senderAvatar": "...",
      "time": "5 mins",
      "createdAt": "2026-06-01T..."
    },
    {
      "id": "...",
      "text": "Hi there",
      "messageType": "text",
      "sender": "other",
      "senderUserId": "...",
      "senderName": "Lisa",
      "senderAvatar": "...",
      "time": "4 mins",
      "createdAt": "..."
    }
  ]
}
```

---

### POST /api/conversations/:id/messages 🔒

**Body**

```json
{
  "text": "Hello!",
  "messageType": "text"
}
```

`messageType`: `text` | `image` | `video` | `audio` | `file`

**Success `201`:** `{ "message": { ...restForSender } }`

Also broadcasts via Socket.IO to room members.

---

### POST /api/conversations/:id/leave 🔒

Leave group chat. Deletes conversation if < 2 members remain.

**Success `200`:** `{ "left": true, "deleted": false }` or `{ "left": true, "deleted": true, "formerMemberIds": [...] }`

---

### DELETE /api/conversations/:id/me 🔒

Hide conversation from your list (does not delete for others).

**Success `200`:** `{ "message": "Hidden" }`

---

## 16. Socket.IO (realtime chat)

Same server port as HTTP.

### Connect

```js
import { io } from "socket.io-client";

const socket = io("https://your-api.com", {
  auth: { token: "<JWT access token>" },
  transports: ["websocket", "polling"],
});
```

### Client → Server events

| Event | Payload | Description |
|-------|---------|-------------|
| `user-online` | `userId` (string) | Join personal room `user:{userId}` |
| `join-chat` | `conversationId` | Join room `chat:{conversationId}` |
| `leave-chat` | `conversationId` | Leave chat room |
| `send-message` | `{ conversationId, text, messageType? }` | Send message (alt keys: `chatId`, `content`) |

### Server → Client events

| Event | Payload | Description |
|-------|---------|-------------|
| `new-message` | Message object | New message in joined chat room |
| `chat-updated` | Conversation list item | Inbox preview updated |
| `conversation-deleted` | `{ conversationId }` | Group chat deleted |
| `message-error` | `{ message }` | Send/join failed |

### Recommended flow

1. Connect with JWT
2. Emit `user-online` with your userId
3. On open chat: emit `join-chat` with conversationId
4. Listen `new-message` for live updates
5. Or use REST `POST .../messages` (also broadcasts)

---

## 17. Notifications — `/api/notifications`

### GET /api/notifications 🔒

**Query:** `limit` (default 80)

**Success `200`**

```json
{
  "notifications": [
    {
      "id": "...",
      "title": "New follower",
      "body": "Michael T. started following you.",
      "time": "2 hrs",
      "read": false,
      "kind": "follow",
      "refType": "user",
      "refId": "665f..."
    },
    {
      "id": "...",
      "title": "New message",
      "body": "Hello!",
      "time": "5 mins",
      "read": false,
      "kind": "message",
      "refType": "conversation",
      "refId": "665a..."
    }
  ]
}
```

---

### PATCH /api/notifications/:id/read 🔒

**Success `200`:** `{ "message": "OK" }`

---

### POST /api/notifications/read-all 🔒

**Success `200`:** `{ "message": "OK" }`

---

## 18. Payment methods — `/api/payment-methods`

Stub storage (no live Stripe yet).

### GET /api/payment-methods 🔒

**Success `200`**

```json
{
  "paymentMethods": [
    {
      "id": "...",
      "brand": "visa",
      "last4": "4242",
      "holderName": "Martin Man"
    }
  ]
}
```

---

### POST /api/payment-methods 🔒

**Body**

```json
{
  "brand": "visa",
  "last4": "4242",
  "holderName": "Martin Man",
  "token": "stripe_token_stub"
}
```

**Success `201`:** `{ "paymentMethod": { id, brand, last4, holderName } }`

---

### DELETE /api/payment-methods/:id 🔒

**Success `200`:** `{ "message": "Removed" }`

---

## 19. Subscription — `/api/subscription`

Stub until billing provider integrated.

### GET /api/subscription/status 🔒

**Success `200`**

```json
{
  "subscription": {
    "active": false,
    "plan": "none",
    "message": "Community subscription is not activated for this account."
  }
}
```

---

### POST /api/subscription/subscribe 🔒

**Success `200`**

```json
{
  "subscription": {
    "active": true,
    "plan": "community_stub",
    "message": "Stub activation only — connect a payment provider for production."
  }
}
```

---

## 20. Shared data shapes

### Author / user list item

```json
{
  "id": "665f...",
  "name": "John Smith",
  "avatar": "https://...",
  "location": "New York, USA"
}
```

### Comment tree node

```json
{
  "id": "c1",
  "author": { "name": "Lisa", "avatar": "..." },
  "time": "5 mins",
  "text": "...",
  "replies": [ /* nested */ ]
}
```

---

## 21. Error reference

| Status | When |
|--------|------|
| `400` | Validation, bad ObjectId, missing body fields |
| `401` | Missing/invalid/expired token, wrong password |
| `403` | Not allowed (not member, blocked, not owner) |
| `404` | Resource not found, blocked user hidden as 404 |
| `409` | Duplicate email, second church creation |
| `500` | Server / upload / translate failure |

---

## 22. Frontend screen → API map

| Screen | APIs |
|--------|------|
| Login / Register / Social | `/api/auth/*` |
| Forgot / Reset password | `/api/auth/forgot-password`, `/reset-password` |
| My Profile | `GET /api/profile/me` |
| Edit Profile | `PATCH /api/profile/me`, `POST /me/avatar`, `/me/cover`, `/change-password` |
| Other User Profile | `GET /api/profile/:userId`, `/posts`, `POST /api/friends/request` |
| Blocked Users | `GET /api/users/me/blocked`, `POST /api/unblock` |
| Home feed | `GET /api/posts?lang=` |
| Create Post | `POST /api/upload/image`, `POST /api/posts` |
| Post interactions | `/pray`, `/praise`, `/like`, `/comments`, `/share` |
| Comments modal | `GET/POST /api/posts/:id/comments` |
| Churches screens | `/api/churches/*`, `GET /api/posts?churchId=` |
| Community groups | `/api/groups/*`, `GET /api/posts?groupId=` |
| Chat list | `GET /api/conversations` + Socket.IO |
| Message screen | `GET/POST /api/conversations/:id/messages` + Socket.IO |
| Notifications | `/api/notifications` |
| Subscription / Payment | `/api/subscription/*`, `/api/payment-methods/*` |
| Follow / Friends | `/api/follow`, `/api/friends/*`, `/api/profile/:id/followers` |

---

## 23. Deployment notes

### Hostinger Node.js

| Setting | Value |
|---------|--------|
| Build | `npm install && npm run build` (if using compiled dist) |
| Start | `npm start` |
| Entry | `index.js` |
| Env | Set `MONGO_URI`, `JWT_SECRET`, `GOOGLE_TRANSLATE_API_KEY` in hPanel |

### Required production env

```
MONGO_URI=mongodb+srv://...
JWT_SECRET=<long-random-string>
GOOGLE_TRANSLATE_API_KEY=<google-cloud-key>
TRANSLATION_TARGET_LANGUAGES=es,fr,ar,hi,ur,pt
```

### Test after deploy

```bash
curl https://your-domain.com/health
curl https://your-domain.com/api/test/ping
```

---

## Appendix: Complete endpoint index (95 routes)

| # | Method | Path |
|---|--------|------|
| 1 | GET | `/health` |
| 2 | GET | `/api/test` |
| 3 | GET | `/api/test/ping` |
| 4 | POST | `/api/auth/register` |
| 5 | POST | `/api/auth/login` |
| 6 | POST | `/api/auth/social-login` |
| 7 | POST | `/api/auth/forgot-password` |
| 8 | POST | `/api/auth/reset-password` |
| 9 | GET | `/api/auth/me` |
| 10 | GET | `/api/profile/me` |
| 11 | PATCH | `/api/profile/me` |
| 12 | POST | `/api/profile/me/avatar` |
| 13 | POST | `/api/profile/me/cover` |
| 14 | POST | `/api/profile/change-password` |
| 15 | GET | `/api/profile/:userId` |
| 16 | GET | `/api/profile/:userId/posts` |
| 17 | GET | `/api/profile/:userId/followers` |
| 18 | GET | `/api/profile/:userId/following` |
| 19 | GET | `/api/profile/:userId/friends` |
| 20 | GET | `/api/users/me` |
| 21 | PATCH | `/api/users/me` |
| 22 | GET | `/api/users/me/blocked` |
| 23 | POST | `/api/users/me/blocks` |
| 24 | DELETE | `/api/users/me/blocks/:blockedUserId` |
| 25 | GET | `/api/users/search` |
| 26 | GET | `/api/users/:userId` |
| 27 | POST | `/api/users/:userId/follow` |
| 28 | POST | `/api/friends/request` |
| 29 | POST | `/api/friends/accept` |
| 30 | POST | `/api/friends/reject` |
| 31 | GET | `/api/friends` |
| 32 | POST | `/api/follow` |
| 33 | POST | `/api/unfollow` |
| 34 | GET | `/api/followers` |
| 35 | GET | `/api/following` |
| 36 | POST | `/api/block` |
| 37 | POST | `/api/unblock` |
| 38 | GET | `/api/posts` |
| 39 | POST | `/api/posts` |
| 40 | GET | `/api/posts/:id` |
| 41 | PATCH | `/api/posts/:id` |
| 42 | DELETE | `/api/posts/:id` |
| 43 | GET | `/api/posts/:id/comments` |
| 44 | POST | `/api/posts/:id/comments` |
| 45 | POST | `/api/posts/:id/report` |
| 46 | POST | `/api/posts/:id/pray` |
| 47 | POST | `/api/posts/:id/praise` |
| 48 | POST | `/api/posts/:id/like` |
| 49 | POST | `/api/posts/:id/unlike` |
| 50 | POST | `/api/posts/:id/share` |
| 51 | GET | `/api/posts/:id/pray-praise-users` |
| 52 | DELETE | `/api/comments/:id` |
| 53 | POST | `/api/comments/:id/report` |
| 54 | POST | `/api/upload/image` |
| 55 | GET | `/api/churches/discover` |
| 56 | GET | `/api/churches` |
| 57 | POST | `/api/churches` |
| 58 | GET | `/api/churches/:id` |
| 59 | PATCH | `/api/churches/:id` |
| 60 | DELETE | `/api/churches/:id` |
| 61 | POST | `/api/churches/:id/follow` |
| 62 | POST | `/api/churches/:id/verification/send` |
| 63 | POST | `/api/churches/:id/verify` |
| 64 | GET | `/api/churches/:id/members` |
| 65 | POST | `/api/churches/:id/members` |
| 66 | DELETE | `/api/churches/:id/members/:userId` |
| 67 | PATCH | `/api/churches/:id/members/:userId` |
| 68 | GET | `/api/groups/discover` |
| 69 | GET | `/api/groups/mine` |
| 70 | GET | `/api/groups` |
| 71 | POST | `/api/groups` |
| 72 | GET | `/api/groups/:id` |
| 73 | PATCH | `/api/groups/:id` |
| 74 | DELETE | `/api/groups/:id` |
| 75 | POST | `/api/groups/:id/join` |
| 76 | POST | `/api/groups/:id/leave` |
| 77 | POST | `/api/groups/:id/invite` |
| 78 | GET | `/api/groups/:id/invite-candidates` |
| 79 | GET | `/api/groups/:id/members` |
| 80 | POST | `/api/groups/:id/members` |
| 81 | DELETE | `/api/groups/:id/members/:userId` |
| 82 | PATCH | `/api/groups/:id/members/:userId` |
| 83 | GET | `/api/conversations` |
| 84 | POST | `/api/conversations` |
| 85 | POST | `/api/conversations/group` |
| 86 | GET | `/api/conversations/:id/messages` |
| 87 | POST | `/api/conversations/:id/messages` |
| 88 | POST | `/api/conversations/:id/leave` |
| 89 | DELETE | `/api/conversations/:id/me` |
| 90 | GET | `/api/notifications` |
| 91 | PATCH | `/api/notifications/:id/read` |
| 92 | POST | `/api/notifications/read-all` |
| 93 | GET | `/api/payment-methods` |
| 94 | POST | `/api/payment-methods` |
| 95 | DELETE | `/api/payment-methods/:id` |
| 96 | GET | `/api/subscription/status` |
| 97 | POST | `/api/subscription/subscribe` |

Plus: **Socket.IO** events, **static** `/uploads/*`

---

*Document version: June 2026 — matches `src/app.ts` route registration.*
