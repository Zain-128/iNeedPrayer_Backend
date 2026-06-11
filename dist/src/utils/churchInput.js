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
export function normalizeChurchInput(body) {
    const b = (body ?? {});
    const country = (b.country ?? "").trim();
    const state = (b.state ?? "").trim();
    const city = (b.city ?? "").trim();
    const streetAddress = (b.streetAddress ?? "").trim();
    const landmark = (b.landmark ?? "").trim();
    return {
        name: (b.name ?? b.churchName ?? "").trim(),
        website: (b.website ?? "").trim(),
        country,
        state,
        city,
        streetAddress,
        landmark,
        locationShort: buildLocationShort({
            city,
            state,
            country,
            locationShort: b.locationShort,
        }),
        locationFull: buildLocationFull({
            streetAddress,
            landmark,
            city,
            state,
            country,
            locationFull: b.locationFull,
        }),
        email: (b.email ?? b.businessEmail ?? "").trim(),
        phone: (b.phone ?? b.businessPhone ?? "").trim(),
        shortBio: (b.shortBio ?? "").trim(),
        about: (b.about ?? b.aboutChurch ?? "").trim(),
        image: (b.image ?? b.logo ?? "").trim(),
        bannerImage: (b.bannerImage ?? "").trim(),
        denomination: (b.denomination ?? "").trim(),
        liveStreamUrl: (b.liveStreamUrl ?? "").trim(),
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
