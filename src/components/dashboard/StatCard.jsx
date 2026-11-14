// One KPI card: label, big value, a short note, and a tinted icon.
export default function StatCard({ label, value, note, icon: Icon, tint }) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-md shadow-gray-200/70 ring-1 ring-gray-100">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-gray-500">{label}</p>
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tint}`}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
      {note && <p className="mt-2 text-sm text-gray-500">{note}</p>}
    </div>
  );
}