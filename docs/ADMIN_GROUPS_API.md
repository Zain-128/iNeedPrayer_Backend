# Admin Groups API

Manage prayer groups from the admin dashboard.

**Base path:** `/api/admin`  
**Auth:** `Authorization: Bearer <admin-token>` (all endpoints below)

Dashboard page: `/groups`  
Group profile: `/group-profile/[id]`

> Note: This is the **admin** API (`/api/admin/groups`). The mobile app uses `/api/groups` — see [GROUPS_API.md](./GROUPS_API.md).

---

## Shared list response

```json
{
  "data": [ ... ],
  "meta": { "page": 1, "limit": 20, "total": 30, "totalPages": 2 },
  "stats": { "total": 30, "active": 25, "pending": 3, "suspended": 2 }
}
```

### Common query keys

| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `page` | number | No | `1` | Page number |
| `limit` | number | No | `20` | Page size (max `100`) |
| `search` | string | No | — | Matches `name`, `description`, `category` |
| `status` | string | No | — | `Active` \| `Pending` \| `Suspended` |
| `privacy` | string | No | — | `Public` \| `Private` |

---

## List Groups

**Endpoint:** `GET /api/admin/groups`  
**Payload:** none

### Group list item (`data[]`)

| Key | Type | Description |
|-----|------|-------------|
| `id` | string | Group id |
| `name` | string | Group name |
| `category` | string | e.g. `"Community"` |
| `ownerName` | string | Creator/owner name |
| `ownerEmail` | string | Creator email |
| `privacy` | string | `Public` \| `Private` |
| `members` | number | Member count |
| `posts` | number | Post count |
| `reports` | number | Report count |
| `status` | string | `Active` \| `Pending` \| `Suspended` |
| `image` | string | Cover image URL |
| `createdAt` | string | e.g. `"Mar 03, 2026"` |

**Example:**
```http
GET /api/admin/groups?status=Active&privacy=Public&search=prayer
Authorization: Bearer <token>
```

---

## Get Group

**Endpoint:** `GET /api/admin/groups/:id`  
**Payload:** none

### Response `200`

```json
{
  "group": {
    "id": "...",
    "name": "Prayer Warriors",
    "description": "Daily prayer group",
    "category": "Community",
    "ownerName": "Sarah Johnson",
    "ownerEmail": "sarah@mail.com",
    "privacy": "Public",
    "members": 48,
    "posts": 120,
    "reports": 0,
    "status": "Active",
    "image": "https://...",
    "requiresApproval": false,
    "createdAt": "Mar 01, 2026",
    "recentPosts": [
      {
        "id": "...",
        "title": "Please pray for my family...",
        "author": "John Smith",
        "date": "Mar 03, 2026",
        "comments": 5
      }
    ]
  }
}
```

**Errors:**
- `400` `{ "message": "Invalid id" }`
- `404` `{ "message": "Group not found" }`

---

## Create Group

**Endpoint:** `POST /api/admin/groups`

### Payload

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `name` | string | Yes | Group name |
| `description` | string | No | Description |
| `category` | string | No | Default `"Community"` |
| `privacy` | string | No | `Public` (default) \| `Private` |
| `status` | string | No | `Active` (default) \| `Pending` \| `Suspended` |
| `coverImage` | string | No | Cover URL (alias: `image`) |
| `requiresApproval` | boolean | No | Join approval required |
| `leaderEmail` | string | No | If found, user becomes group owner instead of admin |

```json
{
  "name": "Morning Prayer Circle",
  "description": "Join us every morning",
  "category": "Prayer",
  "privacy": "Public",
  "status": "Active",
  "coverImage": "https://cdn.example.com/group.jpg",
  "leaderEmail": "leader@mail.com"
}
```

### Response `201`

```json
{ "group": { ... } }
```

**Errors:**
- `400` `{ "message": "name is required" }`

---

## Update Group

**Endpoint:** `PATCH /api/admin/groups/:id`

Same fields as **Create Group** (except `leaderEmail`) — all optional.

### Response `200`

```json
{ "group": { ... } }
```

---

## Suspend Group

**Endpoint:** `POST /api/admin/groups/:id/suspend`  
**Payload:** none

### Response `200`

```json
{ "id": "...", "status": "Suspended", "message": "Group suspended" }
```

---

## Unsuspend Group

**Endpoint:** `POST /api/admin/groups/:id/unsuspend`  
**Payload:** none

Sets status to `Active`.

### Response `200`

```json
{ "id": "...", "status": "Active", "message": "Group active" }
```

---

## Delete Group

**Endpoint:** `DELETE /api/admin/groups/:id`  
**Payload:** none

### Response `200`

```json
{ "message": "Group deleted", "id": "..." }
```

---

## Dashboard screens → APIs

| Screen | API |
|--------|-----|
| `/groups` list | `GET /api/admin/groups` |
| `/groups` create | `POST /api/admin/groups` |
| `/group-profile/[id]` | `GET /api/admin/groups/:id` |
| Edit group | `PATCH /api/admin/groups/:id` |
| Suspend | `POST /api/admin/groups/:id/suspend` |
| Unsuspend | `POST /api/admin/groups/:id/unsuspend` |
| Delete | `DELETE /api/admin/groups/:id` |
