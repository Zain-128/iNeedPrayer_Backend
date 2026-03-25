import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import { optionalAuth } from "../middleware/optionalAuth.middleware.js";
import * as postsController from "../controllers/posts.controller.js";

const router = Router();

router.get("/", optionalAuth, postsController.listPosts);
router.post("/", protect, postsController.createPost);

router.get("/:id/comments", optionalAuth, postsController.listComments);
router.post("/:id/comments", protect, postsController.addComment);
router.post("/:id/report", protect, postsController.reportPost);
router.post("/:id/pray", protect, postsController.pray);
router.post("/:id/praise", protect, postsController.praise);
router.post("/:id/share", optionalAuth, postsController.share);
router.get("/:id/pray-praise-users", optionalAuth, postsController.prayPraiseUsers);

router.get("/:id", optionalAuth, postsController.getPost);
router.patch("/:id", protect, postsController.updatePost);
router.delete("/:id", protect, postsController.deletePost);

export default router;
