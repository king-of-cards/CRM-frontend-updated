import { STATUSES } from "../../data/leads.js";
import { STATUS_STYLES } from "../../data/statusStyles.js";

const statusById = Object.fromEntries(STATUSES.map((s) => [s.id, s]));


export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.new;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm whitespace-nowrap ring-1 ${style.badge}`}
    >
      <span className={`size-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {statusById[status]?.label ?? status}
    </span>
  );
}