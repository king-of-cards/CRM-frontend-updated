import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { useAuth } from "../auth/useAuth.js";
import { ArrowRight, Lock, Mail } from "lucide-react";
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

  // Download the dashboard's code while the user types, so it opens instantly after sign-in
  useEffect(() => {
    import("./Dashboard.jsx");
  }, []);

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
      {/* Brand + heading */}
      <p className="font-script text-3xl font-bold text-brand-700">CRM</p>
      <h1 className="mt-6 text-4xl font-bold tracking-tight text-gray-900">
        Sign in
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        Welcome back! Enter your details to continue.
      </p>

      {formError && (
        <p
          role="alert"
          className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200"
        >
          {formError}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
        <TextInput
          id="email"
          type="email"
          label="Email address"
          icon={Mail}
          autoComplete="email"
          value={form.email}
          onChange={handleChange}
          error={errors.email}
        />
        <TextInput
          id="password"
          type="password"
          label="Password"
          icon={Lock}
          autoComplete="current-password"
          value={form.password}
          onChange={handleChange}
          error={errors.password}
        />

        <div className="flex justify-end">
          <span
            className="text-sm text-gray-500"
            title="Password resets are done by an admin"
          >
            Forgot password?{" "}
            <span className="font-medium text-brand-700">Ask your admin</span>
          </span>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="group flex w-full items-center justify-center gap-2 rounded-full bg-linear-to-r from-brand-600 to-brand-800 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-700/30 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-700/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:pointer-events-none disabled:opacity-60"
        >
          {submitting ? "Signing in…" : "Sign in"}
          {!submitting && (
            <ArrowRight
              size={16}
              className="transition-transform group-hover:translate-x-0.5"
            />
          )}
        </button>
      </form>

      <p className="mt-10 text-center text-sm text-gray-500">
        Need an account? Ask your admin to add you.
      </p>
    </AuthLayout>
  );
}
