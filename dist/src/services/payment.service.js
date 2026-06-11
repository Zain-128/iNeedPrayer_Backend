import { PaymentMethod } from "../models/paymentMethod.model.js";
export async function listPaymentMethods(userId) {
    const rows = await PaymentMethod.find({ user: userId }).sort({ createdAt: -1 }).lean();
    return rows.map((p) => ({
        id: p._id.toString(),
        brand: p.brand,
        last4: p.last4,
        holderName: p.holderName,
    }));
}
export async function addPaymentMethod(userId, body) {
    if (!body.last4 || body.last4.length < 4) {
        const err = new Error("last4 is required");
        err.statusCode = 400;
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
export async function removePaymentMethod(userId, id) {
    const r = await PaymentMethod.deleteOne({ _id: id, user: userId });
    if (r.deletedCount === 0) {
        const err = new Error("Not found");
        err.statusCode = 404;
        throw err;
    }
}
