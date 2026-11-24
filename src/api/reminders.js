import { apiRequest } from "./client.js";

// GET /reminders/follow-ups?days&sources (admins, vendors) or GET /dhruva/reminders/follow-ups?days&sources
// (admins, view-only, Dhruva logins; sources = dhruva or koc_to_dhruva, docs section 18).
// sources: an array of source names, sent comma-separated; left out when empty.
export function getFollowUpReminders({ days = 7, dhruva = false, sources = [] } = {}) {
  const list = (sources ?? []).filter(Boolean);
  if (dhruva) return apiRequest("/dhruva/reminders/follow-ups", { query: { days, sources: list.length ? list.join(",") : undefined } });
  return apiRequest("/reminders/follow-ups", { query: { days, sources: list.length ? list.join(",") : undefined } });
}
