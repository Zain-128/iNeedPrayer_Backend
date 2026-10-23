# Admin Reports API

Review and resolve user reports from the admin dashboard.

**Status:** Ready (Mongo-backed).

**Base path:** `/api/admin`  
**Auth:** `Authorization: Bearer <admin-token>` (all endpoints below)

Dashboard page: `/reports`

---

## Shared list response

```json
{
  "data": [ ... ],
  "meta": { "page": 1, "limit": 20, "total": 45, "totalPages": 3 },
  "stats": { "total": 45, "pending": 12, "resolved": 30, "critical": 0 }
}
```

### Common query keys

| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `page` | number | No | `1` | Page number |
| `limit` | number | No | `20` | Page size (max `100`) |
| `search` | string | No | — | Search `reasonKey` or `otherText` |
| `status` | string | No | — | `Pending` \| `Under Review` \| `Resolved` \| `Dismissed` |
| `type` | string | No | — | Report type label (see below) |

### Report type filter values (`type`)

| `type` value | Internal target |
|--------------|-----------------|
| `Post` | post |
| `Comment` | comment |
| `Group` | group |
| `User` | user |
| `Church` | church |
| `Prayer Request` | prayer |
| `Praise` | praise |
| `Live Stream` | live |

---

## List Reports

**Endpoint:** `GET /api/admin/reports`  
**Payload:** none

### Report list item (`data[]`)

| Key | Type | Description |
|-----|------|-------------|
| `id` | string | Report id |
| `reportId` | string | Display id, e.g. `"RPT-A1B2"` |
| `type` | string | `Post`, `Comment`, `Group`, etc. |
| `itemTitle` | string | Snippet of reported content |
| `reason` | string | Reason key / label |
| `description` | string | Extra text from reporter |
| `reportedBy` | string | Reporter name |
| `reportedByEmail` | string | Reporter email |
| `ownerName` | string | Content owner name |
| `ownerEmail` | string | Content owner email |
| `avatar` | string | Reporter avatar |
| `reportsCount` | number | Always `1` per row |
| `status` | string | `Pending` \| `Under Review` \| `Resolved` \| `Dismissed` |
| `createdAt` | string | e.g. `"Mar 03, 2026"` |
| `actionHistory` | array | Moderation actions (see below) |

### Action history item (`actionHistory[]`)

| Key | Type | Description |
|-----|------|-------------|
| `id` | string | Action id |
| `action` | string | e.g. `"Resolved"`, `"Dismissed"`, `"Suspended content"` |
| `performedBy` | string | Admin name |
| `date` | string | Action date |
| `note` | string | Optional note |

**Example:**
```http
GET /api/admin/reports?status=Pending&type=Post&search=spam
Authorization: Bearer <token>
```

---

## Get Report

**Endpoint:** `GET /api/admin/reports/:id`  
**Payload:** none

### Response `200`

```json
{
  "report": {
    "id": "...",
    "reportId": "RPT-A1B2",
    "type": "Post",
    "itemTitle": "Please pray for...",
    "reason": "spam",
    "description": "This looks like spam",
    "reportedBy": "Jane Doe",
    "reportedByEmail": "jane@mail.com",
    "ownerName": "John Smith",
    "ownerEmail": "john@mail.com",
    "avatar": "",
    "reportsCount": 1,
    "status": "Pending",
    "createdAt": "Mar 03, 2026",
    "actionHistory": []
  }
}
```

**Errors:**
- `400` `{ "message": "Invalid id" }`
- `404` `{ "message": "Report not found" }`

---

## Resolve Report

**Endpoint:** `POST /api/admin/reports/:id/resolve`

### Payload (optional)

```json
{ "note": "Reviewed and resolved — no violation found." }
```

Sets status to `Resolved` and appends to `actionHistory`.

### Response `200`

```json
{ "report": { ... } }
```

Full report object (same shape as **Get Report**).

---

## Dismiss Report

**Endpoint:** `POST /api/admin/reports/:id/dismiss`

### Payload (optional)

```json
{ "note": "Not actionable." }
```

Sets status to `Dismissed`.

### Response `200`

```json
{ "report": { ... } }
```

---

## Suspend Reported Content

**Endpoint:** `POST /api/admin/reports/:id/suspend-content`

### Payload (optional)

```json
{ "note": "Content hidden pending review." }
```

Side effects:
- If report targets a **post** → post `moderationStatus` set to `Hidden`
- If report targets a **group** → group `status` set to `Suspended`

Report status set to `Under Review`.

### Response `200`

```json
{ "report": { ... } }
```

---

## Dashboard screens → APIs

| Screen | API |
|--------|-----|
| `/reports` list | `GET /api/admin/reports` |
| View report modal | `GET /api/admin/reports/:id` |
| Resolve | `POST /api/admin/reports/:id/resolve` |
| Dismiss | `POST /api/admin/reports/:id/dismiss` |
| Suspend content | `POST /api/admin/reports/:id/suspend-content` |
