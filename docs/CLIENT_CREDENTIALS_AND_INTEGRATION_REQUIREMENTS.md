# I Need Prayer — Client Integration & Credentials Requirement Guide

**Project:** I Need Prayer  
**Target Platforms:** iOS (Apple App Store), Android (Google Play Store), Web/Backend (Node.js/Express)  
**Document Purpose:** Clear technical specifications of what is currently implemented in the codebase and the exact credentials/configurations required from the client's developer portals.

---

## 1. Executive Summary: What Is Currently Implemented in Code

The codebase features a **production-ready, dual-channel monetization and wallet ecosystem**:

1. **Pre-configured Coin Packages & Bonus Structure:**
   * 5 coin packages are defined in the backend (`src/contants.ts`), with automated tier bonuses handled entirely server-side (bonus coins are granted automatically without needing separate products on the stores).
2. **Apple In-App Purchases (iOS):**
   * Server-side receipt and StoreKit 2 JWS verification in `src/services/iapVerify.service.ts`.
   * Replay-attack and duplicate-transaction protection (receipt hashes tracked in MongoDB).
   * Automatic wallet crediting upon cryptographic receipt validation.
3. **Google Play Billing (Android):**
   * Server-to-server validation via Google Play Developer API (`androidpublisher.googleapis.com`).
   * Validates purchase tokens, checks purchase state (`purchaseState === 0`), and automatically consumes consumable products.
4. **Stripe Payments (Credit/Debit Card & Web):**
   * Pre-integrated Stripe Hosted Checkout Session generator (`POST /api/wallet/coins/purchase`).
   * Webhook processor for `checkout.session.completed` (`/api/webhook/stripe`) to credit coins asynchronously.
5. **Twilio SMS Service:**
   * Centralized SMS dispatcher (`src/services/sms.service.ts`) with international E.164 phone normalization, verification OTP dispatch, and simulated fallback.

---

## 2. Coin Packages & Product SKU Mapping

The following 5 In-App Purchase products must exist in both Apple App Store Connect and Google Play Console:

| Tier Name | Wallet Credit (Coins) | Base + Bonus Breakdown | Retail Price (USD) | Apple Product ID (SKU) | Google Play Product ID |
| :--- | :---: | :---: | :---: | :--- | :--- |
| **Starter** | **100 Coins** | 100 Base + 0 Bonus | \$0.99 | `com.shawntorres.ineedprayer.coins100` | `coins100` |
| **Popular** | **525 Coins** | 500 Base + 25 Bonus | \$4.99 | `com.shawntorres.ineedprayer.coins500` | `coins500` |
| **Supporter** | **1,100 Coins** | 1,000 Base + 100 Bonus | \$9.99 | `com.shawntorres.ineedprayer.coins1000` | `coins1000` |
| **Best Value** | **2,750 Coins** | 2,500 Base + 250 Bonus | \$24.99 | `com.shawntorres.ineedprayer.coins2500` | `coins2500` |
| **Patron** | **5,750 Coins** | 5,000 Base + 750 Bonus | \$49.99 | `com.shawntorres.ineedprayer.coins5000` | `coins5000` |

> **Note on Bonus Coins:** Apple and Google Play Console only need the base product SKU and price. The bonus coins (+25, +100, +250, +750) are calculated and deposited into the user's wallet automatically by the backend upon receipt verification.

---

## 3. What We Need From Apple App Store Connect (iOS)

### Required Information & Assets:
1. **App Bundle Identifier:**
   * Expected: `com.shawntorres.ineedprayer` (or the client's registered Bundle ID).
2. **App-Specific Shared Secret:**
   * **Where to find it:**
     1. Sign in to [App Store Connect](https://appstoreconnect.apple.com/).
     2. Open your App → Navigate to **App Information** (or **In-App Purchases**).
     3. Click **App-Specific Shared Secret** → Click **Generate**.
     4. Copy the 32-character hexadecimal string.
3. **In-App Purchase Product Configuration:**
   * Navigate to **Monetization** → **In-App Purchases**.
   * Create **5 Consumable** in-app purchase products using the exact Product IDs from the table in Section 2.
   * Fill in display names, English descriptions, and pricing tiers (\$0.99, \$4.99, \$9.99, \$24.99, \$49.99).

---

## 4. What We Need From Google Play Console (Android)

### Required Information & Assets:
1. **Android Package Name:**
   * Current package name: `com.ineedprayer`
2. **5 In-App Products Created in Google Play Console:**
   * **Where to set up:**
     1. Open [Google Play Console](https://play.google.com/console) → Select your App.
     2. In the left menu, scroll down to **Monetize** → **Products** → **In-app products**.
     3. Click **Create product** for each of the 5 SKUs:
        * Product IDs: `coins100`, `coins500`, `coins1000`, `coins2500`, `coins5000`.
     4. Set product type to **One-time / Consumable** and assign corresponding prices (\$0.99 to \$49.99).
     5. Set Status to **Active**.
3. **Google Cloud Service Account JSON Key File:**
   * Required for the backend to cryptographically verify purchase tokens against Google's servers.
   * **Step-by-step setup:**
     1. Open [Google Cloud Console](https://console.cloud.google.com/) for the GCP project linked to your Google Play Console account.
     2. Go to **APIs & Services** → **Library** → Search for **Google Play Android Developer API** → Click **Enable**.
     3. Go to **APIs & Services** → **Credentials** → Click **Create Credentials** → **Service Account**.
     4. Name it `iap-verifier` → Click **Create and Continue**.
     5. Click on the created service account → Go to the **Keys** tab → **Add Key** → **Create new key** → Choose **JSON** format and download the file.
     6. Go back to [Google Play Console](https://play.google.com/console) → **Users & Permissions** → **Invite new user**.
     7. Paste the email address of the service account (`iap-verifier@...iam.gserviceaccount.com`).
     8. Grant the following permissions:
        * **View app information and download bulk reports (read-only)**
        * **View financial data, orders, and cancellation survey responses**
        * **Manage in-app products and subscriptions**
     9. Send us the downloaded **`service-account.json` key file**.

---

## 5. What We Need From Stripe Dashboard

### Required Information:
1. **Stripe Secret API Key (`STRIPE_SECRET_KEY`):**
   * Log in to [Stripe Dashboard](https://dashboard.stripe.com/).
   * Switch to **Live Mode** (or Test Mode for sandbox testing).
   * Go to **Developers** → **API keys** → Copy the **Secret key** (starts with `sk_live_...` or `sk_test_...`).
2. **Stripe Webhook Signing Secret (`STRIPE_WEBHOOK_SECRET`):**
   * Go to **Developers** → **Webhooks** → Click **Add endpoint**.
   * **Endpoint URL:** `https://<YOUR_BACKEND_DOMAIN>/api/webhook/stripe`
   * **Events to listen for:** `checkout.session.completed`
   * Click **Add endpoint** → Reveal **Signing secret** (starts with `whsec_...`).

---

## 6. What We Need From Twilio Console (SMS Service)

### Required Information:
1. **Twilio Account SID (`TWILIO_ACCOUNT_SID`):**
   * Found on the main page of [Twilio Console](https://console.twilio.com/) (starts with `AC...`).
2. **Twilio Auth Token (`TWILIO_AUTH_TOKEN`):**
   * Located right below the Account SID on the Twilio dashboard.
3. **Twilio Phone Number (`TWILIO_PHONE_NUMBER`):**
   * Active phone number purchased in Twilio in international format (e.g., `+12345678901`).

---

## 7. Master Production Environment Configuration (`.env`)

Once the client provides the items above, the backend `.env` will be populated as follows:

```env
# ============================================================
# STRIPE PAYMENTS (Coins & Subscriptions)
# ============================================================
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ============================================================
# APPLE APP STORE (iOS In-App Purchases)
# ============================================================
APPLE_BUNDLE_ID=com.shawntorres.ineedprayer
APPLE_SHARED_SECRET=your_app_specific_shared_secret

# ============================================================
# GOOGLE PLAY CONSOLE (Android In-App Purchases)
# ============================================================
GOOGLE_PLAY_PACKAGE_NAME=com.ineedprayer
GOOGLE_SERVICE_ACCOUNT_PATH=./config/google-service-account.json

# ============================================================
# TWILIO SMS SERVICE (Phone & Church Verification)
# ============================================================
TWILIO_ACCOUNT_SID=ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# ============================================================
# AGORA LIVE STREAMING & RECORDING
# ============================================================
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_app_certificate
AGORA_CUSTOMER_ID=your_agora_customer_id
AGORA_CUSTOMER_SECRET=your_agora_customer_secret

# ============================================================
# BACKBLAZE B2 + CLOUDFLARE CDN STORAGE
# ============================================================
B2_S3_ENDPOINT=https://s3.us-west-004.backblazeb2.com
B2_BUCKET=your_bucket_name
B2_KEY_ID=your_b2_key_id
B2_APPLICATION_KEY=your_b2_app_key
B2_PUBLIC_URL_BASE=https://cdn.ineedprayer.world
```
