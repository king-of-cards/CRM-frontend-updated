import { apiRequest, peek } from "./client.js";

// WhatsApp leads copied from the Google Sheet into the database (admin only).

// GET /api/v1/whatsapp-leads
// -> { items: [{ id, country, phone, phone_display, event_date, event_date_text, submitted_at }], total, page, page_size }
// sort: "submitted_at" | "event_date" | "country" | "phone" | "first_seen_at"
const listQuery = ({ page = 1, pageSize = 10, search, country, sort = "submitted_at", order = "desc" } = {}) => ({
  page,
  page_size: pageSize,
  search,
  country,
  sort,
  order,
});

export function listWhatsAppLeads(params) {
  return apiRequest("/whatsapp-leads", { query: listQuery(params) });
}
listWhatsAppLeads.peek = (params) => peek("/whatsapp-leads", listQuery(params));

// GET /api/v1/whatsapp-leads/stats -> { total, last_7_days, upcoming_events, top_countries: [{ country, count }] }
export function getWhatsAppLeadStats() {
  return apiRequest("/whatsapp-leads/stats");
}
getWhatsAppLeadStats.peek = () => peek("/whatsapp-leads/stats");