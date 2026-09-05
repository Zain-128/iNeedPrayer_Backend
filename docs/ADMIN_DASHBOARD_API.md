# Admin Dashboard API — Module Index

All admin dashboard APIs live under **`/api/admin`**.

**Auth:** `Authorization: Bearer <admin-token>` on protected routes  
**Login:** `POST /api/admin/auth/login`

Promote a user to admin (ops only):

```http
POST /api/admin/auth/promote
x-admin-secret: <ADMIN_PROMOTE_SECRET>
Content-Type: application/json

{ "email": "admin@example.com" }
```

Create a new admin (ops only):

```http
POST /api/admin/auth/create
x-admin-secret: <ADMIN_PROMOTE_SECRET>
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "Admin@123",
  "name": "Admin",
  "role": "admin"
}
```

---

## Module docs

| Module | Dashboard page | Documentation |
|--------|----------------|---------------|
| Auth + Home | `/`, `/signin` | [ADMIN_AUTH_HOME_API.md](./ADMIN_AUTH_HOME_API.md) |
| Dashboard widgets | `/` | [DASHBOARD_HOME_API.md](./DASHBOARD_HOME_API.md) |
| Users | `/users` | [ADMIN_USERS_API.md](./ADMIN_USERS_API.md) |
| Blocked Users | `/blocked-users` | [ADMIN_USERS_API.md](./ADMIN_USERS_API.md#blocked-users) |
| Churches | `/churches`, `/church/[id]` | [ADMIN_CHURCHES_API.md](./ADMIN_CHURCHES_API.md) |
| Groups | `/groups`, `/group-profile/[id]` | [ADMIN_GROUPS_API.md](./ADMIN_GROUPS_API.md) |
| Content | `/content` | [ADMIN_CONTENT_API.md](./ADMIN_CONTENT_API.md) |
| Prayer Requests | `/prayer-requests` | [ADMIN_CONTENT_API.md](./ADMIN_CONTENT_API.md#list-prayer-requests) |
| Praises | `/praises` | [ADMIN_CONTENT_API.md](./ADMIN_CONTENT_API.md#list-praises) |
| Live Streams | `/live-streams` | [ADMIN_LIVE_STREAMS_API.md](./ADMIN_LIVE_STREAMS_API.md) |
| Reports | `/reports` | [ADMIN_REPORTS_API.md](./ADMIN_REPORTS_API.md) |
| Notifications | `/notifications` | [ADMIN_NOTIFICATIONS_API.md](./ADMIN_NOTIFICATIONS_API.md) |
| Top-bar activity | header bell | [ADMIN_NOTIFICATIONS_API.md](./ADMIN_NOTIFICATIONS_API.md#1-top-bar-activity-notifications) |
| Analytics | `/analytics` | [ADMIN_ANALYTICS_API.md](./ADMIN_ANALYTICS_API.md) |
| Subscriptions | `/subscriptions` | [ADMIN_MONETIZATION_API.md](./ADMIN_MONETIZATION_API.md#subscriptions) |
| Donations | `/donations` | [ADMIN_MONETIZATION_API.md](./ADMIN_MONETIZATION_API.md#donations) |
| Wallet | `/wallet` | [ADMIN_MONETIZATION_API.md](./ADMIN_MONETIZATION_API.md#wallet) |
| Withdrawals | `/withdrawals` | [ADMIN_MONETIZATION_API.md](./ADMIN_MONETIZATION_API.md#withdrawals) |
| Transactions | `/transactions` | [ADMIN_MONETIZATION_API.md](./ADMIN_MONETIZATION_API.md#transactions-ledger) |
| Email Campaigns | `/email-campaigns` | [ADMIN_EMAIL_CAMPAIGNS_API.md](./ADMIN_EMAIL_CAMPAIGNS_API.md) |
| Announcements | `/announcements` | [ADMIN_ANNOUNCEMENTS_API.md](./ADMIN_ANNOUNCEMENTS_API.md) |

---

## Monetization & campaigns

All previously stubbed endpoints are now live with MongoDB persistence. See module docs above for full CRUD details.

**Note:** Payment provider (Stripe, etc.) and email provider (SendGrid, SES) are not wired yet — admins can record data via API; real charges/email delivery require provider integration.

---

## Shared list pagination

Most list endpoints accept:

| Query | Default | Max |
|-------|---------|-----|
| `page` | `1` | — |
| `limit` | `20` | `100` |
| `search` | — | case-insensitive |

Response always includes:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 1
  }
}
```

---

## Quick auth flow

1. `POST /api/admin/auth/login` → save `token`
2. All requests: `Authorization: Bearer ${token}`
3. `GET /api/admin/auth/me` → verify session
4. `POST /api/admin/auth/logout` → clear token
5. On `401` / `403` → redirect to `/signin`

---

## Mobile app APIs (separate)

Admin docs above are for the **dashboard only**. The mobile app uses different routes:

| Feature | Doc |
|---------|-----|
| Search | [SEARCH_API.md](./SEARCH_API.md) |
| Groups (app) | [GROUPS_API.md](./GROUPS_API.md) |
| Churches (app) | [CHURCHES_API.md](./CHURCHES_API.md) |
| Full reference | [FULL_API_DOCUMENTATION.md](./FULL_API_DOCUMENTATION.md) |
