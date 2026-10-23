# Complete Project Changes, API Documentation & Integration Guide

> **Project:** `iNeedPrayer_Backend`  
> **Base Domain:** `https://dimgrey-mink-558336.hostingersite.com`  
> **Deployment Package:** `iNeedPrayer_Backend_Hostinger.zip`

---

## 📌 Executive Summary of Updates

This document consolidates all recent backend modifications, new API endpoints, frontend integration instructions, and console configuration steps.

1. **Updated Social Login Flow (`POST /api/auth/social-login`)**:
   - Supports Google, Facebook, Apple, Twitter, and X.
   - Automatically links social login credentials to existing accounts with matching emails without returning a `409 Conflict` error.
2. **Subscription Plans API (`GET /api/subscription/plans`)**:
   - New public endpoint returning active subscription plans configured by admin in MongoDB.
3. **Updated Coin Tiers (`GET /api/wallet/coins/packages`)**:
   - Configured 5 tiers: Starter ($0.99), Popular ($4.99), Supporter ($9.99), Best Value ($24.99), and Patron ($49.99) with bonus coins and store SKUs.
4. **Native In-App Purchases Verification (`POST /api/wallet/coins/verify-iap`)**:
   - New endpoint verifying iOS StoreKit receipts and Android Google Play purchase tokens with anti-replay protection.
5. **Stripe Webhooks**:
   - Configured route `/api/webhook/stripe` for live payment and subscription processing.

---

## 📱 PART 1: Frontend Developer API Reference

### 1. Social Login (`POST /api/auth/social-login`)

#### Request:
```json
POST /api/auth/social-login
Content-Type: application/json

{
  "email": "user@example.com",
  "name": "John Doe",
  "socialLoginProvider": "google", // "google" | "facebook" | "apple" | "twitter" | "x"
  "socialLoginId": "110248495931234567890",
  "profilePicture": "https://example.com/avatar.jpg"
}
```

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

### 2. Fetch Subscription Plans (`GET /api/subscription/plans`)

#### Request:
```text
GET /api/subscription/plans
Auth: None (Public Endpoint)
```

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

### 3. Fetch Coin Packages (`GET /api/wallet/coins/packages`)

#### Request:
```text
GET /api/wallet/coins/packages
Auth: None (Public Endpoint)
```

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

### 4. Verify Native In-App Purchase (`POST /api/wallet/coins/verify-iap`)

#### Request (iOS):
```json
POST /api/wallet/coins/verify-iap
Authorization: Bearer <user_access_token>
Content-Type: application/json

{
  "platform": "ios",
  "productId": "com.ineedprayer.coins100",
  "receipt": "STOREKIT_RECEIPT_OR_JWS_STRING"
}
```

#### Request (Android):
```json
POST /api/wallet/coins/verify-iap
Authorization: Bearer <user_access_token>
Content-Type: application/json

{
  "platform": "android",
  "productId": "com.ineedprayer.coins100",
  "purchaseToken": "PLAY_STORE_PURCHASE_TOKEN"
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

---

## ⚙️ PART 2: Console Setup Checklist for Manager

Provide these 6 values to the backend development environment `.env`:

```env
# 1. iOS App Store
APPLE_BUNDLE_ID=com.ineedprayer.app
APPLE_SHARED_SECRET=<Pasted App-Specific Shared Secret>

# 2. Android Google Play Store
GOOGLE_PLAY_PACKAGE_NAME=com.ineedprayer.app
GOOGLE_SERVICE_ACCOUNT_PATH=./config/google-service-account.json

# 3. Stripe Payments
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## 🚀 PART 3: Hostinger Deployment Instructions

1. **Upload Archive**: Upload `iNeedPrayer_Backend_Hostinger.zip` to Hostinger File Manager and extract.
2. **Node.js Setup**:
   - Set **Node.js Version** to `18.x` or `20.x`.
   - Set **Startup File** to `index.js` (or `index.cjs`).
3. **Install & Run**:
   - Click **Run NPM Install**.
   - Click **Restart Application**.
