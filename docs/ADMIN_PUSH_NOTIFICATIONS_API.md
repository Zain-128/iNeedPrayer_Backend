# Admin Push Notifications API

**Base path:** `/api/admin`  
**Auth:** `Authorization: Bearer <admin-token>`

Dashboard page: `/push-notifications`

Push notifications are scheduled or immediate messages sent to user devices. Currently supports draft/scheduled/sent states. FCM/APNs delivery integration is pending.

---

## List push notifications

`GET /api/admin/push-notifications`

**Query:** `page`, `limit`, `search`, `status`, `audience`

**Response:**
```json
{
  "data": [
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
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

**Filters:**
- `status` — `Draft` | `Scheduled` | `Sent` | `Failed`
- `audience` — `All Users` | `Subscribed Users` | `Church Owners` | `Church Members` | `Group Members` | `Inactive Users`

---

## Get push notification

`GET /api/admin/push-notifications/:id`

---

## Create push notification

`POST /api/admin/push-notifications`

```json
{
  "title": "Weekend Prayer Event",
  "message": "Join us this Saturday for a special prayer session.",
  "audience": "Subscribed Users",
  "scheduledAt": "2026-04-05T08:00:00Z",
  "deepLink": "/events/abc123"
}
```

**Audience:** `All Users` | `Subscribed Users` | `Church Owners` | `Church Members` | `Group Members` | `Inactive Users`

If `scheduledAt` is provided, status is set to `Scheduled`; otherwise `Draft`.

---

## Update push notification

`PATCH /api/admin/push-notifications/:id`

Send any subset of fields to update. Only `Draft` or `Scheduled` notifications can be edited.

---

## Delete push notification

`DELETE /api/admin/push-notifications/:id`

---

## Send push notification

`POST /api/admin/push-notifications/:id/send`

Marks the notification as `Sent` with `sentAt` timestamp. Actual device delivery (FCM/APNs) is a TODO — currently a stub.
