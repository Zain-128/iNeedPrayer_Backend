import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import * as searchController from "../controllers/search.controller.js";

const router = Router();

router.get("/", protect, searchController.search);

export default router;
