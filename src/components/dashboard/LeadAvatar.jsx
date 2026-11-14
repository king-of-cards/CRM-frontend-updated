import { initials } from "../../utils/format.js";

const TINTS = [
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-rose-100 text-rose-700",
];

// Works for number ids and text ids (such as UUIDs from the database).
function tintFor(id) {
  const key = String(id ?? "");
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return TINTS[hash % TINTS.length];
}

// Tint comes from the lead id, so a lead keeps the same colour in the table and the side panel.
export default function LeadAvatar({ lead, size = "md" }) {
  const sizes = size === "lg" ? "size-14 text-lg" : "size-10 text-sm";
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${sizes} ${tintFor(lead.id)}`}
      aria-hidden="true"
    >
      {initials(lead.name || "?")}
    </span>
  );
}