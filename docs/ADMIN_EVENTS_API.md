# Admin Events API

**Base path:** `/api/admin`  
**Auth:** `Authorization: Bearer <admin-token>`

Dashboard page: `/events`

Events are church-hosted gatherings (online, physical, or hybrid). The admin can create, manage, and cancel events.

---

## List events

`GET /api/admin/events`

**Query:** `page`, `limit`, `search`, `status`, `type`

**Response:**
```json
{
  "data": [
    {
      "id": "abc123",
      "title": "Sunday Worship Service",
      "description": "Join us for worship",
      "type": "Hybrid",
      "status": "Upcoming",
      "hostName": "Pastor John",
      "hostEmail": "john@church.com",
      "avatar": "",
      "churchId": "xyz789",
      "churchName": "Grace Community",
      "location": "Dallas, USA",
      "eventDate": "2026-03-10T10:00:00.000Z",
      "eventEndDate": "",
      "attendees": 0,
      "registrations": 0,
      "maxAttendees": 500,
      "meetingUrl": "",
      "coverImage": "",
      "tags": ["worship", "sunday"],
      "createdAt": "Mar 10, 2026",
      "updatedAt": "Mar 10, 2026"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

**Filters:**
- `status` — `Upcoming` | `Live` | `Completed` | `Cancelled`
- `type` — `Online` | `Physical` | `Hybrid`

---

## Get event

`GET /api/admin/events/:id`

---

## Create event

`POST /api/admin/events`

```json
{
  "title": "Youth Fellowship Meetup",
  "description": "Monthly youth gathering",
  "type": "Online",
  "hostName": "Sarah Johnson",
  "hostEmail": "sarah@church.com",
  "churchName": "Hope Prayer Center",
  "location": "Zoom",
  "eventDate": "2026-04-15T19:00:00Z",
  "eventEndDate": "2026-04-15T21:00:00Z",
  "maxAttendees": 200,
  "meetingUrl": "https://zoom.us/j/123456",
  "tags": ["youth", "fellowship"]
}
```

**Type:** `Online` | `Physical` | `Hybrid`

---

## Update event

`PATCH /api/admin/events/:id`

Send any subset of fields to update.

---

## Delete event

`DELETE /api/admin/events/:id`

---

## Cancel event

`POST /api/admin/events/:id/cancel`

Sets status to `Cancelled`. Returns the updated event.
