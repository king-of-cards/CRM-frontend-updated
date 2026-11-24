// Duplicate wording (docs/API_REFERENCE.md section 4: a duplicate is the same phone with no
// conflicting field). The API's own text always wins; the app's wording is used only when the
// API sends none. Count chips stay short ("Already exists", "Duplicate (skipped)"); rows,
// tooltips and messages use the long text. Pure, no React.

export const DUPLICATE_TEXT = "Already exists (same phone, no conflicting details)";

// A preview row's or a 409's duplicate object -> its text
export function duplicateText(duplicate) {
  if (!duplicate) return "";
  if (typeof duplicate === "string") return duplicate;
  if (typeof duplicate === "object") {
    if (typeof duplicate.message === "string" && duplicate.message.trim()) return duplicate.message.trim();
    if (duplicate.reason === "in_file")
      return duplicate.duplicate_of_row != null
        ? `Repeated in this file (same as row ${duplicate.duplicate_of_row})`
        : "Repeated in this file";
  }
  return DUPLICATE_TEXT;
}

// A 409 duplicate answer's message: the API's detail.message, else the app's wording
export function duplicateMessage(detail) {
  const message = detail && typeof detail === "object" ? detail.message : typeof detail === "string" ? detail : "";
  return typeof message === "string" && message.trim() ? message.trim() : DUPLICATE_TEXT;
}
