# Wallet & Coins API

**Base:** `/api/wallet`  
**Auth:** `Authorization: Bearer <token>` (except packages list)

## Stripe & In-App Purchases (Dual Payment Methods)

| Payment Method | Platform | Path | Body / Description |
|----------------|----------|------|--------------------|
| **Stripe Checkout** | Web / Stripe | `POST /api/wallet/coins/purchase` | `{ packageIndex }` or `{ customCoins }` |
| **Native IAP** | iOS (App Store) & Android (Google Play) | `POST /api/wallet/coins/verify-iap` | `{ platform: "ios"\|"android", productId, receipt?, purchaseToken?, transactionId? }` |

Platform fee on donations/super chats: `PLATFORM_FEE_BPS` (default **10%**).

---

## User wallet

| Method | Path | Description |
|--------|------|-------------|
| GET | `/me` | Balance + ledger |
| GET | `/coins/packages` | Predefined packages (includes Stripe price + App Store & Google Play product SKUs) |
| POST | `/coins/purchase` | Stripe checkout session — `{ packageIndex }` or `{ customCoins }` |
| POST | `/coins/verify-iap` | Verify native iOS / Android IAP receipt & credit coins — `{ platform, productId, receipt, purchaseToken, transactionId }` |

Signup / social login auto-creates a **User** wallet at 0 coins.

---

## Spend

| Method | Path | Body |
|--------|------|------|
| POST | `/donate` | `{ scope: "group"\|"church", entityId, coins, message? }` |
| POST | `/superchat` | `{ scope, entityId, sessionId, coins, message? }` |

Debits user coins → credits group/church wallet after platform fee. Super chats also emit `live-superchat` on the live socket room.

---

## Group / Church wallet

Created automatically when a group or church is created (0 balance).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/entity/:scope/:entityId` | Wallet + ledger + withdrawals (admin/owner) |
| POST | `/entity/:scope/:entityId/withdraw` | `{ coins, method?, account? }` |

User-purchased coins are **not** withdrawable. Only entity earnings are.

Admin approve/reject on `/api/admin/withdrawals/:id/*` syncs entity pending/available balances.
