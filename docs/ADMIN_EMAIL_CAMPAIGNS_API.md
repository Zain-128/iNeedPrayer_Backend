# Admin Email Campaigns API

**Base path:** `/api/admin`  
**Auth:** `Authorization: Bearer <admin-token>`

Dashboard page: `/email-campaigns`

Email delivery is stored in the database; connect SendGrid/SES for real sending.

---

## List campaigns

`GET /api/admin/email-campaigns`

**Query:** `page`, `limit`, `search`, `status`

---

## Get campaign

`GET /api/admin/email-campaigns/:id`

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

---

## Update campaign

`PATCH /api/admin/email-campaigns/:id`

Sent campaigns cannot be edited.

---

## Delete campaign

`DELETE /api/admin/email-campaigns/:id`

---

## Send campaign

`POST /api/admin/email-campaigns/:id/send`

Marks campaign as sent and records recipient count. Returns a note to connect an email provider for real delivery.
