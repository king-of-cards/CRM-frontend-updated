import { apiRequest } from "./client.js";

// Read-only PostgreSQL database. All admin only.

// GET /api/v1/read/health -> { database, engine, name, read_only }
export function readDbHealth() {
  return apiRequest("/read/health");
}

// The table explorer below also needs DEBUG=true in the backend .env (403 otherwise).

// GET /api/v1/read/schemas -> { schemas: [...] }
export function listSchemas() {
  return apiRequest("/read/schemas");
}

// GET /api/v1/read/tables?schema= -> { schema, tables: [...], views: [...] }
export function listTables(schema) {
  return apiRequest("/read/tables", { query: { schema } });
}

// GET /api/v1/read/tables/{table}/columns?schema= -> [{ name, type, nullable }]
export function tableColumns(table, schema) {
  return apiRequest(`/read/tables/${encodeURIComponent(table)}/columns`, { query: { schema } });
}

// GET /api/v1/read/tables/{table}/rows?schema=&limit=&offset= -> [ {...row} ]  (limit 1-200)
export function tableRows(table, { schema, limit = 20, offset = 0 } = {}) {
  return apiRequest(`/read/tables/${encodeURIComponent(table)}/rows`, { query: { schema, limit, offset } });
}