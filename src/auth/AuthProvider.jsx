import { useCallback, useEffect, useMemo, useState } from "react";
import * as authApi from "../api/auth.js";
import { setSessionExpiredHandler } from "../api/client.js";
import { AuthContext } from "./context.js";

// Holds the logged-in user for the whole app.
// On first load it tries to restore the session from the refresh cookie,
// so a page reload doesn't log you out.
export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSessionExpiredHandler(() => setUser(null));

    (async () => {
      const token = await authApi.restoreSession();
      if (token) {
        try {
          const me = await authApi.getMe();
          if (!cancelled) setUser(me);
        } catch {
          // Session could not be loaded: stay logged out
        }
      }
      if (!cancelled) setIsReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    await authApi.login(email, password);
    const me = await authApi.getMe();
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Even if the server call fails, clear the session locally
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, isAdmin: user?.role === "admin", isReady, login, logout }),
    [user, isReady, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
