/** Maps CreateChurchScreen / EditChurchScreen field names to API shape. */
export type ChurchSocialLink = {
  platform: string;
  url: string;
};

export type NormalizedChurchInput = {
  name: string;
  website: string;
  country: string;
  state: string;
  city: string;
  streetAddress: string;
  landmark: string;
  locationShort: string;
  locationFull: string;
  email: string;
  phone: string;
  shortBio: string;
  about: string;
  image: string;
  bannerImage: string;
  denomination: string;
  liveStreamUrl: string;
  pastorName: string;
  socialLinks: ChurchSocialLink[];
  /** True when client sent `socialLinks` (even empty). */
  socialLinksProvided: boolean;
};

export function buildLocationShort(parts: {
  city?: string;
  state?: string;
  country?: string;
  locationShort?: string;
}): string {
  if (parts.locationShort?.trim()) return parts.locationShort.trim();
  const city = parts.city?.trim();
  const state = parts.state?.trim();
  const country = parts.country?.trim();
  if (city && country) {
    const region = state || country;
    return `${city}, ${region.length <= 3 ? region.toUpperCase() : region}`;
  }
  return city || state || country || "";
}

export function buildLocationFull(parts: {
  streetAddress?: string;
  landmark?: string;
  city?: string;
  state?: string;
  country?: string;
  locationFull?: string;
}): string {
  if (parts.locationFull?.trim()) return parts.locationFull.trim();
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

function normalizeSocialLinks(raw: unknown): ChurchSocialLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const platform = String(row.platform ?? "").trim().toLowerCase();
      const url = String(row.url ?? "").trim();
      if (!platform || !url) return null;
      return { platform, url };
    })
    .filter((x): x is ChurchSocialLink => !!x);
}

export function normalizeChurchInput(
  body: Record<string, unknown> | null | undefined
): NormalizedChurchInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const str = (key: string) => String(b[key] ?? "").trim();

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
    bannerImage: str("bannerImage"),
    denomination: str("denomination"),
    liveStreamUrl: str("liveStreamUrl"),
    pastorName:
      str("pastorName") ||
      str("pastorOrLeaderName") ||
      str("pastor"),
    socialLinks: normalizeSocialLinks(b.socialLinks),
    socialLinksProvided: Array.isArray(b.socialLinks),
  };
}

export function validateCreateChurchInput(input: NormalizedChurchInput): string | null {
  if (!input.name) return "Church name is required.";
  if (!input.country) return "Country is required.";
  if (!input.city) return "City is required.";
  if (!input.streetAddress) return "Street address is required.";
  if (!input.email) return "Business email is required.";
  if (!input.phone) return "Business phone is required.";
  return null;
}
