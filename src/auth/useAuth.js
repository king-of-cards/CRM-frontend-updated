import { useContext } from "react";
import { AuthContext } from "./context.js";

// const { user, isAdmin, isReady, login, logout } = useAuth();
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}