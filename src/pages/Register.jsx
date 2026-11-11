import { useState } from "react";
import { Link } from "react-router";
import AuthLayout from "../components/auth/AuthLayout.jsx";
import InfoPanel from "../components/auth/InfoPanel.jsx";
import TextInput from "../components/auth/TextInput.jsx";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate({ name, email, password, confirmPassword }) {
  const errors = {};
  if (!name.trim()) errors.name = "Enter your full name.";
  if (!email.trim()) errors.email = "Enter your email address.";
  else if (!EMAIL_PATTERN.test(email))
    errors.email = "Enter a valid email, like name@company.com.";
  if (password.length < 8) errors.password = "Use at least 8 characters.";
  if (confirmPassword !== password)
    errors.confirmPassword = "Passwords don't match.";
  return errors;
}

export default function Register() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

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
      // TODO: call the Spring Boot register endpoint here.
      console.log("Create account for", form.email);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      panelSide="left"
      panel={
        <InfoPanel
          title="Welcome to the CRM!"
          text="Already have an account? Sign in to pick up where you left off."
          actionLabel="Sign In"
          actionTo="/login"
        />
      }
    >
      <h1 className="text-center text-3xl font-bold text-gray-900">
        Create Account
      </h1>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-3">
        <TextInput
          id="name"
          label="Full name"
          autoComplete="name"
          value={form.name}
          onChange={handleChange}
          error={errors.name}
        />
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
          autoComplete="new-password"
          value={form.password}
          onChange={handleChange}
          error={errors.password}
        />
        <TextInput
          id="confirmPassword"
          type="password"
          label="Confirm password"
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={handleChange}
          error={errors.confirmPassword}
        />

        <div className="pt-3 text-center">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-brand-700 px-12 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60"
          >
            {submitting ? "Creating account…" : "Sign Up"}
          </button>
        </div>
      </form>

      <p className="mt-8 text-center text-sm text-gray-600 md:hidden">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-brand-700">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
