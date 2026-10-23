# Admin Content API

Moderate posts, prayer requests, and praises from the admin dashboard.

**Base path:** `/api/admin`  
**Auth:** `Authorization: Bearer <admin-token>` (all endpoints below)

Dashboard pages:
- `/content` — all content
- `/prayer-requests` — prayer posts only
- `/praises` — praise posts only

---

## Shared list response

```json
{
  "data": [ ... ],
  "meta": { "page": 1, "limit": 20, "total": 200, "totalPages": 10 },
  "stats": { "total": 200, "published": 180, "reported": 15, "hidden": 5 }
}
```

### Common query keys

| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `page` | number | No | `1` | Page number |
| `limit` | number | No | `20` | Page size (max `100`) |
| `search` | string | No | — | Search post `text` |
| `type` | string | No | — | `Prayer Request` \| `Praise` \| `Post` (all map to prayer or praise) |
| `status` | string | No | — | `Published` \| `Reported` \| `Hidden` |

---

## List Content

**Endpoint:** `GET /api/admin/content`  
**Payload:** none

### Content list item (`data[]`)

| Key | Type | Description |
|-----|------|-------------|
| `id` | string | Post id |
| `authorName` | string | Author display name |
| `authorEmail` | string | Author email |
| `avatar` | string | Author avatar URL |
| `type` | string | `Prayer Request` \| `Praise` |
| `content` | string | Post text |
| `comments` | number | Comment count |
| `praises` | number | Praise reactions |
| `prays` | number | Pray reactions |
| `reports` | number | Report count for this post |
| `status` | string | `Published` \| `Reported` \| `Hidden` |
| `createdAt` | string | e.g. `"Mar 03, 2026"` |

**Example:**
```http
GET /api/admin/content?type=Prayer Request&status=Reported&search=healing
Authorization: Bearer <token>
```

---

## List Prayer Requests

**Endpoint:** `GET /api/admin/prayer-requests`  
**Payload:** none

Same query keys and response shape as **List Content**, but filtered to prayer posts only (`mode: prayer`).

---

## List Praises

**Endpoint:** `GET /api/admin/praises`  
**Payload:** none

Same query keys and response shape as **List Content**, but filtered to praise posts only (`mode: praise`).

---

## Get Content

**Endpoint:** `GET /api/admin/content/:id`  
**Payload:** none

### Response `200`

```json
{
  "content": {
    "id": "...",
    "authorName": "Sarah Johnson",
    "authorEmail": "sarah@mail.com",
    "avatar": "https://...",
    "type": "Prayer Request",
    "content": "Please pray for my family...",
    "image": "https://...",
    "comments": 18,
    "praises": 42,
    "prays": 128,
    "reports": 2,
    "status": "Published",
    "createdAt": "Mar 03, 2026",
    "commentsList": [
      {
        "id": "...",
        "userName": "John Smith",
        "userEmail": "john@mail.com",
        "avatar": "",
        "content": "Praying for you!",
        "createdAt": "Mar 03, 2026"
      }
    ]
  }
}
```

**Errors:**
- `400` `{ "message": "Invalid id" }`
- `404` `{ "message": "Content not found" }`

---

## Update Content Status

Hide or restore content (moderation).

**Endpoint:** `PATCH /api/admin/content/:id`

### Payload

```json
{ "status": "Hidden" }
```

Allowed values: `Published` \| `Reported` \| `Hidden`

### Response `200`

```json
{ "id": "...", "status": "Hidden", "message": "Content updated" }
```

**Errors:**
- `400` `{ "message": "Invalid status" }`

---

## Delete Content

**Endpoint:** `DELETE /api/admin/content/:id`  
**Payload:** none

Also deletes all comments on the post.

### Response `200`

```json
{ "message": "Content deleted", "id": "..." }
```

---

## Dashboard screens → APIs

| Screen | API |
|--------|-----|
| `/content` | `GET /api/admin/content` |
| `/prayer-requests` | `GET /api/admin/prayer-requests` |
| `/praises` | `GET /api/admin/praises` |
| View post modal | `GET /api/admin/content/:id` |
| Hide content | `PATCH /api/admin/content/:id` → `{ "status": "Hidden" }` |
| Restore content | `PATCH /api/admin/content/:id` → `{ "status": "Published" }` |
| Delete | `DELETE /api/admin/content/:id` |
