# Manager Setup Guide: Apple, Google Play & Stripe Console Configuration

> **Target Audience:** Account Owners, Project Managers, and Admin Administrators.  
> **Purpose:** Step-by-step instructions to configure Apple Developer Console, App Store Connect, Google Play Console, Google Cloud API, and Stripe Dashboard for the `iNeedPrayer` app, and extract the exact credentials needed by the development team.

---

## 📋 Executive Checklist (What to Hand Over to Dev Team)

Upon completing this guide, provide the developer team with these 6 values:

| # | Credential / Setting Name | Example Format | Console Source |
|---|---|---|---|
| 1 | **iOS Bundle Identifier** | `com.ineedprayer.app` | Apple Developer Portal |
| 2 | **Apple App-Specific Shared Secret** | `a1b2c3d4e5f6...` | App Store Connect |
| 3 | **Android Package Name** | `com.ineedprayer.app` | Google Play Console |
| 4 | **Google Service Account JSON File** | `google-service-account.json` | Google Cloud Console |
| 5 | **Stripe Secret API Key** | `sk_live_51...` or `sk_test_51...` | Stripe Dashboard |
| 6 | **Stripe Webhook Signing Secret** | `whsec_...` | Stripe Dashboard |

---

## 🍏 PART 1: Apple Developer & App Store Connect Setup (iOS)

### Step 1.1: Register the Bundle Identifier
1. Log in to [Apple Developer Account](https://developer.apple.com/account/).
2. Navigate to **Certificates, Identifiers & Profiles** → **Identifiers**.
3. Click the **+** (plus) button to add a new identifier → Select **App IDs** → Click **Continue**.
4. Select **App** → Click **Continue**.
5. Enter:
   - **Description**: `iNeedPrayer App`
   - **Bundle ID**: Select **Explicit** → Enter `com.ineedprayer.app` (or your company's official domain bundle ID).
6. Under **Capabilities**, check **In-App Purchase**.
7. Click **Continue** → Click **Register**.

---

### Step 1.2: Add In-App Purchase Products in App Store Connect
1. Log in to [App Store Connect](https://appstoreconnect.apple.com/).
2. Click **My Apps** → Select your app (or click **+** to add a new app using the Bundle ID created in Step 1.1).
3. In the left sidebar, scroll to **Monetization** → Click **In-App Purchases**.
4. Click **+** (Create In-App Purchase) to add 5 **Consumable** products:

#### Product 1: Starter (100 Coins)
- **Type**: Consumable
- **Reference Name**: `Starter - 100 Coins`
- **Product ID (SKU)**: `com.ineedprayer.coins100` *(Must match exactly)*
- **Price Tier**: Tier 1 ($0.99 USD)
- **Display Name**: `100 Coins`
- **Description**: `Purchase 100 coins for donations and super chats`

#### Product 2: Popular (525 Coins)
- **Type**: Consumable
- **Reference Name**: `Popular - 525 Coins`
- **Product ID (SKU)**: `com.ineedprayer.coins525` *(Must match exactly)*
- **Price Tier**: Tier 5 ($4.99 USD)
- **Display Name**: `525 Coins`
- **Description**: `500 + 25 bonus coins for donations and super chats`

#### Product 3: Supporter (1,100 Coins)
- **Type**: Consumable
- **Reference Name**: `Supporter - 1,100 Coins`
- **Product ID (SKU)**: `com.ineedprayer.coins1100` *(Must match exactly)*
- **Price Tier**: Tier 10 ($9.99 USD)
- **Display Name**: `1,100 Coins`
- **Description**: `1,000 + 100 bonus coins for donations and super chats`

#### Product 4: Best Value (2,750 Coins)
- **Type**: Consumable
- **Reference Name**: `Best Value - 2,750 Coins`
- **Product ID (SKU)**: `com.ineedprayer.coins2750` *(Must match exactly)*
- **Price Tier**: Tier 25 ($24.99 USD)
- **Display Name**: `2,750 Coins`
- **Description**: `2,500 + 250 bonus coins for donations and super chats`

#### Product 5: Patron (5,750 Coins)
- **Type**: Consumable
- **Reference Name**: `Patron - 5,750 Coins`
- **Product ID (SKU)**: `com.ineedprayer.coins5750` *(Must match exactly)*
- **Price Tier**: Tier 50 ($49.99 USD)
- **Display Name**: `5,750 Coins`
- **Description**: `5,000 + 750 bonus coins for donations and super chats`

> **Note:** Upload a screenshot for review for each product (a screenshot of the coin store in the app).

---

### Step 1.3: Generate App-Specific Shared Secret
1. In App Store Connect, go to **App Information** (under General).
2. Scroll to **App-Specific Shared Secret**.
3. Click **Manage** → Click **Generate App-Specific Shared Secret**.
4. Copy the secret key (a string of alphanumeric characters) and save it.

---

## 🤖 PART 2: Google Play Console & Google Cloud Setup (Android)

### Step 2.1: Add In-App Products in Google Play Console
1. Log in to [Google Play Console](https://play.google.com/console).
2. Select your app → In the left menu, scroll to **Monetize** → Click **In-app products**.
3. Click **Create product** for each of the 5 coin packages:

| Product Name | Product ID (SKU) | Type | Default Price (USD) | Status |
|---|---|---|---|---|
| Starter (100 Coins) | `com.ineedprayer.coins100` | Consumable | $0.99 | Active |
| Popular (525 Coins) | `com.ineedprayer.coins525` | Consumable | $4.99 | Active |
| Supporter (1,100 Coins) | `com.ineedprayer.coins1100` | Consumable | $9.99 | Active |
| Best Value (2,750 Coins) | `com.ineedprayer.coins2750` | Consumable | $24.99 | Active |
| Patron (5,750 Coins) | `com.ineedprayer.coins5750` | Consumable | $49.99 | Active |

4. Save each product and click **Activate**.

---

### Step 2.2: Enable Developer API & Create Service Account Key
To allow our server to verify Android purchases with Google, set up a Service Account:

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Select the GCP Project linked to your Google Play Console account.
3. In the top search bar, search for **Google Play Android Developer API** → Click **Enable**.
4. Go to **IAM & Admin** → **Service Accounts**.
5. Click **+ CREATE SERVICE ACCOUNT**:
   - **Service account name**: `iap-verifier`
   - **Service account ID**: `iap-verifier`
   - Click **Create and Continue**.
   - Grant role: **Project** → **Editor** (or Viewer).
   - Click **Done**.
6. Find the newly created service account (`iap-verifier@...iam.gserviceaccount.com`).
7. Click the 3 dots under **Actions** → Select **Manage keys**.
8. Click **ADD KEY** → **Create new key** → Select **JSON** → Click **Create**.
9. A `.json` file will download to your computer. Keep this file secure!

---

### Step 2.3: Link Service Account to Google Play Console
1. Go back to [Google Play Console](https://play.google.com/console).
2. Click **Users & permissions** in the left menu.
3. Click **Invite new users**.
4. In the **Email address** field, paste the Service Account email address (e.g., `iap-verifier@your-project.iam.gserviceaccount.com`).
5. Under **App permissions**, add your app.
6. Under **Account permissions**, check:
   - **View financial data, orders, and cancellation responses**
   - **Manage in-app products**
7. Click **Invite user** → Click **Send invite**.

---

## 💳 PART 3: Stripe Dashboard Setup (Web Payments)

### Step 3.1: Get Secret API Key
1. Log in to [Stripe Dashboard](https://dashboard.stripe.com/).
2. Ensure you are in **Live Mode** (or **Test Mode** for testing).
3. In the top right / left menu, click **Developers** → **API keys**.
4. Under **Standard keys**, locate **Secret key**.
5. Click **Reveal live key** (or test key) → Copy the string (`sk_live_...` or `sk_test_...`).

---

### Step 3.2: Configure Webhook Endpoint
1. In Stripe Dashboard, click **Developers** → **Webhooks**.
2. Click **+ Add endpoint**.
3. Set **Endpoint URL**: `https://your-api-domain.com/api/webhook/stripe`
4. Under **Listen to**, click **+ Select events**:
   - Search for and select: `checkout.session.completed`
5. Click **Add events** → Click **Add endpoint**.
6. On the endpoint summary page, under **Signing secret**, click **Reveal**.
7. Copy the signing secret string (`whsec_...`).

---

## ✉️ Summary: Credentials Checklist for Dev Team

Send these exact values to your Lead Developer / Engineering Team:

```env
# 1. iOS App Store
APPLE_BUNDLE_ID=com.ineedprayer.app
APPLE_SHARED_SECRET=<Pasted App-Specific Shared Secret>

# 2. Android Google Play Store
GOOGLE_PLAY_PACKAGE_NAME=com.ineedprayer.app
# Attach the downloaded JSON key file: google-service-account.json

# 3. Stripe Payments
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```
