import { dayText, phoneText } from "../vendorToKoc/kocUtils.js";

export const REMINDER_SOURCES = {
  spin: { label: "Spin", path: "/leads/spin" },
  whatsapp: { label: "International", path: "/leads/international" },
  wedding: { label: "Wedding", path: "/leads/wedding" },
  wedding_planner: { label: "Wedding planner", path: "/leads/wedding-planner" },
  vendor_to_koc: { label: "Vendors → KOC", path: "/vendor-to-koc" },
  dhruva: { label: "Dhruva → KOC", path: "/dhruva-leads" },
  koc_to_dhruva: { label: "KOC → Dhruva", path: "/koc-to-dhruva" },
};

// Each Lead flow's follow-ups, kept separate: "" = KOC → Vendors, "vendors" = Vendors → KOC,
// and the Dhruva flow's two directions on the Dhruva endpoint: "dhruva" = Dhruva → KOC,
// "koc_to_dhruva" = KOC → Dhruva (docs section 18). sources goes to …/follow-ups?sources=…
export const FLOW_REMINDERS = {
  "": { dhruva: false, sources: ["spin", "whatsapp", "wedding", "wedding_planner"], label: "KOC → Vendors leads" },
  vendors: { dhruva: false, sources: ["vendor_to_koc"], label: "Vendors → KOC leads" },
  dhruva: { dhruva: true, sources: ["dhruva"], label: "Dhruva → KOC leads" },
  koc_to_dhruva: { dhruva: true, sources: ["koc_to_dhruva"], label: "KOC → Dhruva leads" },
};

// The follow-ups scope of a page: its flow, or in the Dhruva flow its direction
export function reminderScopeFor(flow = "", direction = "dhruva") {
  if (flow !== "dhruva") return flow;
  return direction === "koc_to_dhruva" ? "koc_to_dhruva" : "dhruva";
}

// The request and card subtitle for a scope (unknown scopes: KOC → Vendors)
export function reminderRequestFor(flow = "") {
  return FLOW_REMINDERS[flow] ?? FLOW_REMINDERS[""];
}

export function reminderTag(daysOverdue) {
  const days = Number(daysOverdue);
  if (days > 0) return { label: `${days} ${days === 1 ? "day" : "days"} overdue`, tone: "red" };
  if (days === 0) return { label: "Today", tone: "amber" };
  return { label: `In ${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"}`, tone: "neutral" };
}

export function reminderPhone(value) {
  return phoneText(value);
}

export function reminderDate(value) {
  return dayText(value);
}

export function reminderSourceLabel(source) {
  return REMINDER_SOURCES[source]?.label ?? "Lead";
}

export function reminderLeadDestination(item) {
  const source = item?.source;
  const meta = REMINDER_SOURCES[source];
  if (!meta) return "/dashboard";
  const params = new URLSearchParams();
  if (item.name || item.phone) params.set("search", item.name || item.phone);
  if (source === "vendor_to_koc") params.set("notification_lead_id", String(item.lead_key));
  else if (source === "dhruva") params.set("notification_lead_id", String(item.lead_key));
  else params.set("notification_lead_key", String(item.lead_key));
  return `${meta.path}?${params.toString()}`;
}

export function reminderListDestination(source) {
  const meta = REMINDER_SOURCES[source];
  if (!meta) return "/dashboard";
  const params = new URLSearchParams();
  if (source === "vendor_to_koc" || source === "dhruva") params.set("follow_up_due", "true");
  else params.set("follow_up", "due");
  return `${meta.path}?${params.toString()}`;
}

// The Dashboard's follow-ups card for a scope (a flow, or a Dhruva direction)
export function reminderDashboardDestination(flow = "") {
  const params = new URLSearchParams();
  if (flow === "koc_to_dhruva") {
    params.set("flow", "dhruva");
    params.set("direction", "koc_to_dhruva");
  } else if (flow) params.set("flow", flow);
  return `/dashboard${params.size ? `?${params.toString()}` : ""}#follow-ups`;
}
