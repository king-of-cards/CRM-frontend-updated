import { apiRequest } from "./client.js";

export function getNotifications({ page = 1, pageSize = 10 } = {}) {
  return apiRequest("/notifications", { query: { page, page_size: pageSize } });
}

export function getNotificationUnreadCount() {
  return apiRequest("/notifications/unread-count");
}

export function markNotificationRead(id) {
  return apiRequest(`/notifications/${encodeURIComponent(id)}/read`, { method: "POST" });
}

export function markAllNotificationsRead() {
  return apiRequest("/notifications/read-all", { method: "POST" });
}
