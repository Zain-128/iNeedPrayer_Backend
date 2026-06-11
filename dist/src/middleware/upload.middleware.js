import multer from "multer";
const storage = multer.memoryStorage();
const limits = { fileSize: 10 * 1024 * 1024 };
const allowed = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
]);
const fileFilter = (_req, file, cb) => {
    if (allowed.has(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error("Only JPEG, PNG, WebP, or GIF images are allowed"));
    }
};
const uploadImageMulter = multer({ storage, limits, fileFilter });
/**
 * Accepts one file in field `image` or `file` (React Native FormData friendly).
 */
export function uploadImageFields(req, res, next) {
    uploadImageMulter.fields([
        { name: "image", maxCount: 1 },
        { name: "file", maxCount: 1 },
    ])(req, res, (err) => {
        if (err) {
            const msg = err instanceof Error ? err.message : "Upload failed";
            return res.status(400).json({ message: msg });
        }
        next();
    });
}
