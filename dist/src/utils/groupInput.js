export function normalizeGroupInput(body) {
    const b = (body ?? {});
    let privacy = undefined;
    if (b.privacy === "Private" || b.privacy === "private" || b.isPrivate === true || b.isPrivate === "true") {
        privacy = "Private";
    }
    else if (b.privacy === "Public" || b.privacy === "public" || b.isPrivate === false || b.isPrivate === "false") {
        privacy = "Public";
    }
    return {
        name: (b.name ?? b.groupName ?? "").trim(),
        image: (b.image ?? b.logo ?? "").trim(),
        bannerImage: (b.bannerImage ?? b.banner ?? "").trim(),
        description: (b.description ?? "").trim(),
        privacy,
    };
}
export function validateCreateGroupInput(input) {
    if (!input.name)
        return "Group name is required.";
    return null;
}
