# Admin Subscriptions API

**Base path:** `/api/admin`  
**Auth:** `Authorization: Bearer <admin-token>`

Dashboard: `/subscriptions`  
Covers two resources:

1. **Plans** — product catalog (Starter / Standard / Premium, etc.)
2. **Subscribers** — user subscription records

App checkout (Stripe) lives under `/api/subscription` — see mobile/subscription flows. This doc is **admin dashboard** only.

Also summarized in [ADMIN_MONETIZATION_API.md](./ADMIN_MONETIZATION_API.md).

---

## 1. Plans

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/subscription-plans` | List plans |
| GET | `/api/admin/subscription-plans/:id` | Get one plan |
| POST | `/api/admin/subscription-plans` | Create plan |
| PATCH | `/api/admin/subscription-plans/:id` | Update plan |
| DELETE | `/api/admin/subscription-plans/:id` | Delete plan |

### List query

| Key | Description |
|-----|-------------|
| `page`, `limit` | Pagination |
| `search` | Name / description |
| `isActive` | `"true"` \| `"false"` |

### List response

```json
{
  "data": [
    {
      "id": "665f...",
      "name": "Premium",
      "description": "Full community access",
      "price": 9.99,
      "priceFormatted": "$9.99",
      "billingCycle": "Monthly",
      "features": [
        "Everything in Standard",
        "Live streaming: 30 hours / month",
        "Priority support"
      ],
      "isActive": true,
      "trialPeriod": 0,
      "subscribers": 42,
      "createdAt": "Mar 03, 2026"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 3, "totalPages": 1 },
  "stats": { "totalPlans": 3, "activePlans": 3 }
}
```

**Billing cycle:** `Monthly` \| `Yearly` \| `Lifetime`

### Create plan

`POST /api/admin/subscription-plans`

```json
{
  "name": "Starter",
  "description": "14-day trial community access",
  "price": "0",
  "billingCycle": "Monthly",
  "features": [
    "Post prayer requests & praise reports",
    "Comment, reactions, and save posts",
    "Follow churches & community groups",
    "Join community chat (basic)",
    "No live streaming"
  ],
  "isActive": true,
  "trialPeriod": 14
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `name` | **Yes** | |
| `description` | No | |
| `price` | No* | Dollars string/number → cents (`"9.99"` → 999). Or pass `priceCents` |
| `billingCycle` | No | Default `Monthly` |
| `features` | No | `string[]` |
| `isActive` | No | Default `true` |
| `trialPeriod` | No | Days (maps to `trialPeriodDays`) |

**Response `201`:** plan object

### Get plan

`GET /api/admin/subscription-plans/:id`

```json
{ "plan": { "id": "...", "name": "Premium", "...": "..." } }
```

### Update plan

`PATCH /api/admin/subscription-plans/:id`

Same fields as create (`name`, `description`, `price` / `priceCents`, `billingCycle`, `features`, `isActive`, `trialPeriod`).

### Delete plan

`DELETE /api/admin/subscription-plans/:id`

**Blocked** if any **Active** subscriber uses this plan → `409`  
`{ "message": "Cannot delete plan with active subscriptions" }`

### Suggested seed (Community Subscription UI)

Create these three plans to match the mobile cards:

| Name | Price | Trial | Notes |
|------|-------|-------|-------|
| Starter | `$0` | 14 days | No live streaming |
| Standard | `$4.99` / Month | 0 | 10 hrs live / month |
| Premium | `$9.99` / Month | 0 | 30 hrs live / month |

---

## 2. Subscribers (subscriptions)

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/subscriptions` | List subscribers |
| GET | `/api/admin/subscriptions/:id` | Get one |
| POST | `/api/admin/subscriptions` | Manually create / grant |
| PATCH | `/api/admin/subscriptions/:id` | Update |
| DELETE | `/api/admin/subscriptions/:id` | Delete record |

### List query

| Key | Description |
|-----|-------------|
| `page`, `limit` | Pagination |
| `search` | User name / email / plan name / transaction id |
| `status` | `Active` \| `Expired` \| `Cancelled` \| `All` |
| `plan` | Filter by plan name string |
| `paymentStatus` | `Paid` \| `Pending` \| `Failed` \| `All` |

### List response

```json
{
  "data": [
    {
      "id": "665f...",
      "name": "Jane Doe",
      "email": "jane@mail.com",
      "avatar": "",
      "plan": "Premium",
      "amount": "$9.99",
      "amountCents": 999,
      "billing": "Monthly",
      "startDate": "Mar 01, 2026",
      "expiryDate": "Apr 01, 2026",
      "autoRenew": true,
      "paymentStatus": "Paid",
      "status": "Active",
      "transactionId": "SUB-...",
      "createdAt": "Mar 01, 2026"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 120, "totalPages": 6 },
  "stats": {
    "activeSubscriptions": 90,
    "expiredSubscriptions": 20,
    "cancelledSubscriptions": 10,
    "totalRevenue": "$899.10",
    "totalRevenueCents": 89910
  }
}
```

### Get subscriber

`GET /api/admin/subscriptions/:id`  
Returns the subscription object (same shape as list item).

### Create subscriber (manual grant)

`POST /api/admin/subscriptions`

```json
{
  "userId": "665f...",
  "planId": "665f...",
  "paymentStatus": "Paid",
  "status": "Active",
  "autoRenew": true,
  "expiryDate": "2027-03-01T00:00:00Z"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `userId` | **Yes** | Non-admin user |
| `planId` | Recommended | Loads name, price, billing; increments plan `subscribers` |
| `plan` / `planName` | If no planId | Fallback display name |
| `amount` | If no planId | Dollars |
| `billing` | No | |
| `paymentStatus` | No | Default `Paid` |
| `status` | No | Default `Active` |
| `autoRenew` | No | Default `true` |
| `startDate` / `expiryDate` | No | ISO |
| `transactionId` | No | Auto-generated if omitted |

Also writes a **PlatformTransaction** of type `Subscription`.

### Update subscriber

`PATCH /api/admin/subscriptions/:id`

Fields: `plan` / `planName`, `amount`, `billing`, `autoRenew`, `paymentStatus`, `status`, `expiryDate`

### Delete subscriber

`DELETE /api/admin/subscriptions/:id`

---

## Dashboard map

| Screen | API |
|--------|-----|
| Plans tab / list | `GET /subscription-plans` |
| Create / edit plan | `POST` / `PATCH /subscription-plans` |
| Plan detail | `GET /subscription-plans/:id` |
| Subscribers list | `GET /subscriptions` |
| Subscriber detail | `GET /subscriptions/:id` |
| Grant / cancel | `POST` / `PATCH` / `DELETE /subscriptions` |

---

## Mobile Stripe subscribe (related)

Users subscribe via:

- `GET /api/subscription/status`
- `POST /api/subscription/subscribe` `{ "planId": "..." }` → Stripe Checkout URL
- Webhook `checkout.session.completed` creates Active `UserSubscription`

Admin list will show those Stripe-created subscribers automatically.
