# New APIs — Frontend Integration Guide

> Saare naye APIs jo abhi banaye gaye hain — App (delete account, invite members) + Dashboard (events, push notifications, settings).

---

## Table of contents

1. [App — Delete Account](#1-app--delete-account)
2. [App — Invite Members (friend count)](#2-app--invite-members-friend-count)
3. [Dashboard — Events](#3-dashboard--events)
4. [Dashboard — Push Notifications](#4-dashboard--push-notifications)
5. [Dashboard — Admin Settings](#5-dashboard--admin-settings)

---

# 1. App — Delete Account

Soft delete — account permanently disable ho jata hai but DB mein rehta hai.

**Base path:** `/api/auth`

### POST /api/auth/delete-account

**Headers:**
```http
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:** none required

**Response** `200`
```json
{
  "message": "Account deleted successfully"
}
```

**Errors:**
| Status | Meaning |
|--------|---------|
| `401` | Not authenticated |
| `400` | Account already deleted |

**Frontend flow:**
1. Settings screen pe "Delete Account" button
2. Confirmation dialog dikhao ("Are you sure? This cannot be undone.")
3. Confirm pe call karo `POST /api/auth/delete-account`
4. Success pe local tokens clear karo (`AsyncStorage` / `SecureStore`)
5. Navigate to `LoginScreen` or `RegisterScreen`

**After delete:**
- User login nahi kar paega
- Friends list se hat jayega
- Groups se invite candidates mein nahi aayega
- Posts/comments etc. remain (soft delete only)

---

# 2. App — Invite Members (friend count)

Updated endpoint — ab har user ka `friendCount` bhi aata hai.

**Base path:** `/api/groups`

### GET /api/groups/:groupId/invite-candidates

**Headers:**
```http
Authorization: Bearer <token>
```

**Query params:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `q` | string | No | Search by name or email |

**Response** `200`
```json
{
  "users": [
    {
      "id": "665b...",
      "name": "John Smith",
      "avatar": "https://...",
      "email": "john@example.com",
      "friendCount": 12
    },
    {
      "id": "665c...",
      "name": "Sarah Lee",
      "avatar": "",
      "email": "sarah@example.com",
      "friendCount": 0
    }
  ]
}
```

**New field:**
| Field | Type | Description |
|-------|------|-------------|
| `friendCount` | number | Kitne accepted friends hain is user ke |

**Frontend:**
- Har user row mein `friendCount` badge dikhao (e.g. "12 friends")
- `friendCount === 0` ho to mat dikhao
- Color: teal (#79AEB8) ya theme ka accent color

---

# 3. Dashboard — Events

Church-hosted gatherings (online, physical, ya hybrid).

**Base path:** `/api/admin`
**Auth:** `Authorization: Bearer <admin-token>`
**Dashboard page:** `/events`

---

### Screens → APIs

| Dashboard Screen | API |
|------------------|-----|
| Events list page | `GET /api/admin/events` |
| Create event form | `POST /api/admin/events` |
| Edit event form | `PATCH /api/admin/events/:id` |
| Event detail | `GET /api/admin/events/:id` |
| Cancel event | `POST /api/admin/events/:id/cancel` |
| Delete event | `DELETE /api/admin/events/:id` |

---

### Event object

```json
{
  "id": "abc123",
  "title": "Sunday Worship Service",
  "description": "Join us for worship",
  "type": "Hybrid",
  "status": "Upcoming",
  "hostName": "Pastor John",
  "hostEmail": "john@church.com",
  "avatar": "",
  "churchId": "xyz789",
  "churchName": "Grace Community",
  "location": "Dallas, USA",
  "eventDate": "2026-03-10T10:00:00.000Z",
  "eventEndDate": "",
  "attendees": 0,
  "registrations": 0,
  "maxAttendees": 500,
  "meetingUrl": "",
  "coverImage": "",
  "tags": ["worship", "sunday"],
  "createdAt": "Mar 10, 2026",
  "updatedAt": "Mar 10, 2026"
}
```

**Type values:** `Online` | `Physical` | `Hybrid`
**Status values:** `Upcoming` | `Live` | `Completed` | `Cancelled`

---

### GET /api/admin/events

**Query:**
| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number (default 1) |
| `limit` | number | Items per page (default 20) |
| `search` | string | Search by title/host |
| `status` | string | Filter by status |
| `type` | string | Filter by type |

**Response** `200`
```json
{
  "data": [ /* Event objects */ ],
  "meta": { "page": 1, "limit": 20, "total": 45, "totalPages": 3 }
}
```

---

### POST /api/admin/events

**Body:**
```json
{
  "title": "Youth Fellowship Meetup",
  "description": "Monthly youth gathering",
  "type": "Online",
  "hostName": "Sarah Johnson",
  "hostEmail": "sarah@church.com",
  "churchName": "Hope Prayer Center",
  "location": "Zoom",
  "eventDate": "2026-04-15T19:00:00Z",
  "eventEndDate": "2026-04-15T21:00:00Z",
  "maxAttendees": 200,
  "meetingUrl": "https://zoom.us/j/123456",
  "tags": ["youth", "fellowship"]
}
```

**Response** `201` — created event object

---

### PATCH /api/admin/events/:id

Send any subset of fields to update.

**Response** `200` — updated event object

---

### DELETE /api/admin/events/:id

**Response** `200`
```json
{ "message": "Event deleted" }
```

---

### POST /api/admin/events/:id/cancel

Sets status to `Cancelled`.

**Response** `200` — updated event with `status: "Cancelled"`

---

# 4. Dashboard — Push Notifications

Scheduled or immediate messages to user devices.

**Base path:** `/api/admin`
**Auth:** `Authorization: Bearer <admin-token>`
**Dashboard page:** `/push-notifications`

> **Note:** FCM/APNs actual delivery abhi stub hai. Send sirf status update karta hai.

---

### Screens → APIs

| Dashboard Screen | API |
|------------------|-----|
| Push notifications list | `GET /api/admin/push-notifications` |
| Create notification form | `POST /api/admin/push-notifications` |
| Edit notification form | `PATCH /api/admin/push-notifications/:id` |
| Notification detail | `GET /api/admin/push-notifications/:id` |
| Send now | `POST /api/admin/push-notifications/:id/send` |
| Delete notification | `DELETE /api/admin/push-notifications/:id` |

---

### Push Notification object

```json
{
  "id": "abc123",
  "title": "Daily Prayer Reminder",
  "message": "Take a moment to pray for someone today.",
  "audience": "All Users",
  "status": "Sent",
  "recipients": 3782,
  "opened": 1840,
  "clicked": 620,
  "deepLink": "/prayer/new",
  "scheduledAt": "",
  "sentAt": "2026-03-10T10:00:00.000Z",
  "sentBy": "Admin",
  "createdAt": "Mar 10, 2026",
  "updatedAt": "Mar 10, 2026"
}
```

**Status values:** `Draft` | `Scheduled` | `Sent` | `Failed`
**Audience values:** `All Users` | `Subscribed Users` | `Church Owners` | `Church Members` | `Group Members` | `Inactive Users`

---

### GET /api/admin/push-notifications

**Query:**
| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number (default 1) |
| `limit` | number | Items per page (default 20) |
| `search` | string | Search by title/message |
| `status` | string | Filter by status |
| `audience` | string | Filter by audience |

**Response** `200`
```json
{
  "data": [ /* PushNotification objects */ ],
  "meta": { "page": 1, "limit": 20, "total": 12, "totalPages": 1 }
}
```

---

### POST /api/admin/push-notifications

**Body:**
```json
{
  "title": "Weekend Prayer Event",
  "message": "Join us this Saturday for a special prayer session.",
  "audience": "Subscribed Users",
  "scheduledAt": "2026-04-05T08:00:00Z",
  "deepLink": "/events/abc123"
}
```

- `scheduledAt` diya to status = `Scheduled`
- `scheduledAt` nahi diya to status = `Draft`

**Response** `201` — created notification object

---

### PATCH /api/admin/push-notifications/:id

Send any subset of fields. Sirf `Draft` or `Scheduled` notifications edit ho sakti hain.

**Response** `200` — updated notification object

---

### DELETE /api/admin/push-notifications/:id

**Response** `200`
```json
{ "message": "Push notification deleted" }
```

---

### POST /api/admin/push-notifications/:id/send

Notification ko `Sent` mark karta hai with `sentAt` timestamp.

**Response** `200` — updated notification with `status: "Sent"`

---

# 5. Dashboard — Admin Settings

App-wide configuration as key-value pairs by category.

**Base path:** `/api/admin`
**Auth:** `Authorization: Bearer <admin-token>`
**Dashboard page:** `/settings`

---

### Screens → APIs

| Dashboard Screen | API |
|------------------|-----|
| Settings page (all) | `GET /api/admin/settings` |
| Settings by category | `GET /api/admin/settings?category=notifications` |
| Update settings form | `PATCH /api/admin/settings` |
| Notification settings | `GET /api/admin/settings/notifications` |
| Update notification settings | `PATCH /api/admin/settings/notifications` |

---

### Categories

| Category | Description |
|----------|-------------|
| `general` | Site name, maintenance mode, upload limits |
| `notifications` | Push/email toggles, quiet hours |
| `security` | Password policy, 2FA, session timeout |
| `payments` | Gateway config, currency, fees |
| `appearance` | Theme, logo, colors |

---

### GET /api/admin/settings

**Query:**
| Param | Type | Description |
|-------|------|-------------|
| `category` | string | Filter by category (optional) |

**Response** `200`
```json
{
  "siteName": "INeedPrayer",
  "maintenanceMode": false,
  "maxUploadSizeMB": 10,
  "defaultLanguage": "en"
}
```

---

### GET /api/admin/settings?category=notifications

**Response** `200`
```json
{
  "pushEnabled": true,
  "emailNotifications": false,
  "quietHoursStart": "22:00",
  "quietHoursEnd": "07:00"
}
```

---

### PATCH /api/admin/settings

**Body:**
```json
{
  "category": "general",
  "siteName": "INeedPrayer",
  "maintenanceMode": false,
  "maxUploadSizeMB": 10
}
```

`category` field batata hai ki kaunsi category mein keys update Karni hain. Baaki sab fields key-value pairs hain jo upsert honge.

**Response** `200` — updated settings object

---

### GET /api/admin/settings/notifications

Shortcut for `GET /api/admin/settings?category=notifications`.

---

### PATCH /api/admin/settings/notifications

**Body:**
```json
{
  "pushEnabled": true,
  "emailNotifications": false,
  "quietHoursStart": "22:00",
  "quietHoursEnd": "07:00"
}
```

All fields `notifications` category ke under upsert hote hain.

**Response** `200` — updated notification settings
