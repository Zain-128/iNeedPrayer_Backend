import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import * as commentsController from "../controllers/comments.controller.js";

const router = Router();

router.delete("/:id", protect, commentsController.deleteComment);
router.post("/:id/report", protect, commentsController.reportComment);

export default router;
