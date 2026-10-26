export type NormalizedGroupInput = {
  name: string;
  image: string;
  bannerImage: string;
  images?: string[];
  description: string;
  privacy?: "Public" | "Private";
};

export function normalizeGroupInput(
  body: Record<string, unknown> | null | undefined
): NormalizedGroupInput {
  const b = (body ?? {}) as Record<string, any>;
  let privacy: "Public" | "Private" | undefined = undefined;
  if (b.privacy === "Private" || b.privacy === "private" || b.isPrivate === true || b.isPrivate === "true") {
    privacy = "Private";
  } else if (b.privacy === "Public" || b.privacy === "public" || b.isPrivate === false || b.isPrivate === "false") {
    privacy = "Public";
  }

  let images: string[] | undefined = undefined;
  if (Array.isArray(b.images)) {
    images = b.images.map((x: any) => String(x ?? "").trim()).filter(Boolean);
  } else if (typeof b.images === "string" && b.images.trim()) {
    try {
      const parsed = JSON.parse(b.images);
      if (Array.isArray(parsed)) {
        images = parsed.map((x: any) => String(x ?? "").trim()).filter(Boolean);
      } else {
        images = [b.images.trim()];
      }
    } catch {
      images = b.images.split(",").map((x: string) => x.trim()).filter(Boolean);
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

export function validateCreateGroupInput(input: NormalizedGroupInput): string | null {
  if (!input.name) return "Group name is required.";
  return null;
}
