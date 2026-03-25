import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import * as chatController from "../controllers/chat.controller.js";

const router = Router();

router.get("/", protect, chatController.listConversations);
router.post("/", protect, chatController.openConversation);
router.post("/group", protect, chatController.createGroup);
router.get("/:id/messages", protect, chatController.listMessages);
router.post("/:id/messages", protect, chatController.sendMessage);
router.post("/:id/leave", protect, chatController.leaveGroup);
router.delete("/:id/me", protect, chatController.hideConversation);

export default router;
