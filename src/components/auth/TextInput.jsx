import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

// Pill-shaped input with an optional icon on the left, a show/hide button for passwords,
// a hidden label (for screen readers) and an error line.
export default function TextInput({
  id,
  label,
  error,
  icon: Icon,
  type = "text",
  ...props
}) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";

  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-gray-400"
          />
        )}
        <input
          id={id}
          name={id}
          type={isPassword && visible ? "text" : type}
          placeholder={label}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`w-full rounded-full border bg-gray-50/60 py-3.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-brand-600 focus:bg-white focus:ring-4 focus:ring-brand-600/10 ${
            Icon ? "pl-12" : "pl-5"
          } ${isPassword ? "pr-12" : "pr-5"} ${error ? "border-red-400" : "border-gray-200"}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-gray-400 transition-colors hover:text-gray-700"
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 px-5 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
