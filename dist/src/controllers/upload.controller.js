import { pickUploadedFile, saveUploadedImage } from "../utils/imageUpload.js";
export async function uploadImage(req, res) {
    const file = pickUploadedFile(req.files);
    if (!file) {
        res
            .status(400)
            .json({ message: 'No image file (use multipart field "image" or "file")' });
        return;
    }
    const kind = String(req.query.kind ?? req.body?.kind ?? "post")
        .toLowerCase()
        .trim();
    try {
        const saved = await saveUploadedImage(file.buffer, kind || "post");
        res.status(201).json({
            kind: kind || "post",
            storage: saved.storage,
            url: saved.url,
            ...(saved.absoluteUrl ? { absoluteUrl: saved.absoluteUrl } : {}),
        });
    }
    catch (e) {
        console.error("uploadImage", e);
        res.status(500).json({ message: "Could not process image" });
    }
}
