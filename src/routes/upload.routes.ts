import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import {
  uploadImageFields,
  uploadVideoFields,
  uploadMediaFields,
} from "../middleware/upload.middleware.js";
import * as uploadController from "../controllers/upload.controller.js";

const router = Router();

router.post("/image", protect, uploadImageFields, uploadController.uploadImage);
router.post("/video", protect, uploadVideoFields, uploadController.uploadVideo);
router.post("/media", protect, uploadMediaFields, uploadController.uploadMedia);
router.get("/status", uploadController.getUploadStatus);

export default router;
