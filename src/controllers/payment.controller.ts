import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth.middleware.js";
import * as paymentService from "../services/payment.service.js";
import { paramStr } from "../utils/routeParams.js";

export const listMethods = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const paymentMethods = await paymentService.listPaymentMethods(req.userId);
    return res.json({ paymentMethods });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const addMethod = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const method = await paymentService.addPaymentMethod(req.userId, req.body ?? {});
    return res.status(201).json({ paymentMethod: method });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const removeMethod = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    await paymentService.removePaymentMethod(req.userId, id);
    return res.json({ message: "Removed" });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};
