# Frontend Integration — Recent Backend Changes

Auth on all 🔒 routes: `Authorization: Bearer <token>`

---

## 1. Posts — `isMine`

Har post object me ab ye field aati hai:

```json
{
  "isMine": true
}
```

| Value | Meaning | UI tip |
|-------|---------|--------|
| `true` | Post logged-in user ki hai | Report hide / disable |
| `false` | Dusre user ki post | Report show |

Applies to: `GET /api/posts`, `GET /api/posts/:id`, create/update post responses, group posts.

---

## 2. Comments Module

### Comment object shape (tree + replies)

```json
{
  "id": "...",
  "author": { "id": "...", "name": "...", "avatar": "..." },
  "time": "4 wks",
  "text": "...",
  "praysCount": 0,
  "praisesCount": 0,
  "isPrayedByMe": false,
  "isPraisedByMe": false,
  "isMine": true,
  "replies": []
}
```

`replies` hamesha array hai (empty ho sakti hai). Nested replies me bhi same fields.

| Field | UI tip |
|-------|--------|
| `isMine: true` | Edit + Delete show, Report hide |
| `isMine: false` | Report show, Edit + Delete hide |

### APIs

| Method | Endpoint | Auth | Body / Notes | Response |
|--------|----------|------|--------------|----------|
| `GET` | `/api/posts/:postId/comments` | Optional | — | `{ "comments": [ tree ] }` |
| `POST` | `/api/posts/:postId/comments` | 🔒 | `{ "text", "parentCommentId?" }` | `{ "comments": [ updated tree ] }` |
| `PATCH` | `/api/comments/:id` | 🔒 | `{ "text" }` | `{ "comment": { ... } }` |
| `DELETE` | `/api/comments/:id` | 🔒 | Own comment only | `{ "message": "Deleted" }` |
| `POST` | `/api/comments/:id/report` | 🔒 | `{ "reasonKey", "otherText?" }` | `{ "message": "Report submitted" }` |
| `POST` | `/api/comments/:id/pray` | 🔒 | Toggle | `{ "active": true\|false, "praysCount": N }` |
| `POST` | `/api/comments/:id/praise` | 🔒 | Toggle | `{ "active": true\|false, "praisesCount": N }` |

**Add reply example:**
```json
POST /api/posts/:postId/comments
{ "text": "Amen", "parentCommentId": "665comment..." }
```

---

## 3. Groups — Invites

### Existing

| Method | Endpoint | Notes |
|--------|----------|-------|
| `GET` | `/api/groups/:id/invite-candidates?q=` | Search users to invite (excludes members + pending invites) |
| `POST` | `/api/groups/:id/invite` | Body: `{ "userIds": ["..."] }` or `{ "emails": ["..."] }` — creates **pending** invite (does not auto-add member) |
| `GET` | `/api/groups/:id/members` | Accepted members only |

### List invites

```http
GET /api/groups/:id/invites?status=all|invited|pending|accepted|rejected
```

**Response:**
```json
{
  "invites": [
    {
      "id": "...",
      "userId": "...",
      "name": "...",
      "email": "...",
      "avatar": "...",
      "status": "pending",
      "invitedBy": { "id": "...", "name": "...", "avatar": "..." },
      "invitedAt": "2026-06-07T..."
    }
  ]
}
```

| `status` query | Returns |
|----------------|---------|
| `all` | All invites |
| `invited` | pending + accepted |
| `pending` | Waiting |
| `accepted` | Joined via invite |
| `rejected` | Declined |

### Invite actions

| Method | Endpoint | Who | Action |
|--------|----------|-----|--------|
| `DELETE` | `/api/groups/:id/invites/:userId` | Owner/Admin | Cancel pending invite |
| `POST` | `/api/groups/:id/invites/:userId/resend` | Owner/Admin | Resend rejected → pending |
| `POST` | `/api/groups/:id/invites/:userId/accept` | Invitee only | Accept & join |
| `POST` | `/api/groups/:id/invites/:userId/reject` | Invitee only | Reject |

**Accept:** `{ "group": {...}, "invite": {...} }`  
**Reject:** `{ "invite": { "status": "rejected", ... } }`

---

## 4. Groups — Join Requests

Groups with `requiresApproval: true` pe `POST /api/groups/:id/join` member nahi banata — pending request banata hai:

```json
{ "status": "pending", "message": "Join request submitted" }
```

Open groups (`requiresApproval: false`, default) still join instantly: `{ "status": "joined", "group": {...} }`

| Method | Endpoint | Who |
|--------|----------|-----|
| `GET` | `/api/groups/:id/pending-join-requests` | Owner/Admin |
| `POST` | `/api/groups/:id/join-requests/:userId/approve` | Owner/Admin |
| `POST` | `/api/groups/:id/join-requests/:userId/reject` | Owner/Admin |

**Pending list:**
```json
{
  "requests": [
    {
      "id": "...",
      "userId": "...",
      "name": "...",
      "email": "...",
      "avatar": "...",
      "status": "pending",
      "requestedAt": "..."
    }
  ]
}
```

---

## 5. Groups — Recommended APIs

| Method | Endpoint | Auth | Response |
|--------|----------|------|----------|
| `GET` | `/api/groups/:id/posts` | Member | `{ "posts", "page", "limit", "total" }` (supports `?page=&limit=&q=&lang=`) |
| `GET` | `/api/groups/:id/admins` | Member | `{ "admins": [{ userId, name, avatar, role, isOwner }] }` |
| `POST` | `/api/groups/:id/members/:userId/make-admin` | Owner | `{ "ok", "userId", "role": "admin" }` |
| `POST` | `/api/groups/:id/members/:userId/remove-admin` | Owner | `{ "ok", "userId", "role": "member" }` |
| `POST` | `/api/groups/:id/report` | 🔒 | Body: `{ "reasonKey", "otherText?" }` → `{ "message": "Report submitted" }` |
| `POST` | `/api/groups/:id/mute` | Member | `{ "muted": true }` |
| `POST` | `/api/groups/:id/unmute` | Member | `{ "muted": false }` |

---

## 6. Friends & Social

### Friends

| Method | Endpoint | Response |
|--------|----------|----------|
| `GET` | `/api/friends/requests/incoming` | `{ "requests": [{ requestId, user, requestedAt }] }` |
| `GET` | `/api/friends/requests/outgoing` | same shape |
| `DELETE` | `/api/friends/request/:userId` | Cancel outgoing → `{ "message": "Friend request cancelled" }` |
| `DELETE` | `/api/friends/:userId` | Unfriend → `{ "message": "Friend removed" }` |
| `POST` | `/api/friends/request` | Existing — `{ "userId" }` |
| `POST` | `/api/friends/accept` | Existing — `{ "userId" }` (requester) |
| `POST` | `/api/friends/reject` | Existing |
| `GET` | `/api/friends` | Existing friends list |

### Users

| Method | Endpoint | Response |
|--------|----------|----------|
| `GET` | `/api/users/search?q=` | `{ "users": [ author ] }` |
| `GET` | `/api/users/suggestions` | `{ "users": [ author ] }` (friends-of-friends + popular) |
| `GET` | `/api/users/:userId/mutual-friends` | `{ "users": [ author ] }` |

### Block status

```http
GET /api/block/status?userId=665...
```

```json
{
  "blocked": false,
  "blockedByMe": false,
  "blockedByThem": false
}
```

---

## 7. Notifications Module

### List (cursor pagination)

```http
GET /api/notifications?cursor=&limit=20
```

```json
{
  "notifications": [
    {
      "id": "...",
      "title": "New follower",
      "body": "...",
      "time": "2 hrs",
      "createdAt": "2026-06-07T...",
      "read": false,
      "kind": "follow",
      "refType": "user",
      "refId": "..."
    }
  ],
  "nextCursor": "665a...",
  "hasMore": true
}
```

First page: omit `cursor`. Next page: pass previous `nextCursor`. Default limit `20`, max `50`.

### Other endpoints

| Method | Endpoint | Response |
|--------|----------|----------|
| `GET` | `/api/notifications/unread-count` | `{ "unreadCount": 5 }` |
| `DELETE` | `/api/notifications/:id` | `{ "message": "Deleted" }` |
| `POST` | `/api/notifications/clear-all` | `{ "deleted": 12 }` |
| `PATCH` | `/api/notifications/:id/read` | `{ "message": "OK" }` |
| `PATCH` | `/api/notifications/:id/unread` | `{ "message": "OK" }` |
| `POST` | `/api/notifications/read-all` | `{ "message": "OK" }` |
| `GET` | `/api/notifications/settings` | `{ "settings": {...} }` |
| `PATCH` | `/api/notifications/settings` | Body: partial booleans → `{ "settings": {...} }` |
| `POST` | `/api/notifications/mute` | See below |

**Settings object:**
```json
{
  "pushEnabled": true,
  "emailEnabled": true,
  "friendRequests": true,
  "messages": true,
  "groupActivity": true,
  "postActivity": true,
  "prayersAndPraises": true,
  "muted": false,
  "mutedUntil": null
}
```

**Mute body examples:**
```json
{ "durationHours": 8 }
{ "durationMinutes": 60 }
{ "muted": false }
```
Default mute duration = 1 hour if none provided.

---

## Frontend checklist (quick)

- [ ] Posts: use `isMine` to hide Report on own posts
- [ ] Comments: use `isMine` for Edit/Delete vs Report
- [ ] Comment pray/praise: use `active` + counts (not local-only state)
- [ ] Group invite flow: invite = pending; user must accept / join
- [ ] Wire invite list filters (`status=pending|accepted|rejected`)
- [ ] Wire join-request approve/reject for approval groups
- [ ] Friends incoming/outgoing + cancel + remove
- [ ] Notifications: unread badge, cursor pagination, settings, mute

---

## Notes

1. Invite ab member auto-add **nahi** karta — pending invite create hota hai.
2. `POST /api/groups/:id/join` agar pending invite ho to accept bhi mark kar deta hai.
3. Comment/post reactions toggle hain — dubara hit = off.
4. Blocked users search / suggestions / mutual friends se filter hote hain.
