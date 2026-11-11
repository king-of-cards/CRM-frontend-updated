// One place for every call to the FastAPI backend.
//
// How login works with this backend:
// - POST /auth/login returns a short-lived access token (15 min) in the JSON body,
//   and sets a long-lived refresh token as an HttpOnly cookie (the browser keeps it;
//   JavaScript can't read it, which is the point).
// - The access token is kept in memory only (this variable), never in localStorage.
// - When a request gets 401 (token expired or page reloaded), we call /auth/refresh
//   once, which uses the cookie to get a new access token, then retry the request.

const API_BASE = import.meta.env.VITE_API_URL ?? "/api/v1";

let accessToken = null;
let refreshPromise = null;
let onSessionExpired = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function hasAccessToken() {
  return Boolean(accessToken);
}

// Called when the session can't be renewed (refresh cookie missing or expired)
export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler;
}

export class ApiError extends Error {
  constructor(status, detail) {
    super(messageFrom(status, detail));
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

// FastAPI errors: { detail: "text" } or, for validation (422), { detail: [{ msg, loc }, ...] }
function messageFrom(status, detail) {
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((d) => {
        const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : null;
        return field && field !== "body" ? `${field}: ${d.msg}` : d.msg;
      })
      .join(". ");
  }
  if (status === 0) return "Can't reach the server. Is the backend running?";
  return `Request failed (${status})`;
}

function buildUrl(path, query) {
  const url = `${API_BASE}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function readBody(res) {
  if (res.status === 204) return null;
  const type = res.headers.get("content-type") || "";
  if (type.includes("application/json")) return res.json();
  const text = await res.text();
  return text || null;
}

// Get a new access token using the refresh cookie. Parallel callers share one request,
// because the backend rotates the refresh token on every use.
export function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = fetch(buildUrl("/auth/refresh"), { method: "POST", credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          accessToken = null;
          return null;
        }
        const data = await res.json();
        accessToken = data.access_token;
        return accessToken;
      })
      .catch(() => {
        accessToken = null;
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/**
 * apiRequest("/users", { method: "POST", body: {...} })
 *   body  -> sent as JSON
 *   form  -> sent as application/x-www-form-urlencoded (used by /auth/login)
 *   query -> URL query parameters; empty values are skipped
 *   auth  -> attach the access token and retry once after a refresh on 401 (default true)
 */
export async function apiRequest(path, { method = "GET", body, form, query, auth = true, retry = true } = {}) {
  const headers = { Accept: "application/json" };
  let payload;

  if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    payload = new URLSearchParams(form);
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res;
  try {
    res = await fetch(buildUrl(path, query), { method, headers, body: payload, credentials: "include" });
  } catch {
    throw new ApiError(0, null);
  }

  if (res.status === 401 && auth && retry) {
    const token = await refreshAccessToken();
    if (token) return apiRequest(path, { method, body, form, query, auth, retry: false });
    onSessionExpired?.();
  }

  const data = await readBody(res);
  if (!res.ok) throw new ApiError(res.status, data && typeof data === "object" ? data.detail : data);
  return data;
}