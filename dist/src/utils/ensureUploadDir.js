import { mkdir } from "fs/promises";
import { UPLOAD_ROOT } from "../contants.js";
export async function ensureUploadDir() {
    await mkdir(UPLOAD_ROOT, { recursive: true });
}
