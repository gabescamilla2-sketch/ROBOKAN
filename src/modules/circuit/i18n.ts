import messages from "../../i18n/es.json";
export function t(key: string): string {
  let value: unknown = messages;
  for (const part of key.split("."))
    value =
      value && typeof value === "object"
        ? (value as Record<string, unknown>)[part]
        : undefined;
  return typeof value === "string" ? value : key;
}
