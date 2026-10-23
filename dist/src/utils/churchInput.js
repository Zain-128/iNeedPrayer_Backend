export function buildLocationShort(parts) {
    if (parts.locationShort?.trim())
        return parts.locationShort.trim();
    const city = parts.city?.trim();
    const state = parts.state?.trim();
    const country = parts.country?.trim();
    if (city && country) {
        const region = state || country;
        return `${city}, ${region.length <= 3 ? region.toUpperCase() : region}`;
    }
    return city || state || country || "";
}
export function buildLocationFull(parts) {
    if (parts.locationFull?.trim())
        return parts.locationFull.trim();
    return [
        parts.streetAddress?.trim(),
        parts.landmark?.trim(),
        parts.city?.trim(),
        parts.state?.trim(),
        parts.country?.trim(),
    ]
        .filter(Boolean)
        .join(", ");
}
function normalizeSocialLinks(raw) {
    if (!Array.isArray(raw))
        return [];
    return raw
        .map((item) => {
        if (!item || typeof item !== "object")
            return null;
        const row = item;
        const platform = String(row.platform ?? "").trim().toLowerCase();
        const url = String(row.url ?? "").trim();
        if (!platform || !url)
            return null;
        return { platform, url };
    })
        .filter((x) => !!x);
}
export function normalizeChurchInput(body) {
    const b = (body ?? {});
    const str = (key) => String(b[key] ?? "").trim();
    const country = str("country");
    const state = str("state");
    const city = str("city");
    const streetAddress = str("streetAddress");
    const landmark = str("landmark");
    return {
        name: str("name") || str("churchName"),
        website: str("website"),
        country,
        state,
        city,
        streetAddress,
        landmark,
        locationShort: buildLocationShort({
            city,
            state,
            country,
            locationShort: str("locationShort"),
        }),
        locationFull: buildLocationFull({
            streetAddress,
            landmark,
            city,
            state,
            country,
            locationFull: str("locationFull"),
        }),
        email: str("email") || str("businessEmail"),
        phone: str("phone") || str("businessPhone"),
        shortBio: str("shortBio"),
        about: str("about") || str("aboutChurch"),
        image: str("image") || str("logo"),
        bannerImage: str("bannerImage") || str("banner"),
        denomination: str("denomination"),
        liveStreamUrl: str("liveStreamUrl"),
        pastorName: str("pastorName") ||
            str("pastorOrLeaderName") ||
            str("pastor"),
        socialLinks: normalizeSocialLinks(b.socialLinks),
        socialLinksProvided: Array.isArray(b.socialLinks),
    };
}
export function validateCreateChurchInput(input) {
    if (!input.name)
        return "Church name is required.";
    if (!input.country)
        return "Country is required.";
    if (!input.city)
        return "City is required.";
    if (!input.streetAddress)
        return "Street address is required.";
    if (!input.email)
        return "Business email is required.";
    if (!input.phone)
        return "Business phone is required.";
    return null;
}
