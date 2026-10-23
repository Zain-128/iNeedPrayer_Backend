# Admin Email Campaigns API

**Base path:** `/api/admin`  
**Auth:** `Authorization: Bearer <admin-token>`

Dashboard page: `/email-campaigns`

Campaign records + recipient counts are stored in MongoDB.  
`POST .../send` marks the campaign as sent. Wire **SendGrid / SES / etc.** for real SMTP delivery (placeholder message returned until then).

---

## Shared list response

```json
{
  "data": [ /* campaign items */ ],
  "meta": { "page": 1, "limit": 20, "total": 8, "totalPages": 1 },
  "stats": {
    "total": 8,
    "draft": 3,
    "scheduled": 1,
    "sent": 3,
    "failed": 1
  }
}
```

### Query params

| Key | Type | Description |
|-----|------|-------------|
| `page` | number | Default `1` |
| `limit` | number | Default `20`, max `100` |
| `search` | string | Matches `name`, `subject`, `message` |
| `status` | string | `Draft` \| `Scheduled` \| `Sending` \| `Sent` \| `Failed` \| `All` |

### Campaign object

| Key | Type | Description |
|-----|------|-------------|
| `id` | string | Campaign id |
| `name` | string | Internal name |
| `subject` | string | Email subject |
| `message` | string | Body |
| `audience` | string | e.g. `All Users`, `Premium Users` |
| `recipients` | number | Estimated / recorded recipient count |
| `openRate` | string | e.g. `"0%"` or `"-"` |
| `clickRate` | string | e.g. `"0%"` or `"-"` |
| `status` | string | See status enum |
| `scheduledAt` | string | Display datetime or `"-"` |
| `sentAt` | string | ISO or `""` |
| `createdBy` | string | Admin name |
| `createdAt` | string | Display date |

**Status:** `Draft` \| `Scheduled` \| `Sending` \| `Sent` \| `Failed`

**Audience notes:**
- `All Users` → non-admin, non-blocked users
- `Premium Users` → users with an **Active** subscription

---

## List campaigns

`GET /api/admin/email-campaigns`

```http
GET /api/admin/email-campaigns?status=Draft&search=prayer
Authorization: Bearer <token>
```

---

## Get campaign

`GET /api/admin/email-campaigns/:id`

**Errors:** `400` · `404`

---

## Create campaign

`POST /api/admin/email-campaigns`

```json
{
  "name": "Daily Prayer Reminder",
  "subject": "Take a moment to pray today",
  "message": "Join us in prayer...",
  "audience": "All Users",
  "scheduledAt": "2026-03-10T09:00:00Z"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `name` | **Yes** | |
| `subject` | **Yes** | |
| `message` | No | |
| `audience` | No | Default `All Users` |
| `scheduledAt` | No | If set → status `Scheduled`, else `Draft` |

`recipients` is auto-filled from audience count.

**Response `201`:** campaign object

---

## Update campaign

`PATCH /api/admin/email-campaigns/:id`

Editable: `name`, `subject`, `message`, `audience`, `scheduledAt`, `status`

**Rules:**
- Status `Sent` → cannot edit (`409`)
- Setting `scheduledAt` on a Draft moves status to `Scheduled`
- Changing `audience` recalculates `recipients`

---

## Delete campaign

`DELETE /api/admin/email-campaigns/:id`

```json
{ "message": "Deleted", "id": "..." }
```

---

## Send campaign

`POST /api/admin/email-campaigns/:id/send`

Flow:
1. Status → `Sending`
2. Refresh recipient count
3. Status → `Sent`, set `sentAt`, `openRate`/`clickRate` to `"0%"`
4. On error → `Failed`

Already sent → `409`

**Response `200`:**
```json
{
  "id": "...",
  "name": "...",
  "status": "Sent",
  "recipients": 1520,
  "message": "Campaign marked as sent. Connect an email provider (SendGrid, SES, etc.) for real delivery."
}
```

---

## Dashboard map

| UI action | API |
|-----------|-----|
| List | `GET /email-campaigns` |
| Create | `POST /email-campaigns` |
| View / edit | `GET` / `PATCH /email-campaigns/:id` |
| Send now | `POST /email-campaigns/:id/send` |
| Delete | `DELETE /email-campaigns/:id` |
