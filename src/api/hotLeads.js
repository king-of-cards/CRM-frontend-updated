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
