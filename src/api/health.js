import { apiRequest } from "./client.js";

// GET /api/v1/health/db   (no login needed) -> { database: "connected" }, 503 if down
export function checkDatabase() {
  return apiRequest("/health/db", { auth: false });
}