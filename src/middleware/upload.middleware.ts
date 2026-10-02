import type { NextFunction, Request, Response } from "express";
import multer from "multer";

const storage = multer.memoryStorage();
const imageLimits = { fileSize: 10 * 1024 * 1024 };
const videoLimits = { fileSize: 100 * 1024 * 1024 };

const allowedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const allowedVideoTypes = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/3gpp",
  "video/x-msvideo",
  "video/avi",
  "video/mkv",
  "video/mpeg",
]);

const imageFileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (allowedImageTypes.has(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, WebP, or GIF images are allowed"));
  }
};

const videoFileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (allowedVideoTypes.has(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error("Only MP4, MOV, WebM, 3GP, AVI, or MKV videos are allowed"));
  }
};

const mediaFileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const mime = file.mimetype.toLowerCase();
  if (allowedImageTypes.has(mime) || allowedVideoTypes.has(mime)) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported media format. Allowed: images (JPEG, PNG, WebP, GIF) and videos (MP4, MOV, WebM, 3GP, AVI, MKV)"));
  }
};

const uploadImageMulter = multer({ storage, limits: imageLimits, fileFilter: imageFileFilter });
const uploadVideoMulter = multer({ storage, limits: videoLimits, fileFilter: videoFileFilter });
const uploadMediaMulter = multer({ storage, limits: videoLimits, fileFilter: mediaFileFilter });

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
    { name: "media", maxCount: 1 },
    { name: "files", maxCount: 1 },
  ])(req, res, (err: unknown) => {
    if (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      return res.status(400).json({ message: msg });
    }
    next();
  });
}

/**
 * Accepts video file in field `video` or `file`.
 */
export function uploadVideoFields(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  uploadVideoMulter.fields([
    { name: "video", maxCount: 1 },
    { name: "file", maxCount: 1 },
    { name: "media", maxCount: 1 },
    { name: "files", maxCount: 1 },
  ])(req, res, (err: unknown) => {
    if (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      return res.status(400).json({ message: msg });
    }
    next();
  });
}

/**
 * Accepts image or video file in field `file`, `video`, `image`, `media`, `files`.
 */
export function uploadMediaFields(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  uploadMediaMulter.fields([
    { name: "file", maxCount: 1 },
    { name: "video", maxCount: 1 },
    { name: "image", maxCount: 1 },
    { name: "media", maxCount: 1 },
    { name: "files", maxCount: 1 },
  ])(req, res, (err: unknown) => {
    if (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      return res.status(400).json({ message: msg });
    }
    next();
  });
}
