import { randomBytes } from "crypto";
import { writeFile } from "fs/promises";
import path from "path";
import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { isB2Configured, publicUrlForUpload, UPLOAD_ROOT } from "../contants.js";
import { uploadImageToB2 } from "../utils/b2Storage.js";
import { compressImage } from "../utils/imageCompress.js";
import { ensureUploadDir } from "../utils/ensureUploadDir.js";

function normalizeKind(raw: unknown): string {
  const s = String(raw ?? "post")
    .toLowerCase()
    .trim();
  return s || "post";
}

export async function uploadImage(req: AuthRequest, res: Response): Promise<void> {
  const files = req.files as
    | Record<string, Express.Multer.File[]>
    | undefined;
  const file = files?.image?.[0] ?? files?.file?.[0];
  if (!file) {
    res
      .status(400)
      .json({ message: 'No image file (use multipart field "image" or "file")' });
    return;
  }

  const kind = normalizeKind(req.query.kind ?? (req.body as { kind?: string })?.kind);

  try {
    const { buffer, ext } = await compressImage(file.buffer, kind);
    const name = `${Date.now()}-${randomBytes(8).toString("hex")}.${ext}`;

    if (isB2Configured()) {
      const objectKey = `images/${name}`;
      const url = await uploadImageToB2(objectKey, buffer, ext);
      res.status(201).json({
        kind,
        storage: "b2" as const,
        url,
      });
      return;
    }

    await ensureUploadDir();
    const absPath = path.join(UPLOAD_ROOT, name);
    await writeFile(absPath, buffer);

    const urlPath = `/uploads/${name}`;
    res.status(201).json({
      kind,
      storage: "local" as const,
      ...publicUrlForUpload(urlPath),
    });
  } catch (e) {
    console.error("uploadImage", e);
    res.status(500).json({ message: "Could not process image" });
  }
}
