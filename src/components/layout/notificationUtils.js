import { dateTimeText } from "../vendorToKoc/kocUtils.js";

const SOURCE_PATHS = {
  spin: "/leads/spin",
  whatsapp: "/leads/international",
  wedding: "/leads/wedding",
  wedding_planner: "/leads/wedding-planner",
  vendor_to_koc: "/vendor-to-koc",
};

export function unreadBadge(count) {
  const value = Math.max(0, Number(count) || 0);
  return value === 0 ? null : value > 9 ? "9+" : String(value);
}

export function notificationBellPlacement({ isAdmin, isVendor, isDhruva, showToggle }) {
  const visible = !isDhruva && (isAdmin || isVendor);
  return {
    besideToggle: visible && showToggle,
    besideAvatar: visible && !showToggle,
    mobileBesideAvatar: visible && showToggle,
  };
}

export function relativeNotificationTime(value, now = Date.now()) {
  const at = new Date(value).getTime();
  if (!Number.isFinite(at)) return "";
  const seconds = Math.floor(Math.abs(now - at) / 1000);
  const future = at > now;
  const unit = seconds < 60
    ? ["just now", "in a moment"]
    : seconds < 3600
      ? [`${Math.floor(seconds / 60)} min ago`, `in ${Math.floor(seconds / 60)} min`]
      : seconds < 86400
        ? [`${Math.floor(seconds / 3600)} h ago`, `in ${Math.floor(seconds / 3600)} h`]
        : [`${Math.floor(seconds / 86400)} d ago`, `in ${Math.floor(seconds / 86400)} d`];
  return unit[future ? 1 : 0];
}

export function notificationDateTime(value) {
  return value ? dateTimeText(value) : "";
}

function assignedLeadSearch(notification, source) {
  const body = String(notification?.body ?? "");
  const marker = ` (${source}) was assigned`;
  const end = body.indexOf(marker);
  return end > 0 ? body.slice(0, end).trim() : "";
}

function kocLeadSearch(notification) {
  const body = String(notification?.body ?? "");
  const end = body.lastIndexOf(" to KOC; added by ");
  const start = end >= 0 ? body.lastIndexOf(" added ", end) : -1;
  return start >= 0 ? body.slice(start + " added ".length, end).trim() : "";
}

export function notificationDestination(notification) {
  const ref = notification?.lead_ref ?? notification ?? {};
  const source = ref.source ?? notification?.source;
  const path = SOURCE_PATHS[source];
  if (!path) return "/dashboard";

  const params = new URLSearchParams();
  if (source === "vendor_to_koc") {
    const id = ref.lead_id ?? notification?.lead_id;
    if (id != null) {
      params.set("notification_lead_id", String(id));
      const search = kocLeadSearch(notification);
      if (search) params.set("search", search);
    }
  } else {
    const key = ref.lead_key ?? notification?.lead_key;
    if (key != null) {
      params.set("notification_lead_key", String(key));
      if (notification?.type === "vendor_assigned") {
        const search = assignedLeadSearch(notification, source);
        if (search) params.set("search", search);
      }
    }
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export const notificationSourceLabel = (source) => ({
  spin: "Spin",
  whatsapp: "International",
  wedding: "Wedding",
  wedding_planner: "Wedding planner",
  vendor_to_koc: "Vendors → KOC",
}[source] ?? "Lead");
