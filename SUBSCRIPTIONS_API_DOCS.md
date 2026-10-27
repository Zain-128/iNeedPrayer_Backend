# 📜 INeedPrayer — Subscriptions Module API Documentation
### (Churches, Communities & Individual)

This document provides complete documentation for the **Multi-Target Subscription System** in **INeedPrayer**. Subscriptions and plans are divided into 3 distinct targets:

1. **`individual`**: Personal supporters & user membership plans.
2. **`community`**: Fellowship groups, ministries & community management plans.
3. **`church`**: Official verified churches & parish organizational suites.

---

## 📌 Base URLs
* **Production Live URL:** `https://dimgrey-mink-558336.hostingersite.com`
* **Local Development:** `http://localhost:3004`
* **App Subscription Base:** `/api/subscription` *(also alias `/api/subscriptions`)*
* **Admin Dashboard Base:** `/api/admin`

---

## 🗂️ Data Models & Schemas

### 1. `SubscriptionPlan`
```typescript
{
  id: string;
  name: string;                // e.g. "Church Growth & Live"
  target: "individual" | "community" | "church";
  tier: "starter" | "standard" | "pro" | "premium";
  badge: string;               // e.g. "Popular", "Best Value", "Save 16%"
  description: string;
  priceCents: number;          // e.g. 4999 ($49.99)
  priceDisplay: string;        // "$49.99"
  billingCycle: "Monthly" | "Yearly" | "Lifetime";
  features: string[];          // list of bullet points
  limits: {
    maxMembers?: number;       // 0 = unlimited
    maxPrayerRequests?: number;
    liveStreamEnabled?: boolean;
    analyticsEnabled?: boolean;
    prioritySupport?: boolean;
  };
  isActive: boolean;
  trialPeriodDays: number;
  subscribersCount: number;
  appStoreProductId: string;   // iOS In-App Purchase SKU
  googlePlayProductId: string; // Android Google Play SKU
}
```

### 2. `UserSubscription` (Active Subscriber Record)
```typescript
{
  id: string;
  target: "individual" | "community" | "church";
  targetDisplayName: string;   // Church name, Community name, or User name
  user: string;                // User ObjectId
  church?: { id: string; name: string; email: string; image: string } | null;
  community?: { id: string; name: string; image: string } | null;
  plan: string;                // SubscriptionPlan ObjectId
  planName: string;
  amountCents: number;
  billing: "Monthly" | "Yearly" | "Lifetime";
  startDate: string;           // ISO date
  expiryDate: string;          // ISO date
  autoRenew: boolean;
  cancelAtPeriodEnd: boolean;
  paymentStatus: "Paid" | "Pending" | "Failed";
  status: "Active" | "Expired" | "Cancelled";
  transactionId: string;
}
```

---

## 📱 1. Mobile App Endpoints (`/api/subscription/*`)

### `GET /api/subscription/plans`
Fetches active subscription plans. Can return all plans categorized or filtered by a specific target.

* **Query Parameters:**
  * `target` *(optional)*: `"individual"`, `"community"`, `"church"`, or `"all"` (default: `"all"`).

* **Direct Target Routes:**
  * `GET /api/subscription/plans/individual`
  * `GET /api/subscription/plans/community`
  * `GET /api/subscription/plans/church`

* **Response (Status 200):**
```json
{
  "success": true,
  "target": "all",
  "plans": [
    {
      "id": "6720e1...",
      "name": "Monthly Supporter",
      "target": "individual",
      "tier": "starter",
      "badge": "Popular",
      "description": "Priority prayer requests, supporter badge, and ad-free experience.",
      "priceCents": 499,
      "priceDisplay": "$4.99",
      "billingCycle": "Monthly",
      "features": [
        "Ad-free prayer experience",
        "Priority prayer request placement",
        "Supporter badge on profile and comments"
      ],
      "limits": {
        "liveStreamEnabled": false,
        "analyticsEnabled": false
      },
      "isActive": true,
      "trialPeriodDays": 7,
      "appStoreProductId": "com.ineedprayer.sub.individual.monthly",
      "googlePlayProductId": "com.ineedprayer.sub.individual.monthly"
    }
  ],
  "categorized": {
    "individual": [ /* array of individual plans */ ],
    "community": [ /* array of community plans */ ],
    "church": [ /* array of church plans */ ]
  }
}
```

---

### `GET /api/subscription/status`
Checks the current active subscription status. Can check personal user subscription, a community subscription, or a church subscription.

* **Headers:** `Authorization: Bearer <token>`
* **Query Parameters:**
  * `target` *(optional)*: `"individual"` (default), `"community"`, or `"church"`.
  * `churchId` *(required if target is "church")*: Church ID.
  * `communityId` *(required if target is "community")*: Group ID.

* **Response (Active Subscription, Status 200):**
```json
{
  "subscription": {
    "active": true,
    "target": "church",
    "plan": "Church Growth & Live",
    "planId": "6720e2...",
    "tier": "standard",
    "badge": "Most Popular",
    "billingCycle": "Monthly",
    "amountCents": 4999,
    "startDate": "2026-10-27T12:00:00.000Z",
    "expiryDate": "2026-11-26T12:00:00.000Z",
    "autoRenew": true,
    "church": {
      "id": "671df9...",
      "name": "Grace Community Church"
    }
  }
}
```

* **Response (No Active Subscription, Status 200):**
```json
{
  "subscription": {
    "active": false,
    "target": "individual",
    "plan": "none",
    "planId": null,
    "billingCycle": null,
    "expiryDate": null,
    "autoRenew": false
  }
}
```

---

### `POST /api/subscription/subscribe`
Subscribes or upgrades a user, community, or church to a selected plan.

* **Headers:** `Authorization: Bearer <token>`
* **Request Body:**
```json
{
  "planId": "6720e2...",
  "target": "church",           // "individual" | "community" | "church"
  "churchId": "671df9...",      // required if target is church
  "communityId": "671de8..."    // required if target is community
}
```

* **Response (Status 200):**
```json
{
  "success": true,
  "active": true,
  "message": "Church Growth & Live activated successfully for church!",
  "subscription": {
    "id": "6720f1...",
    "target": "church",
    "planName": "Church Growth & Live",
    "billing": "Monthly",
    "startDate": "2026-10-27T15:00:00.000Z",
    "expiryDate": "2026-11-26T15:00:00.000Z",
    "autoRenew": true,
    "status": "Active"
  }
}
```

---

### `POST /api/subscription/cancel`
Cancels an active subscription. Sets `cancelAtPeriodEnd: true` and marks status as `Cancelled`.

* **Headers:** `Authorization: Bearer <token>`
* **Request Body:**
```json
{
  "subscriptionId": "6720f1...",
  "target": "church",
  "churchId": "671df9..."
}
```

* **Response (Status 200):**
```json
{
  "success": true,
  "active": false,
  "message": "Subscription cancelled successfully",
  "subscription": {
    "id": "6720f1...",
    "status": "Cancelled",
    "cancelAtPeriodEnd": true
  }
}
```

---

## 🖥️ 2. Admin Dashboard Endpoints (`/api/admin/*`)

### A. Subscription Plans CRUD

#### 1. List Plans
`GET /api/admin/subscription-plans?page=1&limit=20&target=church&isActive=true&search=growth`
* **Query Params:**
  * `page`, `limit`: Pagination.
  * `target`: `"individual"`, `"community"`, `"church"`, or `"all"`.
  * `isActive`: `"true"` or `"false"`.
  * `search`: Search name & description.
* **Response:** Returns paginated `data: [...]`, `meta: {...}`, and stats:
  ```json
  "stats": {
    "totalPlans": 8,
    "activePlans": 8,
    "individualPlans": 2,
    "communityPlans": 3,
    "churchPlans": 3
  }
  ```

#### 2. Create Plan
`POST /api/admin/subscription-plans`
* **Request Body:**
```json
{
  "name": "Church Sanctuary Annual",
  "target": "church",
  "tier": "premium",
  "badge": "Best Value",
  "priceCents": 49999,
  "billingCycle": "Yearly",
  "description": "Annual church plan for established ministries with maximum reach and savings.",
  "features": [
    "All Church Growth & Live features",
    "2 Months Free (Save $100/year)",
    "Top featured placement in Church Finder",
    "Priority 24/7 dedicated church support"
  ],
  "limits": {
    "maxMembers": 0,
    "liveStreamEnabled": true,
    "analyticsEnabled": true,
    "prioritySupport": true
  },
  "isActive": true,
  "trialPeriodDays": 14,
  "appStoreProductId": "com.ineedprayer.sub.church.sanctuary",
  "googlePlayProductId": "com.ineedprayer.sub.church.sanctuary"
}
```
* **Response:** Status 201 Created with created plan object.

#### 3. Get Single Plan
`GET /api/admin/subscription-plans/:id`

#### 4. Update Plan
`PUT /api/admin/subscription-plans/:id`
* **Body:** Any field (`name`, `target`, `priceCents`, `billingCycle`, `features`, `limits`, `isActive`, `badge`, `tier`, `trialPeriodDays`).

#### 5. Delete Plan
`DELETE /api/admin/subscription-plans/:id`
*(Protected: Cannot delete plan if active subscribers are currently attached to it).*

---

### B. Subscriptions & Subscribers Management (Dashboard)

#### 1. List Subscribers
`GET /api/admin/subscriptions?page=1&limit=20&target=church&status=Active&search=Grace`
* **Query Params:**
  * `target`: `"individual"`, `"community"`, `"church"`, or `"all"`.
  * `status`: `"Active"`, `"Expired"`, `"Cancelled"`, or `"All"`.
  * `paymentStatus`: `"Paid"`, `"Pending"`, `"Failed"`, or `"All"`.
  * `search`: Filter by user/subscriber name or email.
* **Response:**
```json
{
  "data": [
    {
      "id": "6720f1...",
      "target": "church",
      "targetDisplayName": "Grace Community Church",
      "name": "Pastor David",
      "email": "pastor@gracechurch.org",
      "church": {
        "id": "671df9...",
        "name": "Grace Community Church",
        "email": "contact@gracechurch.org",
        "image": "https://.../church.jpg"
      },
      "community": null,
      "plan": "Church Growth & Live",
      "amount": "$49.99",
      "amountCents": 4999,
      "billing": "Monthly",
      "startDate": "Oct 27, 2026",
      "expiryDate": "Nov 26, 2026",
      "autoRenew": true,
      "status": "Active",
      "paymentStatus": "Paid",
      "transactionId": "SUB-MH3X-9A2"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 },
  "stats": {
    "totalSubscriptions": 142,
    "activeSubscriptions": 118,
    "expiredSubscriptions": 14,
    "cancelledSubscriptions": 10,
    "totalRevenue": "$14,580.00",
    "byTarget": {
      "individual": { "total": 85, "active": 72, "revenue": "$3,240.00" },
      "community": { "total": 35, "active": 28, "revenue": "$4,850.00" },
      "church": { "total": 22, "active": 18, "revenue": "$6,490.00" }
    }
  }
}
```

#### 2. Get Subscription Analytics Stats Overview
`GET /api/admin/subscriptions/stats`
* Returns total subscribers, active subscribers, revenue, and separate breakdowns for `individual`, `community`, and `church`.

#### 3. Get Single Subscriber Details
`GET /api/admin/subscriptions/:id`

#### 4. Manual Grant / Create Subscription (Admin)
`POST /api/admin/subscriptions`
* **Body:**
```json
{
  "userId": "USER_ID",
  "planId": "PLAN_ID",
  "target": "church",
  "churchId": "CHURCH_ID",
  "paymentStatus": "Paid",
  "status": "Active"
}
```

#### 5. Cancel Subscription (Admin)
`POST /api/admin/subscriptions/:id/cancel`

---

## 💎 3. Seeded Default Plans Summary

The backend automatically seeds these plans if not already present:

### 👤 Individual Plans
1. **Monthly Supporter** ($4.99/mo) — Ad-free, priority prayer request placement, supporter badge.
2. **Yearly Patron** ($49.99/yr) — 2 Months Free (Save 16%), VIP Patron Gold Badge, donation tools, early access.

### 👥 Community Plans
1. **Community Basic** ($9.99/mo) — Up to 500 members, group prayer wall & praise reports, media sharing.
2. **Community Pro** ($19.99/mo) — Unlimited members, live audio prayer rooms, pinned announcements, group analytics.
3. **Community Annual** ($199.99/yr) — All Pro features + 2 months free, featured placement in community search.

### ⛪ Church Plans
1. **Church Starter** ($29.99/mo) — Official Verified Blue Badge, member directory, church prayer wall, tithes button.
2. **Church Growth & Live** ($49.99/mo) — HD Sunday Live Stream via Agora, unlimited members, multi-pastor access, sermon podcasts.
3. **Church Sanctuary Annual** ($499.99/yr) — All Growth features + 2 months free ($100 savings), top Church Finder placement, 24/7 dedicated support.

---

## 🛠️ 4. React Native Redux Hooks Reference (`subscriptionApi.ts`)

In `INeedPrayer/src/redux/services/subscriptionApi.ts`:

```typescript
import {
  useGetSubscriptionPlansQuery,
  useGetSubscriptionPlansByTargetQuery,
  useGetSubscriptionStatusQuery,
  useSubscribeMutation,
  useCancelSubscriptionMutation,
} from "../../redux/services/subscriptionApi";

// 1. Get all plans (with categorized.individual, categorized.community, categorized.church)
const { data, isLoading } = useGetSubscriptionPlansQuery();

// 2. Get only church plans
const { data: churchPlans } = useGetSubscriptionPlansQuery("church");

// 3. Check Church Subscription Status
const { data: churchSub } = useGetSubscriptionStatusQuery({
  target: "church",
  churchId: "CHURCH_ID",
});

// 4. Subscribe to a Church Plan
const [subscribe, { isLoading: isSubscribing }] = useSubscribeMutation();
await subscribe({
  planId: selectedPlanId,
  target: "church",
  churchId: churchId,
}).unwrap();
```
