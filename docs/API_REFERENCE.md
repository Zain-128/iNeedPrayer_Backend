# iNeedPrayer Backend — Complete API Reference

> **📘 Full detailed docs:** see **[FULL_API_DOCUMENTATION.md](./FULL_API_DOCUMENTATION.md)** — every endpoint with request/response examples, Socket.IO, env vars, and frontend map.

Express + MongoDB API for the **INeedPrayer** mobile app.

**Base URL (local):** `http://localhost:3004`  
**Production:** your Hostinger / deployed domain (e.g. `https://your-domain.com`)

---

## Conventions

### Headers

| Header | When |
|--------|------|
| `Content-Type: application/json` | JSON bodies (not multipart upload) |
| `Authorization: Bearer <token>` | Protected routes |

### Auth legend

| Symbol | Meaning |
|--------|---------|
| 🔒 | Requires `Authorization: Bearer <token>` |
| 🔓 | Optional auth — send token for viewer-specific fields (`isFollowing`, `isPrayedByMe`, etc.) |
| 🌐 | Public — no token |

### IDs

All `userId`, `postId`, `churchId`, `groupId`, etc. are MongoDB ObjectId strings (24 hex chars).

### Errors

Most errors return:

```json
{ "message": "Human-readable error" }
```

Common status codes: `400` validation · `401` unauthorized · `403` forbidden · `404` not found · `409` conflict · `500` server error

---

## Environment variables

See `.env.example`. Key vars:

| Variable | Purpose |
|----------|---------|
| `MONGO_URI` | MongoDB connection |
| `JWT_SECRET` | JWT signing |
| `GOOGLE_TRANSLATE_API_KEY` | Auto-translate posts (optional) |
| `TRANSLATION_TARGET_LANGUAGES` | Default: `es,fr,ar,hi,ur,pt` |
| `B2_*` | Backblaze image storage (optional) |
| `PUBLIC_BASE_URL` | Absolute URLs for local uploads |

---

## Health & Test

### GET /health 🌐

Liveness check.

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

## Auth — `/api/auth`

### POST /api/auth/register 🌐

**Body**

```json
{
  "email": "user@example.com",
  "password": "secret123",
  "name": "John Doe"
}
```

**Response `201`**

```json
{
  "user": { "_id": "...", "email": "...", "name": "...", "avatar": "" },
  "token": "eyJ..."
}
```

---

### POST /api/auth/login 🌐

**Body:** `{ "email", "password" }`  
**Response `200`:** same shape as register (`user` + `token`).

---

### POST /api/auth/social-login 🌐

**Body**

```json
{
  "email": "user@gmail.com",
  "name": "John",
  "socialLoginProvider": "google",
  "socialLoginId": "firebase-uid",
  "profilePicture": "https://..."
}
```

`socialLoginProvider`: `google` | `facebook` | `apple` | `twitter`

**Response `200`**

```json
{
  "message": "User login successfully",
  "user": { ... },
  "accessToken": "...",
  "refreshToken": "...",
  "token": "..."
}
```

---

### POST /api/auth/forgot-password 🌐

**Body:** `{ "email": "user@example.com" }`

---

### POST /api/auth/reset-password 🌐

**Body:** `{ "email", "code", "password" }`  
Uses fixed dev code from `PASSWORD_RESET_CODE` env (default `1234`) until email OTP is wired.

---

### GET /api/auth/me 🔒

Basic logged-in user from auth module.

**Response `200`:** `{ "user": { ... } }`

---

## Profile — `/api/profile`

Frontend-friendly profile APIs.

### GET /api/profile/me 🔒

Full profile with stats.

**Response `200`**

```json
{
  "profile": {
    "id": "...",
    "_id": "...",
    "name": "Martin",
    "email": "martin@example.com",
    "avatar": "https://...",
    "coverImage": "https://...",
    "bio": "Prayer warrior",
    "preferredLanguage": "en",
    "location": "New York, NY, USA",
    "city": "New York",
    "state": "NY",
    "country": "USA",
    "followersCount": 3500,
    "followingCount": 180,
    "postsCount": 120,
    "followersLabel": "3.5k followers",
    "followingLabel": "180 following",
    "postsLabel": "120 posts"
  }
}
```

---

### PATCH /api/profile/me 🔒

Update profile (password **not** here — use change-password).

**Body (all optional)**

```json
{
  "name": "Martin Man",
  "email": "new@example.com",
  "avatar": "https://...",
  "coverImage": "https://...",
  "bio": "About me",
  "preferredLanguage": "ur",
  "city": "New York",
  "state": "NY",
  "country": "USA"
}
```

**Response `200`:** `{ "profile": { ... } }`

---

### POST /api/profile/me/avatar 🔒

Upload profile image. **Multipart** field: `image` or `file`.

**Response `201`**

```json
{
  "url": "https://...",
  "profile": { ... }
}
```

---

### POST /api/profile/me/cover 🔒

Upload cover/banner image. Same multipart rules as avatar.

**Response `201`:** `{ "url", "profile" }`

---

### POST /api/profile/change-password 🔒

**Body**

```json
{
  "currentPassword": "old123",
  "newPassword": "new456"
}
```

**Response `200`:** `{ "message": "Password updated" }`

---

### GET /api/profile/:userId 🔓

Other user's public profile. Email hidden. Includes `isFollowing`, `friendStatus`.

`friendStatus`: `none` | `pending_sent` | `pending_received` | `friends`

**Response `200`:** `{ "profile": { ... } }`

---

### GET /api/profile/:userId/posts 🔓

**Query:** `page`, `limit`, `lang` (e.g. `ur`, `hi`, `es`)

**Response `200`**

```json
{
  "posts": [ ... ],
  "page": 1,
  "limit": 20,
  "total": 42
}
```

---

### GET /api/profile/:userId/followers 🔓

**Response `200`**

```json
{
  "users": [
    { "id": "...", "name": "John", "avatar": "...", "location": "..." }
  ]
}
```

---

### GET /api/profile/:userId/following 🔓

Same shape as followers.

---

### GET /api/profile/:userId/friends 🔓

**Response `200`**

```json
{
  "friends": [
    { "id": "...", "name": "Lisa", "avatar": "...", "location": "..." }
  ]
}
```

---

## Users (legacy/alternate paths) — `/api/users`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/users/me` | 🔒 | Same as profile/me |
| PATCH | `/api/users/me` | 🔒 | Update profile |
| GET | `/api/users/me/blocked` | 🔒 | Blocked users list |
| POST | `/api/users/me/blocks` | 🔒 | Body: `{ "userId" }` |
| DELETE | `/api/users/me/blocks/:blockedUserId` | 🔒 | Unblock |
| GET | `/api/users/search?q=` | 🔒 | Search users by name/email |
| GET | `/api/users/:userId` | 🔓 | Public profile |
| POST | `/api/users/:userId/follow` | 🔒 | Toggle follow on/off |

---

## Friends — `/api/friends`

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/friends/request` | `{ "userId" }` | `{ "status": "pending"\|"accepted", "message" }` |
| POST | `/api/friends/accept` | `{ "userId" }` (requester id) | `{ "status": "accepted", "message" }` |
| POST | `/api/friends/reject` | `{ "userId" }` | `{ "message": "Friend request rejected" }` |
| GET | `/api/friends` | — | `{ "friends": [...] }` |

If B already sent a request to A and A sends to B → auto-accept.

---

## Social (follow / block shortcuts) — `/api`

| Method | Path | Body / Query | Notes |
|--------|------|--------------|-------|
| POST | `/api/follow` | `{ "userId" }` | Follow user |
| POST | `/api/unfollow` | `{ "userId" }` | Unfollow |
| GET | `/api/followers` | `?userId=` optional | Default: logged-in user |
| GET | `/api/following` | `?userId=` optional | Default: logged-in user |
| POST | `/api/block` | `{ "userId" }` | Block user |
| POST | `/api/unblock` | `{ "userId" }` | Unblock |

---

## Posts — `/api/posts`

Posts auto-translate into **5–6 languages** on create/update when `GOOGLE_TRANSLATE_API_KEY` is set.

**Rules:**
- Post belongs to **either** a `groupId` **or** a `churchId` — not both.
- Group post: author must be group member.
- Church post: author must be church member.

### Post object (response)

```json
{
  "id": "...",
  "author": { "id", "name", "avatar", "location?" },
  "time": "5 mins",
  "text": "Translated text for requested lang",
  "originalText": "Please pray for my family",
  "sourceLanguage": "en",
  "translations": {
    "en": "Please pray for my family",
    "es": "...",
    "fr": "...",
    "ar": "...",
    "hi": "...",
    "ur": "...",
    "pt": "..."
  },
  "image": "https://...",
  "mode": "prayer",
  "groupId": "...",
  "churchId": "...",
  "stats": {
    "prays": 24,
    "praises": 12,
    "likes": 8,
    "comments": 5,
    "shares": 2
  },
  "isPrayedByMe": false,
  "isPraisedByMe": false,
  "isLikedByMe": false
}
```

Use `?lang=ur` on GET routes to return translated `text`.

---

### GET /api/posts 🔓

**Query:** `q`, `page`, `limit`, `groupId`, `churchId`, `authorId`, `lang`

**Response `200`:** `{ "posts", "page", "limit", "total" }`

---

### POST /api/posts 🔒

**Body**

```json
{
  "text": "Please pray for my family",
  "image": "https://...",
  "mode": "prayer",
  "groupId": "665f...",
  "churchId": null,
  "sourceLanguage": "en"
}
```

`mode`: `prayer` | `praise`

**Response `201`:** `{ "post": { ... } }`

---

### GET /api/posts/:id 🔓

**Query:** `lang`

**Response `200`:** `{ "post": { ... } }`

---

### PATCH /api/posts/:id 🔒

Author only. Re-translates if `text` changes.

**Body:** `{ "text?", "image?", "mode?", "sourceLanguage?" }`

---

### DELETE /api/posts/:id 🔒

Author only. **Response `200`:** `{ "message": "Deleted" }`

---

### POST /api/posts/:id/pray 🔒

Toggle pray (amen). **Response:** `{ "active": true|false, "praysCount": N }`

---

### POST /api/posts/:id/praise 🔒

Toggle praise. **Response:** `{ "active", "praisesCount" }`

---

### POST /api/posts/:id/like 🔒

Toggle like. **Response:** `{ "liked": true|false, "likesCount": N }`

---

### POST /api/posts/:id/unlike 🔒

Remove like only. **Response:** `{ "liked": false, "likesCount": N }`

---

### POST /api/posts/:id/share 🔓

Increment share count. **Response:** `{ "sharesCount": N }`

---

### GET /api/posts/:id/comments 🔓

**Response `200`:** `{ "comments": [ nested tree ] }`

---

### POST /api/posts/:id/comments 🔒

**Body**

```json
{
  "text": "Praying with you",
  "parentCommentId": "665f..."
}
```

`parentCommentId` optional (for replies).

**Response `201`:** `{ "comments": [ updated tree ] }`

---

### POST /api/posts/:id/report 🔒

**Body:** `{ "reasonKey": "spam", "otherText?": "..." }`

---

### GET /api/posts/:id/pray-praise-users 🔓

**Query:** `type=pray|praise` (default `pray`)

**Response:** `{ "users": [{ "id", "name", "avatar", "type" }] }`

---

## Comments — `/api/comments`

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| DELETE | `/api/comments/:id` | 🔒 | Delete own comment |
| POST | `/api/comments/:id/report` | 🔒 | Report comment |

---

## Upload — `/api/upload`

### POST /api/upload/image 🔒

Generic image upload. **Multipart:** `image` or `file`.

**Query / body:** `kind` — e.g. `post`, `avatar`, `cover`, `group`, `church_logo`, `church_banner`

**Response `201`**

```json
{
  "kind": "post",
  "storage": "b2",
  "url": "https://..."
}
```

---

## Churches — `/api/churches`

**Rule:** Each user can create **only one church** (`409` on second attempt).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/discover` | 🔓 | Discover churches `?q=` |
| GET | `/` | 🔓 | List `?tab=my\|followed`, `?q=`, `?filter=` |
| POST | `/` | 🔒 | Create church |
| GET | `/:id` | 🔓 | Church detail |
| PATCH | `/:id` | 🔒 | Update (owner/admin) |
| DELETE | `/:id` | 🔒 | Delete (owner only) |
| POST | `/:id/follow` | 🔒 | Toggle follow |
| POST | `/:id/verification/send` | 🔒 | Resend OTP |
| POST | `/:id/verify` | 🔓 | Body: `{ "code": "12345" }` |
| GET | `/:id/members` | 🔒 | List members |
| POST | `/:id/members` | 🔒 | Add member |
| DELETE | `/:id/members/:userId` | 🔒 | Remove member |
| PATCH | `/:id/members/:userId` | 🔒 | Update role |

**Create body (UI names accepted):**

```json
{
  "churchName": "Grace Church",
  "businessEmail": "info@church.com",
  "city": "Houston",
  "state": "Texas",
  "country": "United States",
  "streetAddress": "3700 Southwest Fwy",
  "landmark": "Near Greenway Plaza",
  "denomination": "Non-denominational",
  "about": "Long description",
  "website": "https://...",
  "phone": "+1 713-555-0100"
}
```

Church feed: `GET /api/posts?churchId=:id`

More detail: [CHURCHES_API.md](./CHURCHES_API.md)

---

## Groups — `/api/groups`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/discover` | 🔓 | Discover groups `?q=` |
| GET | `/mine` | 🔒 | My groups shortcut |
| GET | `/` | 🔓 | List `?tab=joined\|my` |
| POST | `/` | 🔒 | Create group |
| GET | `/:id` | 🔓 | Group detail |
| PATCH | `/:id` | 🔒 | Update group |
| DELETE | `/:id` | 🔒 | Delete group |
| POST | `/:id/join` | 🔒 | Join public group |
| POST | `/:id/leave` | 🔒 | Leave group |
| POST | `/:id/invite` | 🔒 | Body: `{ "userIds": [] }` or `{ "emails": [] }` |
| GET | `/:id/invite-candidates` | 🔒 | Users to invite `?q=` |
| GET | `/:id/members` | 🔒 | Members list |
| POST | `/:id/members` | 🔒 | Add member |
| DELETE | `/:id/members/:userId` | 🔒 | Remove member |
| PATCH | `/:id/members/:userId` | 🔒 | Update role |

**Create body:**

```json
{
  "groupName": "Prayer Warriors",
  "image": "https://...",
  "description": "Weekly prayer group"
}
```

Group feed: `GET /api/posts?groupId=:id`

More detail: [GROUPS_API.md](./GROUPS_API.md)

---

## Chat / Conversations — `/api/conversations`

REST for chat history. **Realtime:** Socket.IO on same server port.

### Socket.IO connect

```js
import { io } from "socket.io-client";

const socket = io("https://your-api.com", {
  auth: { token: "<JWT same as REST>" },
});
```

Events: `new-message`, `chat-updated`, `conversation-deleted` (see chat socket handlers).

---

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | 🔒 | List conversations |
| POST | `/` | 🔒 | Open DM — body: `{ "peerUserId" }` |
| POST | `/group` | 🔒 | Create group chat — `{ "title", "memberIds": [], "image?" }` |
| GET | `/:id/messages` | 🔒 | Message history |
| POST | `/:id/messages` | 🔒 | Send message — `{ "text", "messageType?" }` |
| POST | `/:id/leave` | 🔒 | Leave group chat |
| DELETE | `/:id/me` | 🔒 | Hide conversation for me |

`messageType`: `text` | `image` | `video` | `audio` | `file`

---

## Notifications — `/api/notifications`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | 🔒 | List notifications |
| PATCH | `/:id/read` | 🔒 | Mark one read |
| POST | `/read-all` | 🔒 | Mark all read |

---

## Payment methods — `/api/payment-methods`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | 🔒 | List saved cards |
| POST | `/` | 🔒 | Add payment method |
| DELETE | `/:id` | 🔒 | Remove method |

---

## Subscription — `/api/subscription`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/status` | 🔒 | Current subscription status |
| POST | `/subscribe` | 🔒 | Subscribe to plan |

---

## Quick frontend map

| App feature | Primary API |
|-------------|-------------|
| Login / Register | `/api/auth/*` |
| My profile | `GET/PATCH /api/profile/me` |
| Edit profile / avatar / cover | `/api/profile/me`, `/me/avatar`, `/me/cover` |
| Change password | `POST /api/profile/change-password` |
| Other user profile | `GET /api/profile/:userId` |
| User posts | `GET /api/profile/:userId/posts?lang=` |
| Followers / Following / Friends | `/api/profile/:userId/...` or `/api/followers` |
| Add friend | `POST /api/friends/request` |
| Follow / Unfollow | `POST /api/follow`, `/api/unfollow` |
| Block / Unblock | `POST /api/block`, `/api/unblock` |
| Home feed | `GET /api/posts?lang=` |
| Create post | `POST /api/posts` |
| Pray / Praise / Like | `/api/posts/:id/pray`, `/praise`, `/like` |
| Comments | `/api/posts/:id/comments` |
| Blocked users | `GET /api/users/me/blocked` |
| Churches | `/api/churches/*` |
| Community groups | `/api/groups/*` |
| Chat list & messages | `/api/conversations/*` + Socket.IO |
| Notifications | `/api/notifications` |
| Upload images | `POST /api/upload/image` |

---

## Post translation flow

1. User creates post with `text` (any language).
2. Backend detects source language (or uses `sourceLanguage` from body).
3. Google Translate fills `translations` for: `es`, `fr`, `ar`, `hi`, `ur`, `pt` (configurable).
4. Client reads posts with `?lang=ur` using user's `preferredLanguage`.

Without API key: only original `text` is stored; `translations` contains source language only.

---

*Last updated: reflects all routes registered in `src/app.ts`.*
