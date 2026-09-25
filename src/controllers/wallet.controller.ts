import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware.js";
import * as walletService from "../services/wallet.service.js";
import * as stripeService from "../services/stripe.service.js";

function scopeFromParam(raw: unknown): "group" | "church" | null {
  return raw === "group" || raw === "church" ? raw : null;
}

export const getMyWallet = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const [wallet, ledger] = await Promise.all([
      walletService.getUserWalletSummary(req.userId),
      walletService.getUserLedger(req.userId, 40),
    ]);
    return res.json({ wallet, ledger });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const getPackages = async (_req: AuthRequest, res: Response) => {
  try {
    const packages = await stripeService.getCoinsPackages();
    return res.json({ packages });
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
      return res.status(400).json({
        message: "packageIndex or customCoins is required",
      });
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

export const verifyIapPurchase = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });

    const { platform, productId, receipt, purchaseToken, transactionId } =
      req.body ?? {};

    if (!platform || (platform !== "ios" && platform !== "android")) {
      return res.status(400).json({
        message: "platform must be 'ios' or 'android'",
      });
    }

    if (!productId) {
      return res.status(400).json({
        message: "productId is required",
      });
    }

    const result = await walletService.verifyAndProcessIapPurchase({
      userId: req.userId,
      platform,
      productId: String(productId),
      receipt: receipt ? String(receipt) : undefined,
      purchaseToken: purchaseToken ? String(purchaseToken) : undefined,
      transactionId: transactionId ? String(transactionId) : undefined,
    });

    return res.status(200).json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const donate = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const scope = scopeFromParam(req.body?.scope);
    const entityId = String(req.body?.entityId ?? "");
    const coins = Number(req.body?.coins);
    const message =
      typeof req.body?.message === "string" ? req.body.message : "";

    if (!scope) {
      return res.status(400).json({ message: "scope must be group or church" });
    }

    const result = await walletService.spendCoinsToEntity({
      userId: req.userId,
      scope,
      entityId,
      coins,
      kind: "donation",
      message,
    });
    return res.status(201).json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const superChat = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const scope = scopeFromParam(req.body?.scope);
    const entityId = String(req.body?.entityId ?? "");
    const sessionId = String(req.body?.sessionId ?? "");
    const coins = Number(req.body?.coins);
    const message =
      typeof req.body?.message === "string" ? req.body.message : "";

    if (!scope) {
      return res.status(400).json({ message: "scope must be group or church" });
    }

    const result = await walletService.spendCoinsToEntity({
      userId: req.userId,
      scope,
      entityId,
      coins,
      kind: "superchat",
      message,
      sessionId,
    });
    return res.status(201).json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const getEntityWallet = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const scope = scopeFromParam(req.params.scope);
    const entityId = String(req.params.entityId ?? "");
    if (!scope) {
      return res.status(400).json({ message: "scope must be group or church" });
    }

    const [wallet, ledger, withdrawals] = await Promise.all([
      walletService.getEntityWalletSummary(scope, entityId, req.userId),
      walletService.getEntityLedger(scope, entityId, req.userId, 40),
      walletService.listEntityWithdrawals(scope, entityId, req.userId),
    ]);
    return res.json({ wallet, ledger, withdrawals });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const requestWithdrawal = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const scope = scopeFromParam(req.params.scope);
    const entityId = String(req.params.entityId ?? "");
    if (!scope) {
      return res.status(400).json({ message: "scope must be group or church" });
    }

    const result = await walletService.requestWithdrawal({
      userId: req.userId,
      scope,
      entityId,
      coins: Number(req.body?.coins),
      method: req.body?.method,
      account: req.body?.account,
    });
    return res.status(201).json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};
