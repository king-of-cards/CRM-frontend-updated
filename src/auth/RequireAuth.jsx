import { Navigate, useLocation } from "react-router";
import { useAuth } from "./useAuth.js";
import { redirectFor } from "./permissions.js";
import { PageSkeleton } from "../components/shared/Skeleton.jsx";

// Wrap a page so only logged-in users (optionally only a given role) can see it.
//   <RequireAuth><Dashboard /></RequireAuth>
//   <RequireAuth role="admin"><Users /></RequireAuth>
//   <RequireAuth role={["admin","dhruva"]}><DhruvaLeads /></RequireAuth>
//
// Redirect targets:
//   - Not logged in            → /login
//   - Wrong role (non-admin/non-dhruva hitting admin page) → /dashboard
//   - Dhruva login hitting any admin-only page             → /dashboard?flow=dhruva
//   - View-only login on Team, Settings or Branches         → /dashboard (permissions.js)
export default function RequireAuth({ role, children }) {
  const { user, isDhruva, isReady } = useAuth();
  const location = useLocation();

  if (!isReady) {
    return <PageSkeleton />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Dhruva accounts can open only their dashboard and lead list; view-only accounts
  // can't open Team, Settings or Branches (see redirectFor in permissions.js)
  const redirect = redirectFor(user, location.pathname);
  if (redirect) {
    return <Navigate to={redirect} replace />;
  }

  // role check: accepts a string or an array of allowed roles
  if (role) {
    const allowed = Array.isArray(role) ? role : [role];
    if (!allowed.includes(user.role)) {
      // Dhruva logins are redirected to their own dashboard
      return <Navigate to={isDhruva ? "/dashboard?flow=dhruva" : "/dashboard"} replace />;
    }
  }

  return children;
}
