import { Navigate, useLocation } from "react-router";
import { useAuth } from "./useAuth.js";

// Wrap a page so only logged-in users (optionally only a given role) can see it.
//   <RequireAuth><Dashboard /></RequireAuth>
//   <RequireAuth role="admin"><Users /></RequireAuth>
export default function RequireAuth({ role, children }) {
  const { user, isReady } = useAuth();
  const location = useLocation();

  if (!isReady) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-white"
        role="status"
      >
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" />
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (role && user.role !== role) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
