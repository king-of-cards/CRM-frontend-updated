import DateInput from "../shared/DateInput.jsx";
import { fieldCls } from "./Drawer.jsx";
import { useVendors } from "../leads/InlineCrm.jsx";

// One form input for a field from GET /crm-leads/{source}/fields.
// value is text ("" = empty); bool is "yes" / "no"; branch is the branch id as text.
// "Assigned to": Unassigned, each active vendor, or Automatic ("" = not sent = automatic).
const INPUT_TYPE = {
  email: "email",
  phone: "tel",
  date: "date",
  datetime: "datetime-local",
  int: "text",
  pincode: "text",
};

export default function LeadFieldInput({ field, value, onChange, error, branches = [] }) {
  const vendors = useVendors(); // active vendors (GET /vendors)
  const id = `crm-field-${field.key}`;
  const invalid = Boolean(error);
  const cls = `mt-1.5 ${fieldCls} ${invalid ? "border-red-300 focus:border-red-500 focus:ring-red-500/20" : ""}`;

  let input;
  const InputComponent = field.type === "date" || field.type === "datetime" ? DateInput : "input";
  if (field.type === "branch") {
    input = (
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cls} aria-invalid={invalid}>
        <option value="">No branch</option>
        {branches.map((b) => (
          <option key={b.id} value={String(b.id)}>
            {b.name}
            {b.city ? ` · ${b.city}` : ""}
          </option>
        ))}
      </select>
    );
  } else if (field.type === "assigned") {
    input = (
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cls} aria-invalid={invalid}>
        <option value="Unassigned">Unassigned</option>
        {vendors.map((v) => (
          <option key={v.id} value={v.name}>
            {v.name}
          </option>
        ))}
        <option value="">Automatic</option>
      </select>
    );
  } else if (field.type === "bool") {
    input = (
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cls} aria-invalid={invalid}>
        <option value="">—</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    );
  } else {
    input = (
      <InputComponent
        id={id}
        type={INPUT_TYPE[field.type] ?? "text"}
        inputMode={field.type === "int" || field.type === "pincode" ? "numeric" : undefined}
        value={value}
        maxLength={field.max_length ?? undefined}
        required={field.required}
        onChange={(e) => onChange(e.target.value)}
        className={cls}
        aria-invalid={invalid}
      />
    );
  }

  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-gray-600">
        {field.label}
        {field.required && <span className="ml-0.5 text-red-600">*</span>}
      </label>
      {input}
      {error ? (
        <p className="mt-1 text-[11px] text-red-600">{error}</p>
      ) : (
        field.help && <p className="mt-1 text-[11px] text-gray-500">{field.help}</p>
      )}
    </div>
  );
}
