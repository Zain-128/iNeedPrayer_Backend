import { Router } from "express";
import * as socialAuthController from "../controllers/socialAuth.controller.js";

const router = Router();

router.post("/google", socialAuthController.googleLogin);
router.post("/apple", socialAuthController.appleLogin);

export default router;

