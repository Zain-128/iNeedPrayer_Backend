import { User } from "../models/user.model.js";
import { UserSubscription } from "../models/userSubscription.model.js";
import { SubscriptionPlan } from "../models/subscriptionPlan.model.js";
import * as stripeService from "./stripe.service.js";

export async function getSubscriptionStatus(userId: string) {
  const u = await User.findById(userId).lean();
  if (!u) {
    const err = new Error("User not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }

  const activeSub = await stripeService.getUserSubscription(userId);

  if (activeSub) {
    const plan = activeSub.plan as any;
    return {
      active: true,
      plan: plan?.name || activeSub.planName,
      planId: plan?._id?.toString() || null,
      billingCycle: activeSub.billing,
      expiryDate: activeSub.expiryDate,
      autoRenew: activeSub.autoRenew,
      startDate: activeSub.startDate,
    };
  }

  return {
    active: false,
    plan: "none",
    planId: null,
    billingCycle: null,
    expiryDate: null,
    autoRenew: false,
  };
}

export async function subscribeStub(userId: string) {
  return {
    active: true,
    plan: "community_stub",
    message: "Stub activation only — connect a payment provider for production.",
  };
}

export async function getActiveSubscriptionPlans() {
  let plans = await SubscriptionPlan.find({ isActive: true })
    .sort({ priceCents: 1 })
    .lean();

  if (plans.length === 0) {
    const defaultPlans = [
      {
        name: "Monthly Supporter",
        description: "Full access to community features, priority prayer requests, and ad-free experience.",
        priceCents: 499,
        billingCycle: "Monthly" as const,
        features: [
          "Ad-free experience",
          "Priority prayer requests",
          "Exclusive live stream badges",
          "Unlimited community groups",
        ],
        isActive: true,
        trialPeriodDays: 7,
        appStoreProductId: "com.ineedprayer.sub.monthly",
        googlePlayProductId: "com.ineedprayer.sub.monthly",
      },
      {
        name: "Yearly Patron",
        description: "Best value! Annual access with 2 months free and special supporter icon.",
        priceCents: 4999,
        billingCycle: "Yearly" as const,
        features: [
          "All Monthly features",
          "2 Months Free (Save 16%)",
          "Special Supporter Icon & Badge",
          "Direct church donation features",
        ],
        isActive: true,
        trialPeriodDays: 14,
        appStoreProductId: "com.ineedprayer.sub.yearly",
        googlePlayProductId: "com.ineedprayer.sub.yearly",
      },
    ];

    plans = (await SubscriptionPlan.create(defaultPlans)) as any;
  }

  return plans.map((p) => ({
    id: p._id.toString(),
    _id: p._id.toString(),
    name: p.name,
    description: p.description || "",
    priceCents: p.priceCents,
    priceDisplay: `$${(p.priceCents / 100).toFixed(2)}`,
    billingCycle: p.billingCycle,
    features: p.features || [],
    isActive: p.isActive,
    trialPeriodDays: p.trialPeriodDays ?? 0,
    subscribersCount: p.subscribersCount ?? 0,
    appStoreProductId:
      (p as any).appStoreProductId ||
      `com.ineedprayer.sub.${String(p.billingCycle).toLowerCase()}`,
    googlePlayProductId:
      (p as any).googlePlayProductId ||
      `com.ineedprayer.sub.${String(p.billingCycle).toLowerCase()}`,
  }));
}
