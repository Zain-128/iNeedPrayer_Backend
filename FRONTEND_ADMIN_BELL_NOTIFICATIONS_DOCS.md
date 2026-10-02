# Admin Bell Notifications & Real-Time Socket.IO Documentation

This document explains how the Admin Top-Bar Bell Dropdown (Notifications Overlay) and real-time Socket.IO events work.

---

## 📌 1. API Summary

> **Important**: 
> - `/api/admin/notifications` is used **only** for broadcasting notifications to app users.
> - `/api/admin/activity-notifications` is the dedicated API for the **Admin Header Bell Icon**.

| Feature | Method | Endpoint | Description |
|---|---|---|---|
| **Fetch Activity Feed** | `GET` | `/api/admin/activity-notifications` | List notifications for the top-bar bell dropdown & view all page |
| **Mark Single as Read** | `POST` / `PATCH` | `/api/admin/activity-notifications/:id/read` | Mark one notification as read |
| **Mark All as Read** | `POST` / `PATCH` | `/api/admin/activity-notifications/read-all` | Mark all notifications as read |

---

## 🔔 2. Endpoints Detail

### A. Get Bell Notifications (`GET /api/admin/activity-notifications`)
- **Headers**: `Authorization: Bearer <ADMIN_TOKEN>`
- **Query Parameters (Optional)**:
  - `unreadOnly=true` (Fetch only unread notifications)
  - `type` (Filter by notification type e.g., `user_registered`, `withdrawal_created`, `content_reported`)
  - `page` (Default: `1`)
  - `limit` (Default: `10` or `20`)
  - `search` (Search by title, message, or user name)

#### Request Example:
```http
GET /api/admin/activity-notifications?limit=10 HTTP/1.1
Host: dimgrey-mink-558336.hostingersite.com
Authorization: Bearer <ADMIN_TOKEN>
```

#### Response `200 OK`:
```json
{
  "unreadCount": 3,
  "data": [
    {
      "id": "66f4b321a9c3d123456789ac",
      "type": "user_registered",
      "title": "New user registered",
      "message": "Terry Franci joined the platform",
      "refType": "user",
      "refId": "66f4b321a9c3d123456789ab",
      "actorId": "66f4b321a9c3d123456789ab",
      "actorName": "Terry Franci",
      "actorAvatar": "https://dimgrey-mink-558336.hostingersite.com/uploads/1727733440-avatar.jpg",
      "meta": {},
      "isRead": false,
      "read": false,
      "createdAt": "2026-10-02T13:57:00.000Z",
      "time": "Oct 02, 2026"
    },
    {
      "id": "66f4b321a9c3d123456789ad",
      "type": "withdrawal_created",
      "title": "Withdrawal request created",
      "message": "Brandon Philips requested $250.00 withdrawal",
      "refType": "withdrawal",
      "refId": "66f4b321a9c3d123456789ae",
      "actorId": "66f4b321a9c3d123456789af",
      "actorName": "Brandon Philips",
      "actorAvatar": "https://dimgrey-mink-558336.hostingersite.com/uploads/brandon.jpg",
      "meta": {},
      "isRead": true,
      "read": true,
      "createdAt": "2026-10-02T12:00:00.000Z",
      "time": "Oct 02, 2026"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 2,
    "totalPages": 1
  }
}
```

---

### B. Mark Single Notification as Read (`POST` / `PATCH /api/admin/activity-notifications/:id/read`)
- **Headers**: `Authorization: Bearer <ADMIN_TOKEN>`

#### Response `200 OK`:
```json
{
  "message": "Marked as read",
  "id": "66f4b321a9c3d123456789ac",
  "isRead": true,
  "read": true,
  "unreadCount": 2
}
```

---

### C. Mark All as Read (`POST` / `PATCH /api/admin/activity-notifications/read-all`)
- **Headers**: `Authorization: Bearer <ADMIN_TOKEN>`

#### Response `200 OK`:
```json
{
  "message": "All marked as read",
  "unreadCount": 0
}
```

---

## ⚡ 3. Real-Time Socket.IO Integration

### A. Connect Socket
```javascript
import { io } from "socket.io-client";

const socket = io("https://dimgrey-mink-558336.hostingersite.com", {
  transports: ["websocket", "polling"],
});
```

---

### B. New Admin Notification Event (`admin:notification:new`)
Emitted automatically whenever a new activity (User Signup, Report, Withdrawal, Prayer Request) is created in the backend:

```javascript
socket.on("admin:notification:new", (data) => {
  console.log("New Notification received:", data.notification);
  console.log("Updated Unread Count:", data.unreadCount);

  // 1. Update bell badge counter:
  setUnreadCount(data.unreadCount);

  // 2. Prepend new notification to bell dropdown list:
  setNotifications((prev) => [data.notification, ...prev]);
});
```

**Payload Object (`data`)**:
```json
{
  "notification": {
    "id": "66f4b321a9c3d123456789ac",
    "type": "user_registered",
    "title": "New user registered",
    "message": "Terry Franci joined the platform",
    "refType": "user",
    "refId": "66f4b321a9c3d123456789ab",
    "actorId": "66f4b321a9c3d123456789ab",
    "actorName": "Terry Franci",
    "actorAvatar": "https://dimgrey-mink-558336.hostingersite.com/uploads/avatar.jpg",
    "isRead": false,
    "read": false,
    "createdAt": "2026-10-02T13:57:00.000Z",
    "time": "Oct 02, 2026"
  },
  "unreadCount": 4
}
```

---

### C. User Signup Event (`user:created`)
Emitted automatically whenever a user signs up on the app:

```javascript
socket.on("user:created", (data) => {
  console.log("New user registered:", data.user);

  // Auto-refetch users list or update dashboard counters:
  refetchUsersList();
  refetchDashboardMetrics();
});
```

**Payload Object (`data`)**:
```json
{
  "user": {
    "id": "66f4b321a9c3d123456789ab",
    "name": "Terry Franci",
    "email": "terry@example.com",
    "avatar": "https://.../avatar.jpg",
    "role": "user",
    "status": "active",
    "createdAt": "2026-10-02T13:57:00.000Z"
  }
}
```
