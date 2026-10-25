export type NormalizedGroupInput = {
  name: string;
  image: string;
  bannerImage: string;
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

  return {
    name: (b.name ?? b.groupName ?? "").trim(),
    image: (b.image ?? b.logo ?? "").trim(),
    bannerImage: (b.bannerImage ?? b.banner ?? "").trim(),
    description: (b.description ?? "").trim(),
    privacy,
  };
}

export function validateCreateGroupInput(input: NormalizedGroupInput): string | null {
  if (!input.name) return "Group name is required.";
  return null;
}
