export function normalizeGroupInput(body) {
    const b = (body ?? {});
    return {
        name: (b.name ?? b.groupName ?? "").trim(),
        image: (b.image ?? b.logo ?? "").trim(),
        bannerImage: (b.bannerImage ?? b.banner ?? "").trim(),
        description: (b.description ?? "").trim(),
    };
}
export function validateCreateGroupInput(input) {
    if (!input.name)
        return "Group name is required.";
    return null;
}
