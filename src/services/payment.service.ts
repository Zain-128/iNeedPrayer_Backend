import { PaymentMethod } from "../models/paymentMethod.model.js";

export async function listPaymentMethods(userId: string) {
  const rows = await PaymentMethod.find({ user: userId }).sort({ createdAt: -1 }).lean();
  return rows.map((p) => ({
    id: p._id.toString(),
    brand: p.brand,
    last4: p.last4,
    holderName: p.holderName,
  }));
}

export async function addPaymentMethod(
  userId: string,
  body: { brand?: string; last4: string; holderName?: string; token?: string }
) {
  if (!body.last4 || body.last4.length < 4) {
    const err = new Error("last4 is required");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }
  const p = await PaymentMethod.create({
    user: userId,
    brand: body.brand ?? "card",
    last4: body.last4.slice(-4),
    holderName: body.holderName?.trim() ?? "",
    token: body.token?.trim() ?? "",
  });
  return {
    id: p._id.toString(),
    brand: p.brand,
    last4: p.last4,
    holderName: p.holderName,
  };
}

export async function removePaymentMethod(userId: string, id: string) {
  const r = await PaymentMethod.deleteOne({ _id: id, user: userId });
  if (r.deletedCount === 0) {
    const err = new Error("Not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
}
