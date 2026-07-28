export type WhatsappValidationResult =
  | { valid: true; normalized: string }
  | { valid: false; normalized: null; reason: "empty" | "invalid" };

function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

export function validateSaudiWhatsapp(value: string): WhatsappValidationResult {
  const trimmed = value.trim();
  if (!trimmed) return { valid: false, normalized: null, reason: "empty" };

  const digits = digitsOnly(trimmed);
  let localNumber = digits;

  if (digits.startsWith("00966")) localNumber = digits.slice(5);
  else if (digits.startsWith("966")) localNumber = digits.slice(3);
  else if (digits.startsWith("0")) localNumber = digits.slice(1);

  if (!/^5\d{8}$/.test(localNumber)) {
    return { valid: false, normalized: null, reason: "invalid" };
  }

  return { valid: true, normalized: `+966${localNumber}` };
}

export function isIncompleteSaudiWhatsapp(value: string): boolean {
  const digits = digitsOnly(value.trim());
  return digits === "966" || digits === "00966";
}
