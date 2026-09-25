import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import * as walletController from "../controllers/wallet.controller.js";

const router = Router();

router.get("/me", protect, walletController.getMyWallet);
router.get("/coins/packages", walletController.getPackages);
router.post("/coins/purchase", protect, walletController.purchaseCoins);
router.post("/coins/verify-iap", protect, walletController.verifyIapPurchase);

router.post("/donate", protect, walletController.donate);
router.post("/superchat", protect, walletController.superChat);

router.get(
  "/entity/:scope/:entityId",
  protect,
  walletController.getEntityWallet
);
router.post(
  "/entity/:scope/:entityId/withdraw",
  protect,
  walletController.requestWithdrawal
);

export default router;
