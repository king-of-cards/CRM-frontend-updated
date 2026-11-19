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
  name: "Name",
  phone: "Phone",
  alt_phone: "Alt phone",
  city: "City",
  lead_date: "Date",
  event_type: "Event type",
  venue: "Venue",
  date: "Event date",
};

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function valueText(field, value, vendorName) {
  if (field === "update_status" && (value == null || value === "")) return "Pending";
  if (value == null || value === "") return "—";
  if (field === "update_status") return statusLabel(value === "pending" ? null : value);
  if (field === "quoted_amount" || field === "conversion_amount") {
    const amount = Number(value);
    return Number.isFinite(amount) ? inr.format(amount) : String(value);
  }
  if (field === "follow_up_date" || field === "quoted_date" || field === "lead_date" || field === "date") return dayText(value);
  if (field === "vendor_id") return vendorName?.(value) ?? `Vendor #${value}`;
  if (field === "is_hot") return String(value) === "true" ? "Hot" : "Not hot";
  return String(value);
}

export function activityDescription(activity, vendorName) {
  if (activity.action === "created") return "Created";
  if (activity.action === "archived") return "Archived";
  if (activity.action === "unarchived") return "Unarchived";
  if (activity.action === "hot_on") return "Marked as hot";
  if (activity.action === "hot_off") return "Removed hot mark";
  if (activity.action === "assigned") {
    return activity.new_value == null
      ? "Unassigned"
      : `Assigned to ${valueText("vendor_id", activity.new_value, vendorName)}`;
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
