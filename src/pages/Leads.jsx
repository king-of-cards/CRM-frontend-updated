import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout.jsx";
import { listSpinLeads } from "../api/spinLeads.js";

const PAGE_SIZE = 25;

// "additional_details.otherWeddingServices" -> "Other Wedding Services", "created_at" -> "Created At"
function columnLabel(col) {
  const raw = col.json_field ? col.key : col.name;
  return raw
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isDateType(type = "") {
  const t = type.toUpperCase();
  return t.includes("TIMESTAMP") || t === "DATE";
}

function formatCell(value, col) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (isDateType(col.type)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return col.type.toUpperCase() === "DATE"
        ? d.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : d.toLocaleString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
    }
  }
  return String(value);
}

export default function Leads() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(null);
  const [order, setOrder] = useState("desc");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Wait until typing pauses before searching
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    listSpinLeads({ page, pageSize: PAGE_SIZE, search, sort, order })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 403) setError("Only admins can view leads.");
        else if (err.status === 503)
          setError(
            "The leads database is unavailable right now. Try again in a moment.",
          );
        else setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, search, sort, order]);

  function toggleSort(name) {
    if (sort === name) {
      setOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSort(name);
      setOrder("asc");
    }
    setPage(1);
  }

  const columns = data?.columns ?? [];
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <DashboardLayout title="Leads">
      <section className="rounded-2xl bg-white shadow-md shadow-gray-200/70 ring-1 ring-gray-100">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 pt-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">All leads</h2>
            <p className="mt-1 text-sm text-gray-500">
              {data
                ? `${total.toLocaleString("en-IN")} leads`
                : "Loading leads…"}
            </p>
          </div>
          <label className="relative w-full sm:w-72">
            <span className="sr-only">Search leads</span>
            <Search
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search leads"
              className="w-full rounded-full border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
          </label>
        </div>

        {/* Table */}
        <div className="relative mt-5 overflow-x-auto">
          {error ? (
            <p
              role="alert"
              className="mx-6 mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200"
            >
              {error}
            </p>
          ) : (
            <table
              className={`w-full text-left text-sm transition-opacity ${loading ? "opacity-50" : ""}`}
            >
              <thead className="border-y border-gray-100 bg-gray-50/60 text-xs text-gray-500">
                <tr>
                  {columns.map((col) => {
                    const sortable = col.type !== "json";
                    const active = sort === col.name;
                    const Icon = active
                      ? order === "asc"
                        ? ArrowUp
                        : ArrowDown
                      : ArrowUpDown;
                    return (
                      <th
                        key={col.name}
                        className="whitespace-nowrap px-4 py-3 font-medium first:pl-6 last:pr-6"
                        aria-sort={
                          active
                            ? order === "asc"
                              ? "ascending"
                              : "descending"
                            : undefined
                        }
                      >
                        {sortable ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(col.name)}
                            className={`inline-flex items-center gap-1 transition-colors hover:text-gray-900 ${active ? "text-gray-900" : ""}`}
                          >
                            {columnLabel(col)}
                            <Icon
                              size={12}
                              className={active ? "" : "opacity-40"}
                            />
                          </button>
                        ) : (
                          columnLabel(col)
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr
                    key={item.id ?? i}
                    className="border-b border-gray-100 transition-colors last:border-0 hover:bg-brand-50/40"
                  >
                    {columns.map((col) => {
                      const text = formatCell(item[col.name], col);
                      return (
                        <td
                          key={col.name}
                          title={text.length > 40 ? text : undefined}
                          className="max-w-[260px] truncate whitespace-nowrap px-4 py-2.5 text-gray-700 first:pl-6 first:font-medium first:text-gray-900 last:pr-6"
                        >
                          {text}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {!loading && items.length === 0 && (
                  <tr>
                    <td
                      colSpan={Math.max(columns.length, 1)}
                      className="px-6 py-12 text-center text-sm text-gray-500"
                    >
                      {search ? `No leads match “${search}”.` : "No leads yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!error && total > 0 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3 text-sm text-gray-500">
            <span>
              {from}–{to} of {total.toLocaleString("en-IN")}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => p - 1)}
                disabled={page <= 1 || loading}
                aria-label="Previous page"
                className="rounded-full p-1.5 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="tabular-nums">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages || loading}
                aria-label="Next page"
                className="rounded-full p-1.5 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </section>
    </DashboardLayout>
  );
}
