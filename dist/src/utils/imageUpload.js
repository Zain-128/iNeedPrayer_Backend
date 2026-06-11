import { randomBytes } from "crypto";
import { writeFile } from "fs/promises";
import path from "path";
import { isB2Configured, publicUrlForUpload, UPLOAD_ROOT } from "../contants.js";
import { uploadImageToB2 } from "./b2Storage.js";
import { compressImage } from "./imageCompress.js";
import { ensureUploadDir } from "./ensureUploadDir.js";
export async function saveUploadedImage(buffer, kind) {
    const { buffer: compressed, ext } = await compressImage(buffer, kind);
    const name = `${Date.now()}-${randomBytes(8).toString("hex")}.${ext}`;
    if (isB2Configured()) {
        const objectKey = `images/${kind}/${name}`;
        const url = await uploadImageToB2(objectKey, compressed, ext);
        return { url, storage: "b2" };
    }
    await ensureUploadDir();
    const absPath = path.join(UPLOAD_ROOT, name);
    await writeFile(absPath, compressed);
    const urlPath = `/uploads/${name}`;
    const urls = publicUrlForUpload(urlPath);
    return {
        url: urls.absoluteUrl ?? urls.url,
        absoluteUrl: urls.absoluteUrl,
        storage: "local",
    };
}
export function pickUploadedFile(files) {
    return files?.image?.[0] ?? files?.file?.[0];
}
