import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/social-login", authController.socialLogin);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.post("/delete-account", protect, authController.deleteAccount);
router.get("/me", protect, authController.getMe);

export default router;
