# Admin Users API

Manage app users from the admin dashboard.

**Base path:** `/api/admin`  
**Auth:** `Authorization: Bearer <admin-token>` (all endpoints below)

Dashboard page: `/users`  
Blocked Users page: `/blocked-users`

---

## Shared list response

Paginated list endpoints return:

```json
{
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  },
  "stats": { ... }
}
```

### Common query keys (lists)

| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `page` | number | No | `1` | Page number. Min `1`. |
| `limit` | number | No | `20` | Page size. Min `1`, max `100`. |
| `search` | string | No | — | Case-insensitive text search. |

---

## List Users

**Endpoint:** `GET /api/admin/users`  
**Payload:** none

### Extra query keys

| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `status` | string | No | — | `active` \| `inactive` \| `blocked` (case-insensitive) |

### Response `200`

| Key | Type | Description |
|-----|------|-------------|
| `data` | array | User rows (see below) |
| `meta` | object | Pagination |
| `stats.totalUsers` | number | All non-admin users |
| `stats.activeUsers` | number | Active users |
| `stats.premiumUsers` | number | `0` until billing connected |
| `stats.blockedUsers` | number | Blocked users |

### User list item (`data[]`)

| Key | Type | Description |
|-----|------|-------------|
| `id` | string | User id |
| `name` | string | Display name |
| `email` | string | Email |
| `plan` | string | `"Free"` (until billing) |
| `status` | string | `Active` \| `Inactive` \| `Blocked` |
| `avatar` | string | Avatar URL (may be `""`) |
| `joinedAt` | string | e.g. `"Mar 03, 2026"` |
| `country` | string | Country or `"—"` |
| `prayers` | number | User's post count |

**Example:**
```http
GET /api/admin/users?status=active&search=john&page=1&limit=20
Authorization: Bearer <token>
```

---

## Search Users (picker)

For pastor/leader pickers in create church/group modals.

**Endpoint:** `GET /api/admin/users/search`  
**Payload:** none

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `q` | string | Yes | Search by `name` or `email`. Empty → `{ "users": [] }` |

### Response `200`

```json
{
  "users": [
    {
      "id": "665c1a2b3c4d5e6f7a8b9c0d",
      "name": "John Smith",
      "email": "john@example.com",
      "avatar": "https://..."
    }
  ]
}
```

Blocked users and admin accounts are excluded.

---

## Get User

**Endpoint:** `GET /api/admin/users/:id`  
**Payload:** none

### Response `200`

```json
{
  "user": {
    "id": "...",
    "name": "Sarah Johnson",
    "email": "sarah@mail.com",
    "avatar": "",
    "coverImage": "",
    "bio": "",
    "phone": "",
    "location": "Dallas, TX, USA",
    "city": "Dallas",
    "state": "TX",
    "country": "USA",
    "role": "User",
    "plan": "Free",
    "status": "Active",
    "userId": "...",
    "loginType": "email",
    "subscription": "Free",
    "lastActive": "Mar 03, 2026",
    "joinedDate": "Jan 15, 2026",
    "prayerStreak": 0,
    "counts": {
      "prayerRequests": 12,
      "prayersGiven": 0,
      "groupsJoined": 3,
      "churchesFollowed": 2,
      "followers": 45,
      "following": 30
    },
    "recentActivity": [
      {
        "id": "...",
        "type": "Prayer Request",
        "text": "Please pray for...",
        "date": "Mar 02, 2026"
      }
    ]
  }
}
```

**Errors:**
- `400` `{ "message": "Invalid id" }`
- `404` `{ "message": "User not found" }`

---

## Update User

**Endpoint:** `PATCH /api/admin/users/:id`

### Payload (all optional)

```json
{
  "name": "Sarah Johnson",
  "email": "sarah@mail.com",
  "status": "active",
  "country": "USA",
  "city": "Dallas",
  "bio": "Praying daily."
}
```

`status`: `active` \| `inactive` \| `blocked` (case-insensitive)

### Response `200`

```json
{ "user": { ... } }
```

Same shape as **Get User**.

---

## Block User

**Endpoint:** `POST /api/admin/users/:id/block`

### Payload (optional)

```json
{ "reason": "Spam / harassment" }
```

Default reason: `"Policy Violation"`

### Response `200`

```json
{
  "message": "User blocked",
  "id": "...",
  "status": "Blocked"
}
```

---

## Unblock User

**Endpoint:** `POST /api/admin/users/:id/unblock`  
**Payload:** none

### Response `200`

```json
{
  "message": "User unblocked",
  "id": "...",
  "status": "Active"
}
```

---

## Delete User

**Endpoint:** `DELETE /api/admin/users/:id`  
**Payload:** none

### Response `200`

```json
{
  "message": "User deleted",
  "id": "..."
}
```

Admin accounts cannot be deleted via this route.

---

# Blocked Users

**Endpoint:** `GET /api/admin/blocked-users`  
**Payload:** none

Uses the same pagination query keys as **List Users** (`page`, `limit`, `search`).

Search matches `name` and `email`.

### Response `200`

| Key | Type | Description |
|-----|------|-------------|
| `data` | array | Blocked user rows |
| `meta` | object | Pagination |

### Blocked user item (`data[]`)

| Key | Type | Description |
|-----|------|-------------|
| `id` | string | User id |
| `name` | string | Display name |
| `email` | string | Email |
| `avatar` | string | Avatar URL |
| `reason` | string | Block reason |
| `blockedBy` | string | `"Admin"` |
| `reports` | number | Report count (`0` for now) |
| `blockedAt` | string | e.g. `"Mar 03, 2026"` |
| `expiresAt` | string | `"Permanent"` |
| `status` | string | `"Blocked"` |

**Example:**
```http
GET /api/admin/blocked-users?search=sarah&page=1&limit=20
Authorization: Bearer <token>
```

---

## Dashboard screens → APIs

| Screen | API |
|--------|-----|
| `/users` list | `GET /api/admin/users` |
| `/users` edit | `PATCH /api/admin/users/:id` |
| `/users` block | `POST /api/admin/users/:id/block` |
| `/users` unblock | `POST /api/admin/users/:id/unblock` |
| `/users` delete | `DELETE /api/admin/users/:id` |
| Create church/group picker | `GET /api/admin/users/search?q=` |
| `/blocked-users` | `GET /api/admin/blocked-users` |
