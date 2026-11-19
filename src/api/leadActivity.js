import { apiRequest } from "./client.js";

export function getLeadActivity({ source, leadKey, page = 1, pageSize = 25 }) {
  const root = source === "vendor_to_koc"
    ? "/vendor-to-koc/leads"
    : source === "dhruva"
      ? "/dhruva/leads"
      : `/leads/${encodeURIComponent(source)}`;
  const id = encodeURIComponent(leadKey);
  return apiRequest(`${root}/${id}/activity`, { query: { page, page_size: pageSize } });
}
