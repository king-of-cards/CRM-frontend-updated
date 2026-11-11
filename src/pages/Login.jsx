import { useState } from "react";
import { Link, useNavigate } from "react-router";
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
  const navigate = useNavigate();

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((err) => ({ ...err, [name]: undefined }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      // TODO: call the Spring Boot login endpoint here and check the credentials.
      // For now, any email and password that pass the form checks go straight in.
      navigate("/dashboard", { replace: true, state: { fromLogin: true } });
    } finally {
      setSubmitting(false);
    }
  }

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
