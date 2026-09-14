import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware.js";
import * as subscriptionService from "../services/subscription.service.js";
import * as stripeService from "../services/stripe.service.js";

export const getStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const subscription = await subscriptionService.getSubscriptionStatus(req.userId);
    return res.json({ subscription });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const subscribe = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const { planId } = req.body ?? {};
    if (!planId) {
      return res.status(400).json({ message: "planId is required" });
    }
    const checkout = await stripeService.createSubscriptionCheckout(req.userId, planId);
    return res.json(checkout);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const cancel = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const result = await stripeService.cancelSubscription(req.userId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const getCoinsPackages = async (_req: AuthRequest, res: Response) => {
  try {
    const packages = await stripeService.getCoinsPackages();
    return res.json({ packages });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const getCoinsBalance = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const coins = await stripeService.getUserCoins(req.userId);
    return res.json(coins);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const purchaseCoins = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const { packageIndex } = req.body ?? {};
    if (packageIndex === undefined || packageIndex === null) {
      return res.status(400).json({ message: "packageIndex is required (0-3)" });
    }
    const checkout = await stripeService.createCoinsCheckout(req.userId, packageIndex);
    return res.json(checkout);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};
