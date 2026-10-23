# Admin Live Streams API

Manage live stream sessions from the admin dashboard.

**Base path:** `/api/admin`  
**Auth:** `Authorization: Bearer <admin-token>` (all endpoints below)

Dashboard page: `/live-streams`

---

## Shared list response

```json
{
  "data": [ ... ],
  "meta": { "page": 1, "limit": 20, "total": 15, "totalPages": 1 }
}
```

### Common query keys

| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `page` | number | No | `1` | Page number |
| `limit` | number | No | `20` | Page size (max `100`) |
| `search` | string | No | — | Search stream `title` |
| `status` | string | No | — | `Live` \| `Ended` |

> UI may show `Scheduled` / `Reported` — backend currently only stores `live` and `ended`.

---

## List Live Streams

**Endpoint:** `GET /api/admin/live-streams`  
**Payload:** none

### Stream list item (`data[]`)

| Key | Type | Description |
|-----|------|-------------|
| `id` | string | Session id |
| `title` | string | Stream title |
| `hostName` | string | Host display name |
| `hostEmail` | string | Host email |
| `avatar` | string | Host avatar URL |
| `type` | string | Always `"Video"` |
| `churchName` | string | Associated church or `"—"` |
| `viewers` | number | Viewer count |
| `duration` | string | e.g. `"42 min"` |
| `reports` | number | Report count (`0` for now) |
| `status` | string | `Live` \| `Ended` |
| `scheduledAt` | string | Start date, e.g. `"Mar 03, 2026"` |

**Example:**
```http
GET /api/admin/live-streams?status=Live&search=prayer
Authorization: Bearer <token>
```

---

## Get Live Stream

**Endpoint:** `GET /api/admin/live-streams/:id`  
**Payload:** none

### Response `200`

```json
{
  "stream": {
    "id": "...",
    "title": "Morning Prayer Room",
    "hostName": "Pastor John Miller",
    "hostEmail": "john@grace.com",
    "avatar": "https://...",
    "type": "Video",
    "churchName": "Grace Community Church",
    "viewers": 248,
    "status": "Live",
    "scheduledAt": "Mar 03, 2026",
    "participants": []
  }
}
```

`participants` is empty until participant tracking is added.

**Errors:**
- `400` `{ "message": "Invalid id" }`
- `404` `{ "message": "Live stream not found" }`

---

## Force End Live Stream

**Endpoint:** `POST /api/admin/live-streams/:id/end`  
**Payload:** none

Admin can end an active stream. Sets `status` to `ended` and records `endedAt`.

### Response `200`

```json
{ "id": "...", "status": "Ended", "message": "Live stream ended" }
```

If already ended:

```json
{ "id": "...", "status": "Ended", "message": "Already ended" }
```

---

## Dashboard screens → APIs

| Screen | API |
|--------|-----|
| `/live-streams` list | `GET /api/admin/live-streams` |
| View stream modal | `GET /api/admin/live-streams/:id` |
| Force end stream | `POST /api/admin/live-streams/:id/end` |
