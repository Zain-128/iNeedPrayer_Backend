import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import * as subscriptionController from "../controllers/subscription.controller.js";

const router = Router();

router.get("/status", protect, subscriptionController.getStatus);
router.post("/subscribe", protect, subscriptionController.subscribe);
router.post("/cancel", protect, subscriptionController.cancel);

router.get("/coins/packages", subscriptionController.getCoinsPackages);
router.get("/coins/balance", protect, subscriptionController.getCoinsBalance);
router.post("/coins/purchase", protect, subscriptionController.purchaseCoins);

export default router;
