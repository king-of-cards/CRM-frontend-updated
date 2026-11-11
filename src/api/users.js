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
// { name, email, password (8-128 chars), role: "admin" | "vendor" }
// 409 if the email is already registered.
export function createUser({ name, email, password, role = "vendor" }) {
  return apiRequest("/users", { method: "POST", body: { name, email, password, role } });
}