import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import * as subscriptionController from "../controllers/subscription.controller.js";

const router = Router();

router.get("/status", protect, subscriptionController.getStatus);
router.post("/subscribe", protect, subscriptionController.subscribe);

export default router;
