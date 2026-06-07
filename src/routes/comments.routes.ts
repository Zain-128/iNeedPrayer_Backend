import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import * as commentsController from "../controllers/comments.controller.js";

const router = Router();

router.patch("/:id", protect, commentsController.editComment);
router.delete("/:id", protect, commentsController.deleteComment);
router.post("/:id/report", protect, commentsController.reportComment);
router.post("/:id/pray", protect, commentsController.prayComment);
router.post("/:id/praise", protect, commentsController.praiseComment);

export default router;
