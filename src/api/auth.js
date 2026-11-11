import { apiRequest, refreshAccessToken, setAccessToken } from "./client.js";

// POST /api/v1/auth/login
// The backend uses the OAuth2 form, which names the email field "username".
export async function login(email, password) {
  const data = await apiRequest("/auth/login", {
    method: "POST",
    form: { username: email.trim(), password },
    auth: false,
  });
  setAccessToken(data.access_token);
  return data; // { access_token, token_type: "bearer" }
}

// POST /api/v1/auth/logout: revokes the refresh cookie on the server (204, no body)
export async function logout() {
  try {
    await apiRequest("/auth/logout", { method: "POST", auth: false });
  } finally {
    setAccessToken(null);
  }
}

// GET /api/v1/auth/me -> { id, name, email, role, is_active, created_at }
export function getMe() {
  return apiRequest("/auth/me");
}

// POST /api/v1/auth/refresh: after a page reload, get a new access token from the cookie.
// Returns the token, or null if there's no valid session.
export function restoreSession() {
  return refreshAccessToken();
}