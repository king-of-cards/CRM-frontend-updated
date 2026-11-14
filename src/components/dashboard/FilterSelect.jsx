// Small labelled dropdown used in the lead boxes' filter rows (sort order, country, step…).
// options: [{ value, label }]
export default function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="flex shrink-0 items-center gap-2 text-sm text-gray-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// "submitted_at:desc" <-> { sort, order }
export function parseSort(value) {
  const [sort, order] = value.split(":");
  return { sort, order };
}
