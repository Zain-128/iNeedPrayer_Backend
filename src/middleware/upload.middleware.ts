import type { NextFunction, Request, Response } from "express";
import multer from "multer";

const storage = multer.memoryStorage();
const limits = { fileSize: 10 * 1024 * 1024 };

const allowed = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (allowed.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, WebP, or GIF images are allowed"));
  }
};

const uploadImageMulter = multer({ storage, limits, fileFilter });

/**
 * Accepts one file in field `image` or `file` (React Native FormData friendly).
 */
export function uploadImageFields(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  uploadImageMulter.fields([
    { name: "image", maxCount: 1 },
    { name: "file", maxCount: 1 },
  ])(req, res, (err: unknown) => {
    if (err) {
      const msg =
        err instanceof Error ? err.message : "Upload failed";
      return res.status(400).json({ message: msg });
    }
    next();
  });
}
