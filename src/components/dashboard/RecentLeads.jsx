import { useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight, Mail, MoreHorizontal, Phone } from "lucide-react";

// Sample leads so the section has something to show.
// Replace with data from the Spring Boot API later.
const leads = [
  {
    id: 1,
    name: "Aarav Mehta",
    company: "Mehta Traders",
    email: "aarav@mehtatraders.in",
    source: "Website",
    value: 85000,
    status: "New",
    added: "2 hours ago",
  },
  {
    id: 2,
    name: "Priya Shah",
    company: "Shah Prints",
    email: "priya@shahprints.in",
    source: "Referral",
    value: 142000,
    status: "Contacted",
    added: "Yesterday",
  },
  {
    id: 3,
    name: "Rohan Kapoor",
    company: "Kapoor & Sons",
    email: "rohan@kapoorsons.com",
    source: "Trade show",
    value: 260000,
    status: "Qualified",
    added: "9 Nov",
  },
  {
    id: 4,
    name: "Neha Joshi",
    company: "Joshi Events",
    email: "neha@joshievents.in",
    source: "Instagram",
    value: 48000,
    status: "New",
    added: "8 Nov",
  },
  {
    id: 5,
    name: "Vikram Rao",
    company: "Rao Hospitality",
    email: "vikram@raohospitality.com",
    source: "Cold call",
    value: 195000,
    status: "Contacted",
    added: "7 Nov",
  },
  {
    id: 6,
    name: "Ananya Iyer",
    company: "Iyer Weddings",
    email: "ananya@iyerweddings.in",
    source: "Website",
    value: 72000,
    status: "Qualified",
    added: "6 Nov",
  },
];

const statusStyles = {
  New: { badge: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500" },
  Contacted: {
    badge: "bg-amber-50 text-amber-700 ring-amber-200",
    dot: "bg-amber-500",
  },
  Qualified: {
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    dot: "bg-emerald-500",
  },
};

// A different soft colour for each person's initials, picked from their name
const avatarColors = [
  "bg-brand-100 text-brand-800",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-800",
  "bg-sky-100 text-sky-800",
  "bg-violet-100 text-violet-800",
  "bg-emerald-100 text-emerald-800",
];

function initials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function avatarColor(name) {
  const sum = [...name].reduce((total, ch) => total + ch.charCodeAt(0), 0);
  return avatarColors[sum % avatarColors.length];
}

const formatINR = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

const filters = ["All", "New", "Contacted", "Qualified"];

export default function RecentLeads() {
  const [filter, setFilter] = useState("All");

  const shown =
    filter === "All" ? leads : leads.filter((l) => l.status === filter);
  const pipelineValue = shown.reduce((total, l) => total + l.value, 0);
  const countFor = (f) =>
    f === "All" ? leads.length : leads.filter((l) => l.status === f).length;

  return (
    <section className="mt-8 rounded-2xl bg-white shadow-md shadow-gray-200/70 ring-1 ring-gray-100">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 pt-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Recent leads</h2>
          <p className="mt-1 text-sm text-gray-500">
            {shown.length} {shown.length === 1 ? "lead" : "leads"} worth{" "}
            <span className="font-semibold text-gray-900">
              {formatINR(pipelineValue)}
            </span>
          </p>
        </div>
        <Link
          to="/leads"
          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50"
        >
          View all leads
          <ArrowUpRight size={16} />
        </Link>
      </div>

      {/* Filter tabs */}
      <div
        className="mt-5 flex gap-2 overflow-x-auto px-6"
        role="tablist"
        aria-label="Filter leads by status"
      >
        {filters.map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f)}
              className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
              }`}
            >
              {f}
              <span
                className={`rounded-full px-1.5 text-xs ${
                  active ? "bg-white/20 text-white" : "bg-white text-gray-500"
                }`}
              >
                {countFor(f)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-y border-gray-100 bg-gray-50/60 text-xs text-gray-500">
            <tr>
              <th className="px-6 py-3 font-medium">Lead</th>
              <th className="px-6 py-3 font-medium">Source</th>
              <th className="px-6 py-3 text-right font-medium">Deal value</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Added</th>
              <th className="px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((lead) => {
              const style = statusStyles[lead.status];
              return (
                <tr
                  key={lead.id}
                  className="group border-b border-gray-100 transition-colors last:border-0 hover:bg-brand-50/40"
                >
                  {/* Lead: avatar, name, company */}
                  <td className="px-6 py-2.5">
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarColor(lead.name)}`}
                        aria-hidden="true"
                      >
                        {initials(lead.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold leading-tight text-gray-900">
                          {lead.name}
                        </p>
                        <p className="truncate text-xs leading-tight text-gray-500">
                          {lead.company}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-2.5 text-gray-600">{lead.source}</td>

                  <td className="px-6 py-2.5 text-right font-semibold tabular-nums text-gray-900">
                    {formatINR(lead.value)}
                  </td>

                  <td className="px-6 py-2.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${style.badge}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${style.dot}`}
                        aria-hidden="true"
                      />
                      {lead.status}
                    </span>
                  </td>

                  <td className="px-6 py-2.5 text-gray-500">{lead.added}</td>

                  {/* Quick actions: appear on row hover (always visible on touch screens) */}
                  <td className="px-6 py-2.5">
                    <div className="flex justify-end gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                      <a
                        href={`mailto:${lead.email}`}
                        aria-label={`Email ${lead.name}`}
                        title="Send email"
                        className="rounded-full p-1.5 text-gray-500 transition-colors hover:bg-white hover:text-brand-700"
                      >
                        <Mail size={16} />
                      </a>
                      <button
                        type="button"
                        aria-label={`Call ${lead.name}`}
                        title="Call"
                        className="rounded-full p-1.5 text-gray-500 transition-colors hover:bg-white hover:text-brand-700"
                      >
                        <Phone size={16} />
                      </button>
                      <button
                        type="button"
                        aria-label={`More options for ${lead.name}`}
                        title="More"
                        className="rounded-full p-1.5 text-gray-500 transition-colors hover:bg-white hover:text-gray-900"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
