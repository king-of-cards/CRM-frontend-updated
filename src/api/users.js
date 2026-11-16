import { apiRequest } from "./client.js";

// GET /api/v1/users?skip=&limit=   (admin only)
export function listUsers({ skip = 0, limit = 100 } = {}) {
  return apiRequest("/users", { query: { skip, limit } });
}

// GET /api/v1/users/{id}   (admins: anyone; others: only themselves)
export function getUser(id) {
  return apiRequest(`/users/${encodeURIComponent(id)}`);
}

// POST /api/v1/users   (admin only)
// { name, email, password (8-128 chars), role: "admin" | "vendor", vendor_id? (vendor logins) }
// 409 if the email is already registered; 404 if the vendor doesn't exist.
export function createUser({ name, email, password, role = "vendor", vendorId }) {
  return apiRequest("/users", {
    method: "POST",
    body: { name, email, password, role, ...(role === "vendor" && vendorId ? { vendor_id: Number(vendorId) } : {}) },
  });
}

// PATCH /api/v1/users/{id}   (admin only): block (false) or unblock (true) a login.
// 400 for your own login. Returns the user.
export function setUserActive(id, isActive) {
  return apiRequest(`/users/${encodeURIComponent(id)}`, { method: "PATCH", body: { is_active: isActive } });
}