# Admin Announcements API

**Base path:** `/api/admin`  
**Auth:** `Authorization: Bearer <admin-token>`

Dashboard page: `/announcements`

Publishing sends in-app notifications to eligible users.

---

## List announcements

`GET /api/admin/announcements`

**Query:** `page`, `limit`, `search`, `status`, `priority`

---

## Get announcement

`GET /api/admin/announcements/:id`

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

**Priority:** `Low` | `Medium` | `High` | `Urgent`  
**Audience:** `All Users` | `Church Owners` | `Church Members` | `Group Members` | `Subscribed Users`  
**Status:** `Draft` | `Published` | `Scheduled` | `Archived`

---

## Update announcement

`PATCH /api/admin/announcements/:id`

---

## Delete announcement

`DELETE /api/admin/announcements/:id`

---

## Publish announcement

`POST /api/admin/announcements/:id/publish`

Sets status to `Published` and creates in-app notifications for all eligible users.

**Response:**
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

Sets status to `Archived`.
