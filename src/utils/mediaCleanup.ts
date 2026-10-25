import { unlink } from "fs/promises";
import path from "path";
import { UPLOAD_ROOT } from "../contants.js";

/**
 * Best-effort delete of files stored on local disk under /uploads.
 * Accepts relative (/uploads/x.jpg) or absolute (https://host/uploads/x.jpg) URLs;
 * anything else (e.g. Backblaze B2 URLs) is ignored.
 */
export async function deleteLocalMediaFiles(urls: string[]): Promise<void> {
  const root = path.resolve(UPLOAD_ROOT);
  await Promise.all(
    urls.map(async (url) => {
      const match = url?.trim().match(/\/uploads\/([^?#]+)/i);
      if (!match) return;
      const absPath = path.resolve(root, decodeURIComponent(match[1]));
      // Never touch anything outside the uploads directory.
      if (!absPath.startsWith(root + path.sep)) return;
      try {
        await unlink(absPath);
      } catch (err: any) {
        if (err.code !== "ENOENT") {
          console.warn(`[media] Could not delete ${absPath}:`, err.message);
        }
      }
    })
  );
}
