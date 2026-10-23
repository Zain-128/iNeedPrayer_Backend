# Admin Announcements API

**Base path:** `/api/admin`  
**Auth:** `Authorization: Bearer <admin-token>`

Dashboard page: `/announcements`

Publishing creates **in-app notifications** for eligible users (`kind: "announcement"`).

---

## Shared list response

```json
{
  "data": [ /* announcement items */ ],
  "meta": { "page": 1, "limit": 20, "total": 12, "totalPages": 1 },
  "stats": {
    "total": 12,
    "published": 5,
    "draft": 4,
    "scheduled": 2,
    "archived": 1
  }
}
```

### Query params

| Key | Type | Description |
|-----|------|-------------|
| `page` | number | Default `1` |
| `limit` | number | Default `20`, max `100` |
| `search` | string | Matches `title`, `summary`, `content` |
| `status` | string | `Draft` \| `Published` \| `Scheduled` \| `Archived` \| `All` |
| `priority` | string | `Low` \| `Medium` \| `High` \| `Urgent` \| `All` |

### Announcement object

| Key | Type | Description |
|-----|------|-------------|
| `id` | string | Announcement id |
| `title` | string | Title |
| `summary` | string | Short blurb (used in notification body) |
| `content` | string | Full body |
| `priority` | string | `Low` \| `Medium` \| `High` \| `Urgent` |
| `audience` | string | See audience values below |
| `status` | string | `Draft` \| `Published` \| `Scheduled` \| `Archived` |
| `createdBy` | string | Admin display name |
| `createdByEmail` | string | Admin email |
| `avatar` | string | Admin avatar URL |
| `views` | number | Views counter |
| `likes` | number | Likes counter |
| `comments` | number | Comments counter |
| `scheduledAt` | string | ISO datetime or `""` |
| `publishedAt` | string | ISO datetime or `""` |
| `createdAt` | string | Display date |
| `updatedAt` | string | Display date |

**Audience:** `All Users` \| `Church Owners` \| `Church Members` \| `Group Members` \| `Subscribed Users`

---

## List announcements

`GET /api/admin/announcements`

```http
GET /api/admin/announcements?status=Draft&priority=High&page=1&limit=20
Authorization: Bearer <token>
```

---

## Get announcement

`GET /api/admin/announcements/:id`

**Response `200`:** announcement object (same fields as list item).

**Errors:** `400` invalid id · `404` not found

---

## Create announcement

`POST /api/admin/announcements`

```json
{
  "title": "New Prayer Features",
  "summary": "New features now available",
  "content": "Full announcement text...",
  "priority": "High",
  "audience": "All Users",
  "status": "Draft",
  "scheduledAt": "2026-03-10T12:00:00Z"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `title` | **Yes** | Non-empty |
| `summary` | No | |
| `content` | No | |
| `priority` | No | Default `Medium` |
| `audience` | No | Default `All Users` |
| `status` | No | Default `Draft`; if `scheduledAt` set → `Scheduled` |
| `scheduledAt` | No | ISO datetime |

**Response `201`:** announcement object

---

## Update announcement

`PATCH /api/admin/announcements/:id`

Any of: `title`, `summary`, `content`, `priority`, `audience`, `status`, `scheduledAt`

**Response `200`:** updated announcement

---

## Delete announcement

`DELETE /api/admin/announcements/:id`

```json
{ "message": "Deleted", "id": "..." }
```

---

## Publish announcement

`POST /api/admin/announcements/:id/publish`

- Sets `status` → `Published`, sets `publishedAt`
- Inserts in-app `Notification` rows for eligible users
- Idempotent guard: already published → `409`

**Response `200`:**
```json
{
  "id": "...",
  "title": "...",
  "status": "Published",
  "notificationsSent": 120
}
```

---

## Archive announcement

`POST /api/admin/announcements/:id/archive`

Sets `status` → `Archived`.

**Response `200`:** announcement object

---

## Dashboard map

| UI action | API |
|-----------|-----|
| List | `GET /announcements` |
| Create | `POST /announcements` |
| View / edit | `GET` / `PATCH /announcements/:id` |
| Publish | `POST /announcements/:id/publish` |
| Archive | `POST /announcements/:id/archive` |
| Delete | `DELETE /announcements/:id` |
