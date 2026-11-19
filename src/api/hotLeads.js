import { apiRequest } from "./client.js";

export function setSourceLeadHot(source, leadKey, isHot) {
  return apiRequest(
    `/leads/${encodeURIComponent(source)}/${encodeURIComponent(leadKey)}/hot`,
    { method: isHot ? "POST" : "DELETE" },
  );
}

export function setKocLeadHot(id, isHot) {
  return apiRequest(`/vendor-to-koc/leads/${encodeURIComponent(id)}/hot`, {
    method: isHot ? "POST" : "DELETE",
  });
}

// Dhruva leads (docs section 13): admins and Dhruva logins
export function setDhruvaLeadHot(id, isHot) {
  return apiRequest(`/dhruva/leads/${encodeURIComponent(id)}/hot`, {
    method: isHot ? "POST" : "DELETE",
  });
}
