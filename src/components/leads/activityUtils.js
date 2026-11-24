import { dateTimeText, dayText, statusLabel } from "../vendorToKoc/kocUtils.js";
import { relativeNotificationTime } from "../layout/notificationUtils.js";

const FIELD_LABELS = {
  update_status: "Update",
  quoted_amount: "Quoted amount",
  conversion_amount: "Conversion amount",
  quoted_date: "Quoted date",
  follow_up_date: "Follow-up date",
  additional_comments: "Additional comments",
  notes: "Notes",
  vendor_id: "Assigned to",
  assigned_to: "Assigned to",
  name: "Name",
  phone: "Phone",
  alt_phone: "Alt phone",
  city: "City",
  lead_date: "Date",
  event_type: "Event type",
  venue: "Venue",
  date: "Event date",
  // Dhruva → KOC (docs section 13)
  event_dates: "Event dates",
  phones: "Phone numbers",
  whatsapp_status: "WhatsApp status",
  response: "Response",
  message_sent: "Message sent",
  follow_up_notes: "Follow-up notes",
  comments: "Comments",
  needs_intervention: "Needs Dhruva intervention",
};

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

// A vendor in the activity: a vendor id goes through vendorName(id) (a lookup function; anything
// else is ignored, so a stray string can never crash the panel), text the API already wrote
// ("Phodeo", "Unassigned", "Automatic": docs section 5, assigned_to) is shown as written.
function vendorText(value, vendorName) {
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) return text;
  const name = typeof vendorName === "function" ? vendorName(text) : null;
  return typeof name === "string" && name.trim() ? name : `Vendor #${text}`;
}

// vendorName for LeadActivity: id -> name from the vendors list (active and inactive), falling
// back to the lead's own vendor (e.g. an inactive vendor missing from an active-only list)
export function vendorNameLookup(vendors, ...known) {
  const all = [...(Array.isArray(vendors) ? vendors : []), ...known.filter(Boolean)];
  return (id) => all.find((v) => v && v.id != null && String(v.id) === String(id))?.name ?? null;
}

function valueText(field, value, vendorName) {
  if (field === "update_status" && (value == null || value === "")) return "Pending";
  if (value == null || value === "") return "—";
  if (field === "update_status") return statusLabel(value === "pending" ? null : value);
  if (field === "quoted_amount" || field === "conversion_amount") {
    const amount = Number(value);
    return Number.isFinite(amount) ? inr.format(amount) : String(value);
  }
  if (field === "follow_up_date" || field === "quoted_date" || field === "lead_date" || field === "date") return dayText(value);
  if (field === "vendor_id" || field === "assigned_to") return vendorText(value, vendorName);
  if (field === "is_hot") return String(value) === "true" ? "Hot" : "Not hot";
  if (field === "needs_intervention") return /^(true|yes)$/i.test(String(value)) ? "Yes" : "No";
  // "2026-12-04, 2026-12-05" -> "4 Dec 2026, 5 Dec 2026"
  if (field === "event_dates") return String(value).split(",").map((d) => d.trim()).filter(Boolean).map((d) => dayText(d)).join(", ");
  return String(value);
}

export function activityDescription(activity, vendorName) {
  if (activity.action === "created") return "Created";
  if (activity.action === "archived") return "Archived";
  if (activity.action === "unarchived") return "Unarchived";
  if (activity.action === "hot_on") return "Marked as hot";
  if (activity.action === "hot_off") return "Removed hot mark";
  if (activity.action === "assigned") {
    // assigned_to changes carry both sides as text: "Assigned to: Phodeo → Unassigned"
    if (activity.field === "assigned_to" && activity.old_value != null && activity.old_value !== "") {
      return `Assigned to: ${valueText("assigned_to", activity.old_value, vendorName)} → ${valueText("assigned_to", activity.new_value, vendorName)}`;
    }
    if (activity.new_value == null || activity.new_value === "") return "Unassigned";
    const text = valueText("vendor_id", activity.new_value, vendorName);
    return text === "Unassigned" ? "Unassigned" : `Assigned to ${text}`;
  }
  const label = FIELD_LABELS[activity.field] ?? activity.field ?? "Lead";
  return `${label}: ${valueText(activity.field, activity.old_value, vendorName)} → ${valueText(activity.field, activity.new_value, vendorName)}`;
}

export function activityActorRole(role) {
  if (!role) return "";
  return String(role).replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function activityTime(value, now) {
  return {
    relative: relativeNotificationTime(value, now),
    exact: dateTimeText(value),
  };
}

function istDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value ?? "");
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function groupActivityByDay(items, now = new Date()) {
  const today = istDay(now);
  const yesterday = istDay(new Date(new Date(now).getTime() - 86400000));
  const groups = [];
  const byKey = new Map();
  for (const item of items ?? []) {
    const key = istDay(item.created_at);
    let group = byKey.get(key);
    if (!group) {
      const title = key === today ? "Today" : key === yesterday ? "Yesterday" : dateTimeText(`${key}T12:00:00+05:30`).split(",")[0];
      group = { key, title, items: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}
