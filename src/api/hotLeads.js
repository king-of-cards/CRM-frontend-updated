import { apiRequest } from "./client.js";

// The hot star of one copy (docs section 19). vendor (admins, several vendors): whose copy, sent as
// ?vendor=<id>; without it a lead with several vendors answers 422. Vendor logins never send it.
export function setSourceLeadHot(source, leadKey, isHot, { vendor } = {}) {
  return apiRequest(
    `/leads/${encodeURIComponent(source)}/${encodeURIComponent(leadKey)}/hot`,
    { method: isHot ? "POST" : "DELETE", query: vendor != null ? { vendor } : undefined },
  );
}

export function setKocLeadHot(id, isHot) {
  return apiRequest(`/vendor-to-koc/leads/${encodeURIComponent(id)}/hot`, {
    method: isHot ? "POST" : "DELETE",
  });
}

// KOC → Dhruva (docs section 18): admins and Dhruva logins
export function setKocToDhruvaLeadHot(leadKey, isHot) {
  return apiRequest(`/koc-to-dhruva/leads/${encodeURIComponent(leadKey)}/hot`, {
    method: isHot ? "POST" : "DELETE",
  });
}

// Dhruva leads (docs section 13): admins and Dhruva logins
export function setDhruvaLeadHot(id, isHot) {
  return apiRequest(`/dhruva/leads/${encodeURIComponent(id)}/hot`, {
    method: isHot ? "POST" : "DELETE",
  });
}
