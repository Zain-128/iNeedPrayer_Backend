# Admin Analytics API

Platform analytics for the admin dashboard.

**Base path:** `/api/admin`  
**Auth:** `Authorization: Bearer <admin-token>` (all endpoints below)

Dashboard page: `/analytics`

---

## Analytics Overview

**Endpoint:** `GET /api/admin/analytics/overview`  
**Payload:** none

### Query keys

| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| `range` | string | No | `month` | `week` (7 days) \| `month` (30 days) |

**Example:**
```http
GET /api/admin/analytics/overview?range=week
Authorization: Bearer <token>
```

---

### Response `200`

```json
{
  "stats": {
    "totalUsers": 3782,
    "totalPrayerRequests": 1429,
    "totalDonations": 0,
    "activeChurches": 210,
    "newUsersInRange": 145,
    "totalChurches": 248
  },
  "series": [
    {
      "name": "2026-03-01",
      "prayers": 12,
      "praises": 5,
      "users": 0,
      "donations": 0
    },
    {
      "name": "2026-03-02",
      "prayers": 18,
      "praises": 8,
      "users": 0,
      "donations": 0
    }
  ]
}
```

---

### Stats keys

| Key | Type | Description |
|-----|------|-------------|
| `totalUsers` | number | All non-admin users |
| `totalPrayerRequests` | number | All prayer-mode posts |
| `totalDonations` | number | `0` until billing connected |
| `activeChurches` | number | Churches with status `Approved` |
| `newUsersInRange` | number | Users registered in selected range |
| `totalChurches` | number | All churches |

---

### Series keys (`series[]`)

One entry per day in the selected range that had post activity.

| Key | Type | Description |
|-----|------|-------------|
| `name` | string | Date `YYYY-MM-DD` |
| `prayers` | number | Prayer posts that day |
| `praises` | number | Praise posts that day |
| `users` | number | `0` (reserved) |
| `donations` | number | `0` until billing connected |

---

## Chart usage (frontend)

Prayer vs praise trend:

```js
const dates = series.map((s) => s.name);
const prayerData = series.map((s) => s.prayers);
const praiseData = series.map((s) => s.praises);

// Apex / Chart.js series
[
  { name: "Prayer Requests", data: prayerData },
  { name: "Praises", data: praiseData }
]
```

---

## Related dashboard APIs

Home page widgets use separate endpoints — see [DASHBOARD_HOME_API.md](./DASHBOARD_HOME_API.md):

| Widget | Endpoint |
|--------|----------|
| Metric cards | `GET /api/admin/dashboard/metrics` |
| Prayer activity (monthly) | `GET /api/admin/dashboard/prayer-activity` |
| Demographics | `GET /api/admin/dashboard/demographics` |
| Recent activity feed | `GET /api/admin/dashboard/recent-activity` |

---

## Dashboard screens → APIs

| Screen | API |
|--------|-----|
| `/analytics` overview | `GET /api/admin/analytics/overview?range=week` |
| `/analytics` monthly view | `GET /api/admin/analytics/overview?range=month` |
