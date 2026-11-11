import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { useAuth } from "../auth/useAuth.js";
import AuthLayout from "../components/auth/AuthLayout.jsx";
import InfoPanel from "../components/auth/InfoPanel.jsx";
import TextInput from "../components/auth/TextInput.jsx";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate({ email, password }) {
  const errors = {};
  if (!email.trim()) errors.email = "Enter your email address.";
  else if (!EMAIL_PATTERN.test(email))
    errors.email = "Enter a valid email, like name@company.com.";
  if (!password) errors.password = "Enter your password.";
  return errors;
}

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isReady, login } = useAuth();

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((err) => ({ ...err, [name]: undefined }));
    setFormError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    setFormError("");
    try {
      await login(form.email, form.password);
      // Go back to the page the user tried to open, or to the dashboard
      const to = location.state?.from || "/dashboard";
      navigate(to, { replace: true, state: { fromLogin: true } });
    } catch (err) {
      if (err.status === 401) setFormError("Incorrect email or password.");
      else if (err.status === 0)
        setFormError(
          "Can't reach the server. Check that the backend is running.",
        );
      else
        setFormError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Already logged in (e.g. opened /login in a new tab): skip the form
  if (isReady && user) return <Navigate to="/dashboard" replace />;

  return (
    <AuthLayout
      panelSide="right"
      panel={
        <InfoPanel
          title="Welcome to the CRM"
          text="Your customers, leads and orders, all in one place."
        />
      }
    >
      <h1 className="text-center text-3xl font-bold text-gray-900">Sign In</h1>

      {formError && (
        <p
          role="alert"
          className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-center text-sm text-red-700 ring-1 ring-red-200"
        >
          {formError}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-3">
        <TextInput
          id="email"
          type="email"
          label="Email address"
          autoComplete="email"
          value={form.email}
          onChange={handleChange}
          error={errors.email}
        />
        <TextInput
          id="password"
          type="password"
          label="Password"
          autoComplete="current-password"
          value={form.password}
          onChange={handleChange}
          error={errors.password}
        />

        <div className="pt-1 text-center">
          <Link
            to="/forgot-password"
            className="text-xs text-gray-500 hover:text-brand-700"
          >
            Forgot your password?
          </Link>
        </div>

        <div className="pt-3 text-center">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-brand-700 px-12 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign In"}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
