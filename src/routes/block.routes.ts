import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import * as blockController from "../controllers/block.controller.js";

const router = Router();

router.get("/status", protect, blockController.checkBlockStatus);

export default router;
