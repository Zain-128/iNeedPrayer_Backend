import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import * as notificationsController from "../controllers/notifications.controller.js";

const router = Router();

router.get("/", protect, notificationsController.listNotifications);
router.patch("/:id/read", protect, notificationsController.markRead);
router.post("/read-all", protect, notificationsController.markAllRead);

export default router;
