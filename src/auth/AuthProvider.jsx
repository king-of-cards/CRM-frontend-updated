import { useCallback, useEffect, useMemo, useState } from "react";
import * as authApi from "../api/auth.js";
import { clearCache, setSessionExpiredHandler } from "../api/client.js";
import { AuthContext } from "./context.js";

// Holds the logged-in user for the whole app.
//
// Fast start: the user from the last visit in this tab is shown straight away
// (from sessionStorage), so pages render immediately while the session is checked
// in the background. If the session turns out to be gone, the user is logged out.
const USER_KEY = "crm-user";

function savedUser() {
  try {
    return JSON.parse(sessionStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

function saveUser(user) {
  try {
    if (user) sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(USER_KEY);
  } catch {
    // storage unavailable: just no fast start next time
  }
}

export default function AuthProvider({ children }) {
  const [user, setUserState] = useState(savedUser);
  const [isReady, setIsReady] = useState(() => Boolean(savedUser()));

  const setUser = useCallback((next) => {
    setUserState(next);
    saveUser(next);
    if (!next) clearCache();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSessionExpiredHandler(() => setUser(null));

    (async () => {
      const token = await authApi.restoreSession();
      if (cancelled) return;
      if (!token) {
        setUser(null);
      } else {
        try {
          const me = await authApi.getMe();
          if (!cancelled) setUser(me);
        } catch {
          // keep the saved user; the next request will retry the session
        }
      }
      if (!cancelled) setIsReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [setUser]);

  const login = useCallback(
    async (email, password) => {
      await authApi.login(email, password);
      const me = await authApi.getMe();
      setUser(me);
      return me;
    },
    [setUser],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Even if the server call fails, clear the session locally
    } finally {
      setUser(null);
    }
  }, [setUser]);

  const value = useMemo(
    () => ({ user, isAdmin: user?.role === "admin", isReady, login, logout }),
    [user, isReady, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
