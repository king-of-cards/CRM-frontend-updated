// Pill-shaped input with a hidden label (for screen readers) and an error line.
export default function TextInput({ id, label, error, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        name={id}
        placeholder={label}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full rounded-full border bg-white px-5 py-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 ${
          error ? "border-red-400" : "border-brand-200"
        }`}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 px-5 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
