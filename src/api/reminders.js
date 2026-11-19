import { apiRequest } from "./client.js";

export function getFollowUpReminders({ days = 7, dhruva = false } = {}) {
  const path = dhruva ? "/dhruva/reminders/follow-ups" : "/reminders/follow-ups";
  return apiRequest(path, { query: { days } });
}
