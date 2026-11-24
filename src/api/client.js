// One place for every call to the FastAPI backend.
//
// How login works with this backend:
// - POST /auth/login returns a short-lived access token (15 min) in the JSON body,
//   and sets a long-lived refresh token as an HttpOnly cookie (the browser keeps it;
//   JavaScript can't read it, which is the point).
// - The access token is kept in memory only (this variable), never in localStorage.
// - When a request gets 401 (token expired or page reloaded), we call /auth/refresh
//   once, which uses the cookie to get a new access token, then retry the request.

import { VIEW_ONLY_EVENT, isViewOnlyError } from "../auth/permissions.js";

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

export function getAccessToken() {
  return accessToken;
}

// Called when the session can't be renewed (refresh cookie missing or expired)
export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler;
}

// A view-only login tried to change something (403 "View-only logins cannot change data."):
// tell the page frame, which shows a friendly toast (ViewOnlyToast). The error is still thrown.
export function notifyViewOnly(error) {
  if (!isViewOnlyError(error) || typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(VIEW_ONLY_EVENT));
  } catch {
    // No CustomEvent (very old browsers): the page shows the error text instead
  }
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

// ── Response cache (makes pages open instantly) ─────────────────────────
// Every successful GET is remembered for this browser tab (memory + sessionStorage).
// Pages call peek() to show the last answer immediately, then fetch a fresh one.
// sessionStorage is cleared when the tab closes, and clearCache() runs on logout.
const CACHE_STORAGE_KEY = "crm-api-cache";
const CACHE_MAX_AGE_MS = 30 * 60 * 1000; // older answers are not shown
const CACHE_MAX_ENTRIES = 80;
let cache = null; // url -> { at, data }
let persistTimer = null;

function loadCache() {
  if (cache) return cache;
  cache = new Map();
  try {
    const saved = JSON.parse(sessionStorage.getItem(CACHE_STORAGE_KEY) || "[]");
    for (const [url, entry] of saved) cache.set(url, entry);
  } catch {
    // unreadable storage: start empty
  }
  return cache;
}

function persistCache() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      const entries = [...loadCache().entries()].sort((a, b) => b[1].at - a[1].at).slice(0, CACHE_MAX_ENTRIES);
      sessionStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // storage full or unavailable: memory cache still works
    }
  }, 300);
}

function remember(url, data) {
  loadCache().set(url, { at: Date.now(), data });
  persistCache();
}

// Last answer for this GET (or undefined). Same path + query as the request.
export function peek(path, query) {
  const hit = loadCache().get(buildUrl(path, query));
  return hit && Date.now() - hit.at < CACHE_MAX_AGE_MS ? hit.data : undefined;
}

// ── Brief reuse (no refetch on every navigation) ───────────────────────
// The same GET twice within FRESH_MS (e.g. leaving a page and coming back) gets the answer it
// just had instead of a new request, and identical GETs in flight share one request. Any change
// (POST / PATCH / PUT / DELETE, uploads) ends the reuse, so lists reload after a save as before.
// ?refresh=true (the dashboards' Refresh) always asks the server.
const FRESH_MS = 10_000;
let generation = 0; // goes up on every change; answers from an older generation aren't reused
const fresh = new Map(); // url -> { gen, at } of the last answer
const inflight = new Map(); // `${gen} ${url}` -> Promise

export function markDataChanged() {
  generation += 1;
}

function freshAnswer(url, query) {
  if (typeof window === "undefined" || query?.refresh) return undefined;
  const mark = fresh.get(url);
  const hit = loadCache().get(url);
  return mark && hit && mark.gen === generation && Date.now() - mark.at < FRESH_MS ? hit : undefined;
}

export function clearCache() {
  inflight.clear();
  fresh.clear();
  generation += 1;
  loadCache().clear();
  try {
    sessionStorage.removeItem(CACHE_STORAGE_KEY);
  } catch {
    // nothing to clear
  }
}

/**
 * apiRequest("/users", { method: "POST", body: {...} })
 *   body  -> sent as JSON
 *   form  -> sent as application/x-www-form-urlencoded (used by /auth/login)
 *   query -> URL query parameters; empty values are skipped
 *   auth  -> attach the access token and retry once after a refresh on 401 (default true)
 */
export function apiRequest(path, options = {}) {
  const { method = "GET", query, auth = true } = options;
  if (method !== "GET") {
    markDataChanged();
    return send(path, options).finally(markDataChanged);
  }
  if (!auth) return send(path, options);
  const url = buildUrl(path, query);
  const reuse = freshAnswer(url, query);
  if (reuse) return Promise.resolve(reuse.data);
  const gen = generation;
  const key = `${gen} ${url}`;
  if (inflight.has(key)) return inflight.get(key);
  const request = send(path, options)
    .then((data) => {
      fresh.set(url, { gen, at: Date.now() });
      return data;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
}

async function send(path, { method = "GET", body, form, query, auth = true, retry: allowRetry = true } = {}) {
  let retry = allowRetry;
  const headers = { Accept: "application/json" };
  let payload;

  if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    payload = new URLSearchParams(form);
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  // No token yet (page just loaded): get one first instead of failing with 401 and retrying
  if (auth && !accessToken && retry) {
    const token = await refreshAccessToken();
    if (!token) retry = false; // no session: one request, no second refresh
  }

  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res;
  try {
    res = await fetch(buildUrl(path, query), { method, headers, body: payload, credentials: "include" });
  } catch {
    throw new ApiError(0, null);
  }

  if (res.status === 401 && auth) {
    if (retry) {
      const token = await refreshAccessToken();
      if (token) return send(path, { method, body, form, query, auth, retry: false });
    }
    if (!accessToken) onSessionExpired?.();
  }

  const data = await readBody(res);
  if (!res.ok) {
    const error = new ApiError(res.status, data && typeof data === "object" ? data.detail : data);
    notifyViewOnly(error);
    throw error;
  }
  if (method === "GET" && auth) remember(buildUrl(path, query), data);
  return data;
}