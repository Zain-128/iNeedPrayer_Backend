# Client Setup & Integration Guide: In-App Coins, Payments & SMS Verification

**Project:** I Need Prayer  
**Document Version:** 2.0 (Client Edition)  
**Target:** Executive & Non-Technical Client Reference  

---

## 1. What We Have Built & Configured in Your Application

The complete monetization, wallet balance, and user communication infrastructure is now fully developed, tested, and integrated:

### 🪙 In-App Coin Store & Tier Bonuses
* A 5-tier coin store is ready for your users.
* **Automated Bonus System:** Higher tiers automatically credit extra bonus coins to the buyer’s wallet at no additional store setup cost (for example, purchasing the 500 Coin tier automatically awards **525 Coins** to the user).

### 💳 Instant In-App Wallet Crediting
* The moment a user completes payment on iOS, Android, or Web, coins are instantly deposited into their in-app wallet balance.
* Every purchase, bonus grant, and coin transaction is recorded in an automated internal ledger for clear transaction tracking.

### 🛡️ Built-in Fraud & Receipt Verification
* Real-time server-side verification directly with Apple and Google Play servers.
* The system cryptographically confirms that payment was received by the app stores before granting coins, preventing fake receipts, cloned transactions, and billing fraud.

### 💳 Direct Credit & Debit Card Payments (Stripe)
* A pre-integrated Stripe checkout flow for credit/debit card purchases and web transactions.

### 📲 Instant SMS & Phone Verification (Twilio)
* Automated SMS delivery service for phone verification and secure OTP codes.
* Handles international phone number formatting (E.164) automatically.

---

## 2. In-App Purchase Products to Create in the App Stores

Please set up the following **5 Consumable Products** inside Apple App Store Connect and Google Play Console:

| Package Name | Customer Receives (Coins) | Bonus Included | Price (USD) | Apple Product ID (SKU) | Google Play Product ID |
| :--- | :---: | :---: | :---: | :--- | :--- |
| **Starter** | **100 Coins** | Standard | \$0.99 | `com.shawntorres.ineedprayer.coins100` | `coins100` |
| **Popular** | **525 Coins** | +25 Bonus | \$4.99 | `com.shawntorres.ineedprayer.coins500` | `coins500` |
| **Supporter** | **1,100 Coins** | +100 Bonus | \$9.99 | `com.shawntorres.ineedprayer.coins1000` | `coins1000` |
| **Best Value** | **2,750 Coins** | +250 Bonus | \$24.99 | `com.shawntorres.ineedprayer.coins2500` | `coins2500` |
| **Patron** | **5,750 Coins** | +750 Bonus | \$49.99 | `com.shawntorres.ineedprayer.coins5000` | `coins5000` |

> **Important Note:** You only need to enter the base product name and standard retail price in Apple and Google consoles. The bonus coins (+25, +100, +250, +750) are automatically calculated and added to the user's wallet by our system upon purchase confirmation.

---

## 3. What We Need From You (Client Action Items)

To connect the application to your live business accounts, please provide the credentials and configurations listed below:

---

### A. Apple App Store Connect (iOS)

1. **Confirm App Bundle ID:**  
   * Expected: `com.shawntorres.ineedprayer` (or your official registered Bundle ID).
2. **Create the 5 Consumable Products:**  
   * In [App Store Connect](https://appstoreconnect.apple.com/) ➔ Select your App ➔ **Monetization** ➔ **In-App Purchases**.
   * Create each tier as **Consumable** using the exact Apple Product IDs from the table above.
3. **App-Specific Shared Secret:**  
   * In App Store Connect ➔ **App Information** (or **In-App Purchases**).
   * Click **App-Specific Shared Secret** ➔ Click **Generate**.
   * Copy the generated key string and send it to us.

---

### B. Google Play Console (Android)

1. **Confirm Android Package Name:**  
   * Expected: `com.ineedprayer`.
2. **Create the 5 In-App Products:**  
   * In [Google Play Console](https://play.google.com/console) ➔ Select your App ➔ **Monetize** ➔ **Products** ➔ **In-app products**.
   * Create each tier with IDs: `coins100`, `coins500`, `coins1000`, `coins2500`, `coins5000`.
   * Set Type to **One-time / Consumable**, match the pricing, and set status to **Active**.
3. **Google Play Service Account Key (`.json` file):**  
   * This allows our server to securely verify purchases with Google Play.
   * **Steps:**
     1. In [Google Cloud Console](https://console.cloud.google.com/) for your Play Console project, enable the **Google Play Android Developer API**.
     2. Go to **Credentials** ➔ **Create Credentials** ➔ **Service Account** (Name: `iap-verifier`).
     3. Under the **Keys** tab, click **Add Key** ➔ **Create new key (JSON format)** and download the `.json` file.
     4. In [Google Play Console](https://play.google.com/console) ➔ **Users & Permissions** ➔ **Invite user**, invite the service account email and grant:
        * *View financial data, orders, and cancellation survey responses*
        * *Manage in-app products and subscriptions*
     5. Send us the downloaded **`.json` file**.

---

### C. Stripe Dashboard (Card & Web Payments)

1. **Stripe Secret Key:**  
   * In [Stripe Dashboard](https://dashboard.stripe.com/) ➔ **Developers** ➔ **API keys** ➔ Copy the **Secret key** (`sk_live_...` or `sk_test_...`).
2. **Stripe Webhook Signing Secret:**  
   * In **Developers** ➔ **Webhooks** ➔ **Add endpoint**:
     * **URL:** `https://<YOUR_API_DOMAIN>/api/webhook/stripe`
     * **Event to select:** `checkout.session.completed`
   * Reveal and share the **Signing secret** (`whsec_...`).

---

### D. Twilio Console (SMS & Phone Verification)

1. **Twilio Account SID:**  
   * Located on the main dashboard of your [Twilio Console](https://console.twilio.com/) (starts with `AC...`).
2. **Twilio Auth Token:**  
   * Located right below the Account SID on your dashboard.
3. **Twilio Phone Number:**  
   * The active phone number purchased in your Twilio account in international format (e.g., `+12345678901`).

---

## 4. Checklist: Assets to Send Us

Please gather and send the following items:

* [ ] **Apple:** App-Specific Shared Secret (Text string)
* [ ] **Google Play:** Service Account Key (`.json` file)
* [ ] **Stripe:** Secret Key (`sk_live_...`) & Webhook Signing Secret (`whsec_...`)
* [ ] **Twilio:** Account SID, Auth Token & Twilio Phone Number
