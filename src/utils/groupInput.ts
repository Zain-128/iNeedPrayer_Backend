export type NormalizedGroupInput = {
  name: string;
  image: string;
  description: string;
};

export function normalizeGroupInput(
  body: Record<string, unknown> | null | undefined
): NormalizedGroupInput {
  const b = (body ?? {}) as Record<string, string | undefined>;
  return {
    name: (b.name ?? b.groupName ?? "").trim(),
    image: (b.image ?? "").trim(),
    description: (b.description ?? "").trim(),
  };
}

export function validateCreateGroupInput(input: NormalizedGroupInput): string | null {
  if (!input.name) return "Group name is required.";
  return null;
}
