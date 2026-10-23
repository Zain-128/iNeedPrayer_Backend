# Admin Notifications API

**Base path:** `/api/admin`  
**Auth:** `Authorization: Bearer <admin-token>`

Two separate feeds:

1. **Top bar activity** — platform events for admins (`/activity-notifications`)
2. **Broadcast page** — ONLY notifications sent by admin (`/notifications`)

---

# 1) Top-bar activity notifications

**Endpoint:** `GET /api/admin/activity-notifications`

### Query

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `page` | number | `1` | Page |
| `limit` | number | `20` | Max `100` |
| `unreadOnly` | boolean | — | `true` = unread for this admin |
| `type` | string | — | Filter by activity type |
| `search` | string | — | Search title / message / actor |

### Activity types

| Type | When |
|------|------|
| `user_registered` | New user signup (email or social) |
| `prayer_created` | New prayer post |
| `praise_created` | New praise post |
| `comment_created` | User commented on a post |
| `content_reported` | Post/comment reported |
| `user_reported` | User reported |
| `group_reported` | Group reported |
| `church_reported` | Church reported |
| `live_reported` | Live stream reported |
| `church_created` | Church created (verified) |
| `church_pending` | Church awaiting verification |
| `group_created` | New group |
| `withdrawal_created` | Withdrawal request |
| `moderation_required` | Needs admin action |

### Response `200`

```json
{
  "data": [
    {
      "id": "...",
      "type": "user_registered",
      "title": "New user registered",
      "message": "Jane Doe joined the platform",
      "refType": "user",
      "refId": "...",
      "actorId": "...",
      "actorName": "Jane Doe",
      "actorAvatar": "",
      "meta": {},
      "read": false,
      "createdAt": "2026-09-03T...",
      "time": "Sep 03, 2026"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 },
  "unreadCount": 7
}
```

### Mark read

```http
POST /api/admin/activity-notifications/:id/read
POST /api/admin/activity-notifications/read-all
```

---

# 2) Broadcast notifications (admin-sent only)

Dashboard page: `/notifications`

These endpoints use the **AdminBroadcast** collection — not every in-app user notification.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications` | List admin broadcasts |
| POST | `/notifications` | Send broadcast to all eligible users |
| DELETE | `/notifications/:id` | Delete broadcast + all fan-out rows |

### List item

| Key | Description |
|-----|-------------|
| `id` | Broadcast id |
| `title` / `message` | Content |
| `type` | `"In-App"` |
| `audience` | e.g. `"All Users"` |
| `sentBy` | Admin name |
| `recipients` | Fan-out count |
| `opened` | How many users marked read |
| `status` | `"Sent"` / `"Failed"` |
| `kind` | e.g. `"announcement"` |

### Create

```json
{
  "title": "Weekly Prayer Reminder",
  "message": "Join us tonight at 8 PM.",
  "audience": "All Users",
  "kind": "announcement"
}
```

**Response `201`:**
```json
{
  "id": "...",
  "sent": 120,
  "message": "Notification sent",
  "audience": "All Users"
}
```

Creates one `AdminBroadcast` + one `Notification` per eligible user (`refType: "admin"`, `refId: <broadcastId>`).

---

## Dashboard mapping

| UI | API |
|----|-----|
| Top-bar bell | `GET /api/admin/activity-notifications` |
| Notifications page list | `GET /api/admin/notifications` |
| Send notification | `POST /api/admin/notifications` |
| Delete broadcast | `DELETE /api/admin/notifications/:id` |
