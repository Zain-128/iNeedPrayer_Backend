# Admin Auth + Home APIs

Base URL: `/api/admin`  
Header (except login / forgot / reset / promote / create):  
`Authorization: Bearer <token>`

---

# AUTH MODULE

---

## Login

**URL:** `POST /api/admin/auth/login`  
**Auth:** No  
**Query params:** none  

**Payload:**
```json
{
  "email": "admin@example.com",
  "password": "yourpassword",
  "rememberMe": true
}
```

`rememberMe` optional. Frontend use kare localStorage vs sessionStorage ke liye.

**Response `200`:**
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

**Errors:**
- `400` `{ "message": "email and password required" }`
- `401` `{ "message": "Invalid email or password" }`
- `403` `{ "message": "Admin access required" }`
- `403` `{ "message": "Account is blocked" }`

---

## Get Me

**URL:** `GET /api/admin/auth/me`  
**Auth:** Yes  
**Query params:** none  
**Payload:** none  

**Response `200`:**
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

**Errors:**
- `401` `{ "message": "Not authorized; no token" }`
- `403` `{ "message": "Admin access required" }`

---

## Logout

**URL:** `POST /api/admin/auth/logout`  
**Auth:** Yes  
**Query params:** none  
**Payload:** none  

**Response `200`:**
```json
{
  "message": "Logged out"
}
```

Frontend token delete kar de.

---

## Forgot Password

**URL:** `POST /api/admin/auth/forgot-password`  
**Auth:** No  
**Query params:** none  

**Payload:**
```json
{
  "email": "admin@example.com"
}
```

**Response `200`:**
```json
{
  "message": "If this admin email is registered, you can reset your password using the reset code."
}
```

Reset code env: `PASSWORD_RESET_CODE` (default `1234`)

---

## Reset Password

**URL:** `POST /api/admin/auth/reset-password`  
**Auth:** No  
**Query params:** none  

**Payload:**
```json
{
  "email": "admin@example.com",
  "code": "1234",
  "password": "newpassword"
}
```

**Response `200`:**
```json
{
  "message": "Password has been reset"
}
```

**Errors:**
- `400` `{ "message": "email, code, and password are required" }`
- `400` `{ "message": "Invalid email or reset code" }`

---

## Promote User to Admin (ops only)

**URL:** `POST /api/admin/auth/promote`  
**Auth:** Header `x-admin-secret: <ADMIN_PROMOTE_SECRET>`  
**Query params:** none  

**Payload:**
```json
{
  "email": "admin@example.com"
}
```

User pehle register hona chahiye (`POST /api/auth/register`).

**Response `200`:**
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

## Create Admin (ops only)

**URL:** `POST /api/admin/auth/create`  
**Auth:** Header `x-admin-secret: <ADMIN_PROMOTE_SECRET>`  
**Query params:** none  

Creates a new admin account. `role` is required and must be `"admin"` (only value allowed for dashboard access). If the email already belongs to a non-admin user, upgrades that user to admin and sets the new password/name.

**Payload:**
```json
{
  "email": "admin@example.com",
  "password": "Admin@123",
  "name": "Admin",
  "role": "admin"
}
```

**Response `201` (new admin):**
```json
{
  "admin": {
    "id": "665f...",
    "name": "Admin",
    "email": "admin@example.com",
    "avatar": "",
    "role": "admin"
  },
  "created": true,
  "upgraded": false
}
```

**Response `200` (existing user upgraded):**
```json
{
  "admin": { "...": "..." },
  "created": false,
  "upgraded": true
}
```

**Errors:**
- `400` `{ "message": "email, password, name, and role are required" }`
- `400` `{ "message": "role must be \"admin\"" }`
- `400` `{ "message": "Password must be at least 6 characters" }`
- `403` `{ "message": "Forbidden" }` — missing/invalid `x-admin-secret`
- `409` `{ "message": "Admin with this email already exists" }`

Then login: `POST /api/admin/auth/login` with the same email/password.

---

# HOME MODULE

Recommended: 1 combined call `GET /api/admin/dashboard/home`  
Ya har widget ki alag API.

---

## Combined Home

**URL:** `GET /api/admin/dashboard/home`  
**Auth:** Yes  
**Query params:**
| Param | Type | Required | Default |
|-------|------|----------|---------|
| `year` | number | No | current year |

**Payload:** none  

**Response `200`:**
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

## Metrics Cards

**URL:** `GET /api/admin/dashboard/metrics`  
**Auth:** Yes  
**Query params:** none  
**Payload:** none  

**Response `200`:**
```json
{
  "totalUsers": { "value": 12, "change": "+100%", "changePercent": 100, "trend": "up" },
  "totalChurches": { "value": 3, "change": "+0%", "changePercent": 0, "trend": "up" },
  "prayerRequests": { "value": 40, "change": "+25%", "changePercent": 25, "trend": "up" },
  "activeSubscriptions": { "value": 0, "change": "+0%", "changePercent": 0, "trend": "up" }
}
```

`trend`: `"up"` | `"down"`

---

## Prayer Activity Chart

**URL:** `GET /api/admin/dashboard/prayer-activity`  
**Auth:** Yes  
**Query params:**
| Param | Type | Required | Default |
|-------|------|----------|---------|
| `year` | number | No | current year |

**Payload:** none  

**Response `200`:**
```json
{
  "categories": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  "prayerRequests": [0, 0, 0, 0, 0, 0, 0, 2, 5, 0, 0, 0],
  "praises": [0, 0, 0, 0, 0, 0, 0, 1, 3, 0, 0, 0]
}
```

Apex series:
```js
[
  { name: "Prayer Requests", data: prayerRequests },
  { name: "Praises", data: praises }
]
```

---

## Monthly Revenue Target

**URL:** `GET /api/admin/dashboard/revenue-target`  
**Auth:** Yes  
**Query params:** none  
**Payload:** none  

**Response `200`:**
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

Env: `ADMIN_MONTHLY_REVENUE_TARGET=20000`

---

## Statistics Chart

**URL:** `GET /api/admin/dashboard/statistics`  
**Auth:** Yes  
**Query params:**
| Param | Type | Required | Default |
|-------|------|----------|---------|
| `year` | number | No | current year |

**Payload:** none  

**Response `200`:**
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

Note: billing na hone tak `Sales` = new users/month, `Revenue` = new posts/month.

---

## Demographics

**URL:** `GET /api/admin/dashboard/demographics`  
**Auth:** Yes  
**Query params:** none  
**Payload:** none  

**Response `200`:**
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
**Auth:** Yes  
**Query params:**
| Param | Type | Required | Default |
|-------|------|----------|---------|
| `status` | string | No | — | `Active` \| `Pending` \| `Failed` \| `All` |
| `plan` | string | No | — | `Monthly` \| `Yearly` \| `Lifetime` \| `All` |
| `limit` | number | No | `10` | |

**Payload:** none  

**Response `200`:**
```json
{
  "data": [],
  "meta": { "total": 0, "limit": 10 },
  "message": "No subscriptions yet — billing module not connected."
}
```

Item shape (jab billing lage):
```json
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
```

---

## Frontend flow

1. `POST /api/admin/auth/login` → save `token`
2. Har request: `Authorization: Bearer ${token}`
3. Home: `GET /api/admin/dashboard/home`
4. Logout: `POST /api/admin/auth/logout` + token remove
5. 401/403 → `/signin`
