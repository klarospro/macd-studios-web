export const HONEYPOT_FIELD = "company_website";

export function isHoneypotTriggered(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}
