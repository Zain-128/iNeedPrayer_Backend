import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import * as chatController from "../controllers/chat.controller.js";

const router = Router();

// Lists & Stats (must come before /:id)
router.get("/requests", protect, chatController.listRequests);
router.get("/archived", protect, chatController.listArchived);
router.get("/unread-count", protect, chatController.getUnreadCount);
router.get("/", protect, chatController.listConversations);

// Create / Open
router.post("/", protect, chatController.openConversation);
router.post("/group", protect, chatController.createGroup);

// Single conversation actions
router.get("/:id", protect, chatController.getConversationDetails);
router.patch("/:id", protect, chatController.updateGroup);
router.post("/:id/read", protect, chatController.markAsRead);
router.post("/:id/accept", protect, chatController.acceptRequest);
router.post("/:id/decline", protect, chatController.declineRequest);
router.post("/:id/archive", protect, chatController.archiveConversation);
router.post("/:id/mute", protect, chatController.muteConversation);
router.post("/:id/leave", protect, chatController.leaveGroup);
router.delete("/:id/me", protect, chatController.hideConversation);

// Members & Admins
router.post("/:id/members", protect, chatController.addMembers);
router.delete("/:id/members/:userId", protect, chatController.removeMember);
router.post("/:id/admins/:userId", protect, chatController.promoteAdmin);
router.delete("/:id/admins/:userId", protect, chatController.demoteAdmin);

// Messages
router.get("/:id/messages", protect, chatController.listMessages);
router.post("/:id/messages", protect, chatController.sendMessage);
router.patch("/:id/messages/:messageId", protect, chatController.editMessage);
router.delete("/:id/messages/:messageId", protect, chatController.deleteMessage);

export default router;
