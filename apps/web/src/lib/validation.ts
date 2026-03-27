export const trimmedText = (value?: string | null) => value?.trim() ?? "";

export const hasText = (value?: string | null) => trimmedText(value).length > 0;

export const trimmedList = (values?: Array<string | null | undefined>) =>
  (values ?? []).map((value) => trimmedText(value)).filter(Boolean);

export const parseNumberInput = (value?: string | number | null) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  const text = trimmedText(value);
  if (!text) return undefined;

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
};
