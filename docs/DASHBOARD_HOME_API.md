# Dashboard Home APIs

Base: `/api/admin`  
Auth: `Authorization: Bearer <admin-token>` (all endpoints below)

Recommended: call **one** combined API, or individual widgets.

---

## 1) Combined Home (recommended)

**Endpoint:** `/api/admin/dashboard/home`  
**Method:** `GET`  
**Query params:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `year` | number | No | current year | Year for charts |

**Payload:** none

**Success `200`:**
```json
{
  "metrics": { ... },
  "prayerActivity": { ... },
  "revenueTarget": { ... },
  "statistics": { ... },
  "demographics": { ... },
  "recentSubscriptions": { ... }
}
```

Maps to home widgets:
- `AdminMetrics` → `metrics`
- `PrayerActivityChart` → `prayerActivity`
- `MonthlyRevenueTarget` → `revenueTarget`
- `StatisticsChart` → `statistics`
- `DemographicCard` → `demographics`
- `RecentSubscriptions` → `recentSubscriptions`

---

## 2) Metrics cards (Total Users / Churches / Prayer Requests / Subscriptions)

**Endpoint:** `/api/admin/dashboard/metrics`  
**Method:** `GET`  
**Query params:** none  
**Payload:** none

**Success `200`:**
```json
{
  "totalUsers": {
    "value": 3782,
    "change": "+11%",
    "changePercent": 11,
    "trend": "up"
  },
  "totalChurches": {
    "value": 248,
    "change": "+6.2%",
    "changePercent": 6.2,
    "trend": "up"
  },
  "prayerRequests": {
    "value": 1429,
    "change": "+8.4%",
    "changePercent": 8.4,
    "trend": "up"
  },
  "activeSubscriptions": {
    "value": 0,
    "change": "+0%",
    "changePercent": 0,
    "trend": "up"
  }
}
```

`trend`: `"up"` | `"down"`  
`activeSubscriptions` is `0` until billing is connected.

---

## 3) Prayer Activity chart

**Endpoint:** `/api/admin/dashboard/prayer-activity`  
**Method:** `GET`  
**Query params:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `year` | number | No | current year | Chart year |

**Payload:** none

**Success `200`:**
```json
{
  "categories": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  "prayerRequests": [168, 385, 201, 298, 187, 195, 291, 110, 215, 390, 280, 112],
  "praises": [80, 130, 95, 140, 100, 125, 155, 90, 132, 175, 150, 105]
}
```

Frontend Apex series:
```js
[
  { name: "Prayer Requests", data: prayerRequests },
  { name: "Praises", data: praises }
]
```

---

## 4) Monthly Revenue Target

**Endpoint:** `/api/admin/dashboard/revenue-target`  
**Method:** `GET`  
**Query params:** none  
**Payload:** none

**Success `200`:**
```json
{
  "progressPercent": 0,
  "change": "+0%",
  "changePercent": 0,
  "target": "$20K",
  "targetRaw": 20000,
  "revenue": "$0.0K",
  "revenueRaw": 0,
  "today": "$0",
  "todayRaw": 0,
  "message": "Revenue tracking will populate once subscriptions/donations billing is connected."
}
```

Optional env: `ADMIN_MONTHLY_REVENUE_TARGET=20000`

---

## 5) Statistics chart

**Endpoint:** `/api/admin/dashboard/statistics`  
**Method:** `GET`  
**Query params:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `year` | number | No | current year | Chart year |

**Payload:** none

**Success `200`:**
```json
{
  "categories": ["Jan", "Feb", "...", "Dec"],
  "sales": [10, 20, 15, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "revenue": [5, 8, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "series": [
    { "name": "Sales", "data": [10, 20, 15, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { "name": "Revenue", "data": [5, 8, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0] }
  ]
}
```

Note: until billing exists, `Sales` = new users/month, `Revenue` = new posts/month.

---

## 6) User Demographics

**Endpoint:** `/api/admin/dashboard/demographics`  
**Method:** `GET`  
**Query params:** none  
**Payload:** none

**Success `200`:**
```json
{
  "countries": [
    { "country": "USA", "users": 2379, "percentage": 79 },
    { "country": "France", "users": 589, "percentage": 23 }
  ]
}
```

---

## 7) Recent Subscriptions table

**Endpoint:** `/api/admin/dashboard/recent-subscriptions`  
**Method:** `GET`  
**Query params:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `status` | string | No | — | `Active` \| `Pending` \| `Failed` \| `All` |
| `plan` | string | No | — | `Monthly` \| `Yearly` \| `Lifetime` \| `All` |
| `limit` | number | No | `10` | Max rows |

**Payload:** none

**Success `200`:**
```json
{
  "data": [
    {
      "id": "...",
      "userName": "Sarah Johnson",
      "userEmail": "sarah.johnson@mail.com",
      "plan": "Monthly",
      "amount": "$9.99",
      "status": "Active",
      "avatar": "https://...",
      "purchasedAt": "Mar 03, 2026"
    }
  ],
  "meta": { "total": 0, "limit": 10 },
  "message": "No subscriptions yet — billing module not connected."
}
```

Currently returns empty `data: []` until billing is connected.

---

## 8) Recent Activity feed

**Endpoint:** `/api/admin/dashboard/recent-activity`  
**Method:** `GET`  
**Query params:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `limit` | number | No | `10` | Max items per category |

**Payload:** none

**Success `200`:**
```json
{
  "recentUsers": [
    {
      "id": "...",
      "name": "Sarah Johnson",
      "email": "sarah@mail.com",
      "avatar": "",
      "joinedAt": "Mar 03, 2026"
    }
  ],
  "recentPosts": [
    {
      "id": "...",
      "authorName": "John Smith",
      "authorEmail": "john@mail.com",
      "avatar": "",
      "type": "Prayer Request",
      "content": "Please pray for...",
      "createdAt": "Mar 03, 2026"
    }
  ],
  "recentReports": [
    {
      "id": "...",
      "reportId": "RPT-A1B2",
      "type": "post",
      "reason": "spam",
      "reportedBy": "Jane Doe",
      "status": "Pending",
      "createdAt": "Mar 03, 2026"
    }
  ],
  "recentStreams": [
    {
      "id": "...",
      "title": "Morning Prayer Room",
      "hostName": "Pastor John",
      "status": "Live",
      "viewers": 248,
      "scheduledAt": "Mar 03, 2026"
    }
  ]
}
```

---

## Auth reminder (login first)

**Endpoint:** `/api/admin/auth/login`  
**Method:** `POST`  
**Query params:** none  
**Payload:**
```json
{
  "email": "admin@example.com",
  "password": "yourpassword"
}
```

**Success `200`:**
```json
{
  "token": "<jwt>",
  "admin": {
    "id": "...",
    "name": "Admin",
    "email": "admin@example.com",
    "avatar": "",
    "role": "admin"
  }
}
```

Then send: `Authorization: Bearer <token>`

---

## Quick map (Home UI → API)

| UI Component | Endpoint | Method |
|--------------|----------|--------|
| All home (1 call) | `/api/admin/dashboard/home` | GET |
| AdminMetrics | `/api/admin/dashboard/metrics` | GET |
| PrayerActivityChart | `/api/admin/dashboard/prayer-activity` | GET |
| MonthlyRevenueTarget | `/api/admin/dashboard/revenue-target` | GET |
| StatisticsChart | `/api/admin/dashboard/statistics` | GET |
| DemographicCard | `/api/admin/dashboard/demographics` | GET |
| RecentSubscriptions | `/api/admin/dashboard/recent-subscriptions` | GET |
