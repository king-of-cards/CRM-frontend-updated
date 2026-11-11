import { Navigate, Route, Routes } from "react-router";
import RequireAuth from "./auth/RequireAuth.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Leads from "./pages/Leads.jsx";
import Login from "./pages/Login.jsx";
import Users from "./pages/Users.jsx";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/leads"
        element={
          <RequireAuth role="admin">
            <Leads />
          </RequireAuth>
        }
      />
      <Route
        path="/users"
        element={
          <RequireAuth role="admin">
            <Users />
          </RequireAuth>
        }
      />
      {/* Anything else: dashboard (RequireAuth sends logged-out users to /login) */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
