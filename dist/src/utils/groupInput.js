export function normalizeGroupInput(body) {
    const b = (body ?? {});
    let privacy = undefined;
    if (b.privacy === "Private" || b.privacy === "private" || b.isPrivate === true || b.isPrivate === "true") {
        privacy = "Private";
    }
    else if (b.privacy === "Public" || b.privacy === "public" || b.isPrivate === false || b.isPrivate === "false") {
        privacy = "Public";
    }
    let images = undefined;
    if (Array.isArray(b.images)) {
        images = b.images.map((x) => String(x ?? "").trim()).filter(Boolean);
    }
    else if (typeof b.images === "string" && b.images.trim()) {
        try {
            const parsed = JSON.parse(b.images);
            if (Array.isArray(parsed)) {
                images = parsed.map((x) => String(x ?? "").trim()).filter(Boolean);
            }
            else {
                images = [b.images.trim()];
            }
        }
        catch {
            images = b.images.split(",").map((x) => x.trim()).filter(Boolean);
        }
    }
    return {
        name: (b.name ?? b.groupName ?? "").trim(),
        image: (b.image ?? b.logo ?? "").trim(),
        bannerImage: (b.bannerImage ?? b.banner ?? "").trim(),
        images,
        description: (b.description ?? "").trim(),
        privacy,
    };
}
export function validateCreateGroupInput(input) {
    if (!input.name)
        return "Group name is required.";
    return null;
}
