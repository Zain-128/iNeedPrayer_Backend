import { User } from "../models/user.model.js";
import { UserSubscription } from "../models/userSubscription.model.js";
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
