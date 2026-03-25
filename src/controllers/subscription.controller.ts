import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware.js";
import * as subscriptionService from "../services/subscription.service.js";

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
    const subscription = await subscriptionService.subscribeStub(req.userId);
    return res.json({ subscription });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};
