# Frontend Developer Integration Guide & Backend API Changes

> **Audience:** iOS, Android, and Web Frontend Developers  
> **Project:** `iNeedPrayer`  
> **Base API URL:** `https://dimgrey-mink-558336.hostingersite.com` (or your active server origin)

---

## 📋 Summary of Changes

1. **Updated Social Login Flow (`POST /api/auth/social-login`)**: Now supports Twitter/X, auto-links existing email accounts without returning `409 Conflict`, and returns access/refresh tokens.
2. **Public Subscription Plans API (`GET /api/subscription/plans`)**: New public endpoint returning active subscription plans created by admin from DB.
3. **Updated Coin Package Tiers (`GET /api/wallet/coins/packages`)**: Updated to Starter, Popular, Supporter, Best Value, Patron tiers with bonus coins and store SKUs.
4. **Native In-App Purchase (IAP) Verification (`POST /api/wallet/coins/verify-iap`)**: New endpoint for mobile apps to verify iOS (StoreKit) and Android (Google Play) purchases.
5. **Stripe Webhook URL**: Centralized webhook URL for subscriptions and coin payments.

---

## 1. Updated Social Login Flow

### `POST /api/auth/social-login`
Used after user authenticates via Google, Apple, Facebook, or Twitter/X native SDKs.

#### Request Headers:
`Content-Type: application/json`

#### Request Body:
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "socialLoginProvider": "google", // "google" | "facebook" | "apple" | "twitter" | "x"
  "socialLoginId": "PROVIDER_UNIQUE_USER_ID",
  "profilePicture": "https://example.com/avatar.jpg" // optional
}
```

> 💡 **Key Developer Notes:**
> - `socialLoginProvider` accepts `"google"`, `"facebook"`, `"apple"`, `"twitter"`, or `"x"` (`"x"` is automatically normalized to `"twitter"`).
> - **No 409 Conflict Error:** If an account already exists with this `email`, the backend **links** the social login to the existing user and logs them in seamlessly.

#### Success Response (`200 OK`):
```json
{
  "message": "User login successfully",
  "user": {
    "_id": "66f1a2b3c4d5...",
    "email": "user@example.com",
    "name": "John Doe",
    "avatar": "https://example.com/avatar.jpg",
    "createdAt": "2026-09-24T00:00:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

## 2. Public Subscription Plans API

### `GET /api/subscription/plans`
Fetch active subscription plans configured in the backend database.

#### Aliases Supported:
- `GET /api/subscription/plans`
- `GET /api/subscriptions/plans`
- `GET /api/subscription/plans/active`

#### Auth:
**Public** (No Bearer token required)

#### Success Response (`200 OK`):
```json
{
  "success": true,
  "plans": [
    {
      "id": "66f1a2b3c4d5...",
      "_id": "66f1a2b3c4d5...",
      "name": "Monthly Supporter",
      "description": "Full access to community features, priority prayer requests, and ad-free experience.",
      "priceCents": 499,
      "priceDisplay": "$4.99",
      "billingCycle": "Monthly",
      "features": [
        "Ad-free experience",
        "Priority prayer requests",
        "Exclusive live stream badges",
        "Unlimited community groups"
      ],
      "isActive": true,
      "trialPeriodDays": 7,
      "subscribersCount": 12,
      "appStoreProductId": "com.ineedprayer.sub.monthly",
      "googlePlayProductId": "com.ineedprayer.sub.monthly"
    },
    {
      "id": "66f1a2b3c4d6...",
      "_id": "66f1a2b3c4d6...",
      "name": "Yearly Patron",
      "description": "Best value! Annual access with 2 months free and special supporter icon.",
      "priceCents": 4999,
      "priceDisplay": "$49.99",
      "billingCycle": "Yearly",
      "features": [
        "All Monthly features",
        "2 Months Free (Save 16%)",
        "Special Supporter Icon & Badge",
        "Direct church donation features"
      ],
      "isActive": true,
      "trialPeriodDays": 14,
      "subscribersCount": 45,
      "appStoreProductId": "com.ineedprayer.sub.yearly",
      "googlePlayProductId": "com.ineedprayer.sub.yearly"
    }
  ]
}
```

---

## 3. Coin Packages API (Updated Tiers)

### `GET /api/wallet/coins/packages`
Returns the updated coin packages with bonus coin details and App Store / Google Play SKUs.

#### Auth:
**Public** (No Bearer token required)

#### Success Response (`200 OK`):
```json
{
  "packages": [
    {
      "index": 0,
      "name": "Starter",
      "coins": 100,
      "priceCents": 99,
      "label": "100 Coins",
      "tag": "Entry",
      "positioning": "Entry",
      "bonusText": "",
      "priceDisplay": "$0.99",
      "appStoreProductId": "com.shawntorres.ineedprayer.coins100",
      "googlePlayProductId": "coins100"
    },
    {
      "index": 1,
      "name": "Popular",
      "coins": 525,
      "priceCents": 499,
      "label": "525 Coins",
      "tag": "Popular",
      "positioning": "Popular",
      "bonusText": "500 + 25 bonus",
      "priceDisplay": "$4.99",
      "appStoreProductId": "com.shawntorres.ineedprayer.coins500",
      "googlePlayProductId": "coins500"
    },
    {
      "index": 2,
      "name": "Supporter",
      "coins": 1100,
      "priceCents": 999,
      "label": "1,100 Coins",
      "tag": "Supporter",
      "positioning": "Supporter",
      "bonusText": "1,000 + 100 bonus",
      "priceDisplay": "$9.99",
      "appStoreProductId": "com.shawntorres.ineedprayer.coins1000",
      "googlePlayProductId": "coins1000"
    },
    {
      "index": 3,
      "name": "Best Value",
      "coins": 2750,
      "priceCents": 2499,
      "label": "2,750 Coins",
      "tag": "Best Value",
      "positioning": "Best Value",
      "bonusText": "2,500 + 250 bonus",
      "priceDisplay": "$24.99",
      "appStoreProductId": "com.shawntorres.ineedprayer.coins2500",
      "googlePlayProductId": "coins2500"
    },
    {
      "index": 4,
      "name": "Patron",
      "coins": 5750,
      "priceCents": 4999,
      "label": "5,750 Coins",
      "tag": "Patron",
      "positioning": "Patron",
      "bonusText": "5,000 + 750 bonus",
      "priceDisplay": "$49.99",
      "appStoreProductId": "com.shawntorres.ineedprayer.coins5000",
      "googlePlayProductId": "coins5000"
    }
  ]
}
```

---

## 4. Native In-App Purchases (IAP) Verification API

### `POST /api/wallet/coins/verify-iap`
Mobile apps should call this endpoint immediately after completing a purchase using StoreKit (iOS) or Play Billing (Android) SDKs.

#### Auth:
`Authorization: Bearer <user_access_token>`

#### Request Body (iOS):
```json
{
  "platform": "ios",
  "productId": "com.ineedprayer.coins100",
  "receipt": "STOREKIT_RECEIPT_OR_STOREKIT2_JWS_STRING",
  "transactionId": "OPTIONAL_TRANSACTION_ID"
}
```

#### Request Body (Android):
```json
{
  "platform": "android",
  "productId": "com.ineedprayer.coins100",
  "purchaseToken": "PLAY_STORE_PURCHASE_TOKEN",
  "transactionId": "OPTIONAL_ORDER_ID"
}
```

#### Success Response (`200 OK`):
```json
{
  "ok": true,
  "message": "Successfully credited 100 coins",
  "coinsAdded": 100,
  "balanceCoins": 150,
  "transactionId": "66f1a2b3..."
}
```

#### Error Response (`400 Bad Request`):
```json
{
  "message": "This purchase was already processed"
}
```
*(Anti-replay protection prevents double crediting if the client retries the same receipt).*

---

## 5. Web Payment (Stripe Checkout)

### `POST /api/wallet/coins/purchase`
For Web clients buying coins via Stripe Checkout.

#### Auth:
`Authorization: Bearer <user_access_token>`

#### Request Body:
```json
{
  "packageIndex": 0 // index in COINS_PACKAGES array (0..4)
}
```

#### Success Response (`200 OK`):
```json
{
  "sessionId": "cs_test_a1b2c3...",
  "url": "https://checkout.stripe.com/c/pay/cs_test_a1b2c3..."
}
```
Redirect the user browser to `url`. Upon payment completion, Stripe Webhook will credit coins automatically.

---

## 6. Stripe Webhook URL Reference

If setting up Stripe Webhooks for live or staging servers, use:

```text
https://dimgrey-mink-558336.hostingersite.com/api/webhook/stripe
```

Events handled automatically by server:
- `checkout.session.completed` (Coin purchases + Subscriptions)
- `customer.subscription.deleted` (Subscription cancellation)
