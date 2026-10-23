# Complete Setup Guide: App Store, Google Play Console, Stripe & In-App Purchases (IAP)

This guide provides step-by-step instructions to configure **Apple App Store (iOS)**, **Google Play Console (Android)**, and **Stripe** for coin purchases and monetization in `iNeedPrayer_Backend`.

---

## 1. Overview of Payment Architecture

`iNeedPrayer` supports a dual-payment system:

| Payment Method | Targeted Platform | Verification Flow | Backend Endpoint |
|---|---|---|---|
| **Stripe Checkout** | Web & Browser | Redirect to Stripe Hosted Checkout → Webhook handles credit | `POST /api/wallet/coins/purchase` |
| **Apple In-App Purchase (IAP)** | iOS Mobile App | Client purchases via StoreKit → Backend verifies StoreKit 2 JWS / receipt | `POST /api/wallet/coins/verify-iap` |
| **Google Play Billing (IAP)** | Android Mobile App | Client purchases via Play Billing → Backend verifies token via Google Developer API | `POST /api/wallet/coins/verify-iap` |

---

## 2. Apple App Store & App Store Connect Setup (iOS)

### Step 2.1: Register Bundle ID & Enable Capabilities
1. Log in to [Apple Developer Portal](https://developer.apple.com/account/).
2. Go to **Certificates, Identifiers & Profiles** → **Identifiers**.
3. Register an **App ID** (e.g., `com.ineedprayer.app`).
4. Ensure **In-App Purchase** is enabled under App Capabilities.

### Step 2.2: Create In-App Purchase Products in App Store Connect
1. Log in to [App Store Connect](https://appstoreconnect.apple.com/).
2. Select your app → Go to **Monetization** → **In-App Purchases**.
3. Create 5 **Consumable** In-App Purchase products with exact matching SKUs:

| Product Name | Product ID / SKU | Type | Reference Price (USD) |
|---|---|---|---|
| Starter (100 Coins) | `com.ineedprayer.coins100` | Consumable | $0.99 |
| Popular (525 Coins) | `com.ineedprayer.coins525` | Consumable | $4.99 |
| Supporter (1,100 Coins) | `com.ineedprayer.coins1100` | Consumable | $9.99 |
| Best Value (2,750 Coins) | `com.ineedprayer.coins2750` | Consumable | $24.99 |
| Patron (5,750 Coins) | `com.ineedprayer.coins5750` | Consumable | $49.99 |

4. Complete the product metadata, display name, description, and screenshot for each tier.

### Step 2.3: Retrieve App-Specific Shared Secret
1. In App Store Connect, go to **App Information** or **In-App Purchases**.
2. Click **App-Specific Shared Secret** → Generate Secret.
3. Copy the secret key string and add it to backend `.env`:
   ```env
   APPLE_BUNDLE_ID=com.ineedprayer.app
   APPLE_SHARED_SECRET=your_app_specific_shared_secret_here
   ```

---

## 3. Google Play Console Setup (Android)

### Step 3.1: Create App & Consumable Products
1. Log in to [Google Play Console](https://play.google.com/console).
2. Select your app (`com.ineedprayer.app`).
3. Go to **Monetize** → **In-app products**.
4. Create 5 consumable products matching backend SKUs:

| Product Name | Product ID / SKU | Type | Price (USD) |
|---|---|---|---|
| Starter (100 Coins) | `com.ineedprayer.coins100` | Consumable | $0.99 |
| Popular (525 Coins) | `com.ineedprayer.coins525` | Consumable | $4.99 |
| Supporter (1,100 Coins) | `com.ineedprayer.coins1100` | Consumable | $9.99 |
| Best Value (2,750 Coins) | `com.ineedprayer.coins2750` | Consumable | $24.99 |
| Patron (5,750 Coins) | `com.ineedprayer.coins5750` | Consumable | $49.99 |

5. Set status to **Active** for all products.

### Step 3.2: Configure Google Cloud Service Account for API Verification
Backend verification of Android purchases requires Google Play Developer API permissions:

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Select the GCP project connected to your Google Play Developer Account.
3. Go to **APIs & Services** → **Library** → Search for **Google Play Android Developer API** → Click **Enable**.
4. Go to **APIs & Services** → **Credentials** → Click **Create Credentials** → **Service Account**.
   - Name: `iap-verifier`
   - Role: `Editor` or custom API viewer
5. Click on the created service account → Go to **Keys** tab → **Add Key** → **Create new key** (JSON format).
6. Save the downloaded `.json` key file safely.
7. Return to **Google Play Console** → Go to **Users & Permissions** → **Invite new user**.
8. Paste the service account email (e.g., `iap-verifier@your-project.iam.gserviceaccount.com`).
9. Grant permission: **View financial data, orders, and cancellation responses** & **Manage in-app products**.

### Step 3.3: Configure Backend Environment Variables
Option A (JSON File Path):
```env
GOOGLE_PLAY_PACKAGE_NAME=com.ineedprayer.app
GOOGLE_SERVICE_ACCOUNT_PATH=./config/google-service-account.json
```

Option B (JSON Inline String):
```env
GOOGLE_PLAY_PACKAGE_NAME=com.ineedprayer.app
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key":"..."}
```

---

## 4. Stripe Setup (Web & Direct Card Payments)

### Step 4.1: Retrieve Stripe API Keys
1. Log in to [Stripe Dashboard](https://dashboard.stripe.com/).
2. Toggle to **Live** mode (or Test mode for development).
3. Go to **Developers** → **API keys**.
4. Copy `Secret key` (`sk_live_...` or `sk_test_...`) and add to `.env`:
   ```env
   STRIPE_SECRET_KEY=sk_test_your_secret_key
   ```

### Step 4.2: Configure Stripe Webhook Endpoint
1. In Stripe Dashboard, go to **Developers** → **Webhooks** → **Add endpoint**.
2. Endpoint URL: `https://your-backend-domain.com/api/webhook/stripe`
3. Select events to listen to:
   - `checkout.session.completed`
4. Click **Add endpoint**.
5. Reveal **Signing secret** (`whsec_...`) and add to `.env`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_signing_secret
   ```

---

## 5. Complete Backend Environment Variables Reference (`.env`)

Add/update the following environment variables in `iNeedPrayer_Backend/.env`:

```env
# Server Port & Database
PORT=3004
MONGO_URI=mongodb://localhost:27017/iNeedPrayer

# JWT Authentication
JWT_SECRET=your_jwt_secret_key
JWT_ACCESS_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your_jwt_refresh_secret
JWT_REFRESH_EXPIRES_IN=7d

# Stripe Payment Integration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Apple App Store (iOS IAP)
APPLE_BUNDLE_ID=com.ineedprayer.app
APPLE_SHARED_SECRET=your_apple_shared_secret

# Google Play Store (Android IAP)
GOOGLE_PLAY_PACKAGE_NAME=com.ineedprayer.app
GOOGLE_SERVICE_ACCOUNT_PATH=./config/google-service-account.json
# Or inline JSON:
# GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

---

## 6. Testing & Integration Verification

### Testing Stripe Checkout (Web)
1. Call `POST /api/wallet/coins/purchase`:
   ```json
   {
     "packageIndex": 0
   }
   ```
2. Response returns `url` to Stripe Checkout.
3. Completing purchase triggers Stripe Webhook → Credits user's coin balance automatically.

### Testing Apple IAP Verification (iOS Mobile)
1. Complete purchase in iOS app (Sandbox Apple ID).
2. Call `POST /api/wallet/coins/verify-iap` with JWT Auth Header:
   ```json
   {
     "platform": "ios",
     "productId": "com.ineedprayer.coins100",
     "receipt": "RECEIPT_OR_STOREKIT2_JWS_STRING"
   }
   ```
3. Backend validates receipt with Apple servers and credits coins. Re-submitting the same receipt returns error `"This purchase was already processed"`.

### Testing Google Play IAP Verification (Android Mobile)
1. Complete purchase in Android app (Play Console License Tester).
2. Call `POST /api/wallet/coins/verify-iap` with JWT Auth Header:
   ```json
   {
     "platform": "android",
     "productId": "com.ineedprayer.coins100",
     "purchaseToken": "PLAY_STORE_PURCHASE_TOKEN"
   }
   ```
3. Backend validates purchase token via Google Developer API, credits coins, and consumes product.
