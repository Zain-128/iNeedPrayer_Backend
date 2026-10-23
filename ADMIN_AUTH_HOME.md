# Admin Auth + Home APIs

Base: `/api/admin`

Header (login / forgot / reset / promote ke ilawa):
```
Authorization: Bearer <token>
```

---

# AUTH

## Login

**URL:** `POST /api/admin/auth/login`

**Query params:** none

**Payload:**
```json
{
  "email": "admin@example.com",
  "password": "yourpassword",
  "rememberMe": true
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "admin": {
    "id": "665f...",
    "name": "Admin",
    "email": "admin@example.com",
    "avatar": "",
    "role": "admin"
  }
}
```

---

## Get Me

**URL:** `GET /api/admin/auth/me`

**Query params:** none

**Payload:** none

**Response:**
```json
{
  "admin": {
    "id": "665f...",
    "name": "Admin",
    "email": "admin@example.com",
    "avatar": "",
    "role": "admin"
  }
}
```

---

## Logout

**URL:** `POST /api/admin/auth/logout`

**Query params:** none

**Payload:** none

**Response:**
```json
{
  "message": "Logged out"
}
```

---

## Forgot Password

**URL:** `POST /api/admin/auth/forgot-password`

**Query params:** none

**Payload:**
```json
{
  "email": "admin@example.com"
}
```

**Response:**
```json
{
  "message": "If this admin email is registered, you can reset your password using the reset code."
}
```

Reset code: `PASSWORD_RESET_CODE` (default `1234`)

---

## Reset Password

**URL:** `POST /api/admin/auth/reset-password`

**Query params:** none

**Payload:**
```json
{
  "email": "admin@example.com",
  "code": "1234",
  "password": "newpassword"
}
```

**Response:**
```json
{
  "message": "Password has been reset"
}
```

---

## Promote User to Admin

**URL:** `POST /api/admin/auth/promote`

**Query params:** none

**Header:** `x-admin-secret: <ADMIN_PROMOTE_SECRET>`

**Payload:**
```json
{
  "email": "admin@example.com"
}
```

User pehle `POST /api/auth/register` se exist kare.

**Response:**
```json
{
  "admin": {
    "id": "665f...",
    "name": "Admin",
    "email": "admin@example.com",
    "avatar": "",
    "role": "admin"
  }
}
```

---

# HOME

Home ke liye 1 call kaafi hai: `GET /api/admin/dashboard/home`

---

## Combined Home

**URL:** `GET /api/admin/dashboard/home`

**Query params:**
| Param | Type | Required | Default |
|-------|------|----------|---------|
| year | number | No | current year |

**Payload:** none

**Response:**
```json
{
  "metrics": {
    "totalUsers": { "value": 12, "change": "+100%", "changePercent": 100, "trend": "up" },
    "totalChurches": { "value": 3, "change": "+0%", "changePercent": 0, "trend": "up" },
    "prayerRequests": { "value": 40, "change": "+25%", "changePercent": 25, "trend": "up" },
    "activeSubscriptions": { "value": 0, "change": "+0%", "changePercent": 0, "trend": "up" }
  },
  "prayerActivity": {
    "categories": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    "prayerRequests": [0, 0, 0, 0, 0, 0, 0, 2, 5, 0, 0, 0],
    "praises": [0, 0, 0, 0, 0, 0, 0, 1, 3, 0, 0, 0]
  },
  "revenueTarget": {
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
  },
  "statistics": {
    "categories": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    "sales": [0, 0, 0, 0, 0, 0, 0, 4, 8, 0, 0, 0],
    "revenue": [0, 0, 0, 0, 0, 0, 0, 3, 8, 0, 0, 0],
    "series": [
      { "name": "Sales", "data": [0, 0, 0, 0, 0, 0, 0, 4, 8, 0, 0, 0] },
      { "name": "Revenue", "data": [0, 0, 0, 0, 0, 0, 0, 3, 8, 0, 0, 0] }
    ]
  },
  "demographics": {
    "countries": [
      { "country": "USA", "users": 8, "percentage": 67 },
      { "country": "Pakistan", "users": 4, "percentage": 33 }
    ]
  },
  "recentSubscriptions": {
    "data": [],
    "meta": { "total": 0, "limit": 10 },
    "message": "No subscriptions yet — billing module not connected."
  }
}
```

UI map:
- AdminMetrics → `metrics`
- PrayerActivityChart → `prayerActivity`
- MonthlyRevenueTarget → `revenueTarget`
- StatisticsChart → `statistics`
- DemographicCard → `demographics`
- RecentSubscriptions → `recentSubscriptions`

---

## Metrics

**URL:** `GET /api/admin/dashboard/metrics`

**Query params:** none

**Payload:** none

**Response:**
```json
{
  "totalUsers": { "value": 12, "change": "+100%", "changePercent": 100, "trend": "up" },
  "totalChurches": { "value": 3, "change": "+0%", "changePercent": 0, "trend": "up" },
  "prayerRequests": { "value": 40, "change": "+25%", "changePercent": 25, "trend": "up" },
  "activeSubscriptions": { "value": 0, "change": "+0%", "changePercent": 0, "trend": "up" }
}
```

---

## Prayer Activity

**URL:** `GET /api/admin/dashboard/prayer-activity`

**Query params:**
| Param | Type | Required | Default |
|-------|------|----------|---------|
| year | number | No | current year |

**Payload:** none

**Response:**
```json
{
  "categories": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  "prayerRequests": [0, 0, 0, 0, 0, 0, 0, 2, 5, 0, 0, 0],
  "praises": [0, 0, 0, 0, 0, 0, 0, 1, 3, 0, 0, 0]
}
```

---

## Revenue Target

**URL:** `GET /api/admin/dashboard/revenue-target`

**Query params:** none

**Payload:** none

**Response:**
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

---

## Statistics

**URL:** `GET /api/admin/dashboard/statistics`

**Query params:**
| Param | Type | Required | Default |
|-------|------|----------|---------|
| year | number | No | current year |

**Payload:** none

**Response:**
```json
{
  "categories": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  "sales": [0, 0, 0, 0, 0, 0, 0, 4, 8, 0, 0, 0],
  "revenue": [0, 0, 0, 0, 0, 0, 0, 3, 8, 0, 0, 0],
  "series": [
    { "name": "Sales", "data": [0, 0, 0, 0, 0, 0, 0, 4, 8, 0, 0, 0] },
    { "name": "Revenue", "data": [0, 0, 0, 0, 0, 0, 0, 3, 8, 0, 0, 0] }
  ]
}
```

---

## Demographics

**URL:** `GET /api/admin/dashboard/demographics`

**Query params:** none

**Payload:** none

**Response:**
```json
{
  "countries": [
    { "country": "USA", "users": 8, "percentage": 67 },
    { "country": "Pakistan", "users": 4, "percentage": 33 }
  ]
}
```

---

## Recent Subscriptions

**URL:** `GET /api/admin/dashboard/recent-subscriptions`

**Query params:**
| Param | Type | Required | Default |
|-------|------|----------|---------|
| status | string | No | — |
| plan | string | No | — |
| limit | number | No | 10 |

status: `Active` | `Pending` | `Failed` | `All`  
plan: `Monthly` | `Yearly` | `Lifetime` | `All`

**Payload:** none

**Response:**
```json
{
  "data": [],
  "meta": { "total": 0, "limit": 10 },
  "message": "No subscriptions yet — billing module not connected."
}
```

---

# Flow

1. `POST /api/admin/auth/login` → token save
2. Header: `Authorization: Bearer <token>`
3. Home: `GET /api/admin/dashboard/home`
4. Logout: `POST /api/admin/auth/logout` + token remove
5. 401 / 403 → `/signin`
