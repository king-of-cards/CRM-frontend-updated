// The API's error text, as the API returns it (docs/API_REFERENCE.md "Error format"):
//   {"detail": "text"}                                   (400, 404, 409, …)
//   {"detail": {"message": "…", "errors": [{field, message}]}}   (422 from the CRM endpoints)
//   {"detail": [{loc, msg}]}                             (FastAPI's own 422)
export function apiErrorText(err) {
  const d = err?.detail;
  if (typeof d === "string" && d) return d;
  if (d && !Array.isArray(d) && typeof d === "object") {
    const parts = [];
    if (d.message) parts.push(String(d.message));
    if (Array.isArray(d.errors)) for (const e of d.errors) if (e?.message) parts.push(String(e.message));
    if (parts.length) return parts.join(" ");
  }
  if (Array.isArray(d) && d.length) {
    return d
      .map((e) => {
        const text = e?.message ?? e?.msg ?? "";
        const field = e?.field ?? (Array.isArray(e?.loc) ? e.loc[e.loc.length - 1] : null);
        return field && field !== "body" ? `${field}: ${text}` : text;
      })
      .filter(Boolean)
      .join(". ");
  }
  return err?.message || "Something went wrong.";
}
