import sharp from "sharp";

function maxDimensionForKind(kind: string): number {
  switch (kind) {
    case "avatar":
      return 512;
    case "post":
    case "group":
    case "message":
      return 1200;
    case "banner":
    case "church_banner":
      return 1920;
    case "logo":
    case "church_logo":
      return 512;
    default:
      return 1200;
  }
}

/**
 * Resize + compress. Logos use PNG; other kinds use JPEG.
 * `kind` matches query `?kind=` on POST /api/upload/image (avatar, post, banner, church_logo, etc.).
 */
export async function compressImage(
  buffer: Buffer,
  kind: string
): Promise<{ buffer: Buffer; ext: string }> {
  const max = maxDimensionForKind(kind);
  const isLogo = kind === "logo" || kind === "church_logo";
  const rotated = sharp(buffer).rotate();

  if (isLogo) {
    const out = await rotated
      .resize(max, max, { fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
    return { buffer: out, ext: "png" };
  }

  const out = await rotated
    .resize(max, max, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  return { buffer: out, ext: "jpg" };
}
