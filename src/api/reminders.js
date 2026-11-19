import { apiRequest } from "./client.js";

// GET /reminders/follow-ups?days&sources (admins, vendors) or GET /dhruva/reminders/follow-ups?days
// (admins, Dhruva logins). sources: an array of source names, sent comma-separated; left out when empty.
export function getFollowUpReminders({ days = 7, dhruva = false, sources = [] } = {}) {
  if (dhruva) return apiRequest("/dhruva/reminders/follow-ups", { query: { days } });
  const list = (sources ?? []).filter(Boolean);
  return apiRequest("/reminders/follow-ups", { query: { days, sources: list.length ? list.join(",") : undefined } });
}
