# Admin Monetization API

**Base path:** `/api/admin`  
**Auth:** `Authorization: Bearer <admin-token>`

Covers donations, wallet, withdrawals, and transactions.

**Subscriptions (plans + subscribers):** see dedicated doc → [ADMIN_SUBSCRIPTIONS_API.md](./ADMIN_SUBSCRIPTIONS_API.md)

---

## Subscriptions (quick reference)

Full docs: [ADMIN_SUBSCRIPTIONS_API.md](./ADMIN_SUBSCRIPTIONS_API.md)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/subscriptions` | List subscribers |
| POST | `/subscriptions` | Create / grant subscription |
| GET | `/subscriptions/:id` | Get subscriber |
| PATCH | `/subscriptions/:id` | Update |
| DELETE | `/subscriptions/:id` | Delete |
| GET | `/subscription-plans` | List plans |
| GET | `/subscription-plans/:id` | Get plan |
| POST | `/subscription-plans` | Create plan |
| PATCH | `/subscription-plans/:id` | Update plan |
| DELETE | `/subscription-plans/:id` | Delete plan |

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

---

## Related (app wallets)

User-facing coin wallets, donations, super chats, and entity withdrawals live under **`/api/wallet`**. See [WALLET_API.md](./WALLET_API.md).

**Stripe vs IAP:** Coin packages / community subscriptions sold *inside* iOS/Android apps should use **In-App Purchases** for store compliance. Current mobile flow opens **Stripe Checkout** in the browser (fine for web + MVP). Withdrawals use admin approval (+ Stripe Connect later for payouts).
