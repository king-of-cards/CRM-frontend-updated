// Spin's "Other wedding services" (additional_details.otherWeddingServices, docs section 17):
// a comma-separated text such as "Photography, Wedding Gifts & Return Gifts". Pure, no React.

// The service that makes a spin lead a gift lead (automatic vendor Kraftyz)
export const GIFT_SERVICE = "Wedding Gifts & Return Gifts";

// "a, b ,a" -> ["a", "b"]: trimmed, empty parts dropped, repeats (any case) shown once
export function servicesOf(value) {
  if (value == null) return [];
  const parts = Array.isArray(value) ? value : String(value).split(",");
  const seen = new Set();
  const out = [];
  for (const part of parts) {
    const text = String(part ?? "").trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

// Is this one service the gift service? (any case and spacing, as the API matches it)
export const isGiftService = (service) =>
  String(service ?? "").toLowerCase().replace(/\s+/g, " ").trim() === GIFT_SERVICE.toLowerCase();

// Filter options for the single-select "Other services" filter: filter-options.other_services
// [{ value, count }] (most common first) -> [{ value, label }] with the count in the label
export const otherServiceOptions = (list) =>
  (list ?? [])
    .filter((o) => o && o.value != null && String(o.value).trim() !== "")
    .map((o) => ({ value: String(o.value), label: `${o.value}${o.count == null ? "" : ` (${o.count})`}` }));
