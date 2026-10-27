import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware.js";
import * as subscriptionService from "../services/subscription.service.js";
import * as stripeService from "../services/stripe.service.js";

export const getPlans = async (req: AuthRequest, res: Response) => {
  try {
    const rawTarget =
      (req.query.target as string) || (req.params.target as string) || null;
    const result = await subscriptionService.getActiveSubscriptionPlans(rawTarget);
    return res.json({
      success: true,
      target: rawTarget ? subscriptionService.normalizeTarget(rawTarget) : "all",
      plans: result.plans,
      data: result.plans,
      categorized: result.categorized,
    });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const getStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const { target, churchId, communityId } = (req.query ?? {}) as {
      target?: string;
      churchId?: string;
      communityId?: string;
    };
    const subscription = await subscriptionService.getSubscriptionStatus(
      req.userId,
      { target, churchId, communityId }
    );
    return res.json({ subscription });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const subscribe = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const { planId, target, churchId, communityId } = req.body ?? {};
    if (!planId) {
      return res.status(400).json({ message: "planId is required" });
    }
    const result = await subscriptionService.createOrCheckoutSubscription(
      req.userId,
      { planId, target, churchId, communityId }
    );
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const cancel = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const { subscriptionId, target, churchId, communityId } = {
      ...(req.query as Record<string, unknown>),
      ...(req.body as Record<string, unknown>),
    } as {
      subscriptionId?: string;
      target?: string;
      churchId?: string;
      communityId?: string;
    };
    const result = await subscriptionService.cancelSubscription(req.userId, {
      subscriptionId,
      target,
      churchId,
      communityId,
    });
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
    const { packageIndex, customCoins } = req.body ?? {};

    if (customCoins !== undefined && customCoins !== null) {
      const checkout = await stripeService.createCustomCoinsCheckout(
        req.userId,
        Number(customCoins)
      );
      return res.json(checkout);
    }

    if (packageIndex === undefined || packageIndex === null) {
      return res
        .status(400)
        .json({ message: "packageIndex or customCoins is required" });
    }
    const checkout = await stripeService.createCoinsCheckout(
      req.userId,
      Number(packageIndex)
    );
    return res.json(checkout);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};
