# Admin Monetization API

**Base path:** `/api/admin`  
**Auth:** `Authorization: Bearer <admin-token>`

Covers subscriptions, plans, donations, wallet, withdrawals, and transactions.

---

## Subscriptions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/subscriptions` | List subscriptions |
| POST | `/subscriptions` | Create subscription |
| GET | `/subscriptions/:id` | Get subscription |
| PATCH | `/subscriptions/:id` | Update subscription |
| DELETE | `/subscriptions/:id` | Delete subscription |

**Query:** `page`, `limit`, `search`, `status`, `plan`, `paymentStatus`

**Create body:**
```json
{
  "userId": "665f...",
  "planId": "665f...",
  "plan": "Monthly",
  "amount": "9.99",
  "billing": "Monthly",
  "paymentStatus": "Paid",
  "status": "Active",
  "autoRenew": true
}
```

---

## Subscription plans

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/subscription-plans` | List plans |
| POST | `/subscription-plans` | Create plan |
| PATCH | `/subscription-plans/:id` | Update plan |
| DELETE | `/subscription-plans/:id` | Delete plan |

**Create body:**
```json
{
  "name": "Premium Monthly",
  "description": "Full access",
  "price": "9.99",
  "billingCycle": "Monthly",
  "features": ["Live streams", "Groups"],
  "isActive": true,
  "trialPeriod": 7
}
```

---

## Donations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/donations` | List donations |
| POST | `/donations` | Record donation |
| GET | `/donations/:id` | Get donation |

**Query:** `page`, `limit`, `search`, `status`, `type`, `donatedTo`

---

## Wallet

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/wallet/summary` | Balance + coin totals |
| GET | `/wallet/transactions` | Wallet transaction list |

---

## Withdrawals

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/withdrawals` | List withdrawal requests |
| POST | `/withdrawals` | Create withdrawal request |
| GET | `/withdrawals/:id` | Get withdrawal |
| POST | `/withdrawals/:id/approve` | Approve & mark paid |
| POST | `/withdrawals/:id/reject` | Reject with optional reason |

**Reject body:**
```json
{ "reason": "Invalid bank details" }
```

---

## Transactions (ledger)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/transactions` | List all platform transactions |
| GET | `/transactions/:id` | Get transaction |

**Query:** `page`, `limit`, `search`, `type`, `status`

Types: `Subscription`, `Donation`, `Coins Purchase`, `Withdrawal`, `Refund`, `Reward`

---

## Response shape (lists)

```json
{
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 1 },
  "stats": {}
}
```
