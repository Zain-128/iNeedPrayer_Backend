import { User } from "../models/user.model.js";

/** Placeholder until billing is integrated (no live stream). */
export async function getSubscriptionStatus(userId: string) {
  const u = await User.findById(userId).lean();
  if (!u) {
    const err = new Error("User not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  return {
    active: false,
    plan: "none",
    message: "Community subscription is not activated for this account.",
  };
}

export async function subscribeStub(userId: string) {
  return {
    active: true,
    plan: "community_stub",
    message: "Stub activation only — connect a payment provider for production.",
  };
}
