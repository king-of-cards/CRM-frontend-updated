import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  ArrowUpRight,
  Building2,
  Filter,
  MapPin,
  Target,
  X,
} from "lucide-react";
import { getSpinFilterOptions, listSpinLeads } from "../../api/spinLeads.js";
import { INTEREST_OPTIONS } from "../../api/leadCrm.js";
import { listBranches } from "../../api/branches.js";
import { pincodeArea } from "../leads/pincode.js";
import { STORES, storeFor } from "../leads/stores.js";
import { useVendors } from "../leads/InlineCrm.jsx";
import PincodePicker from "../leads/PincodePicker.jsx";
import LeadSearch from "../leads/LeadSearch.jsx";
import { useAuth } from "../../auth/useAuth.js";
import FilterSelect from "./FilterSelect.jsx";
import { withCrm } from "../leads/CrmColumns.jsx";
import {
  countdown,
  dateTime,
  dayDate,
  emptyCrm,
  fmt,
  LeadTable,
  Pagination,
  SectionShell,
  useDebounced,
} from "../leads/LeadKit.jsx";

// Spin leads: read live from the workflow database (read-only). The CRM columns come from
// our own database next to each lead (sidecar), matched by the lead's id.

const PAGE_SIZE = 10;

const QUOTE_OPS = [
  { value: "", label: "Any quote" },
  { value: "eq", label: "Equal to (=)" },
  { value: "ne", label: "Not equal (≠)" },
  { value: "gt", label: "More than (>)" },
  { value: "gte", label: "At least (≥)" },
  { value: "lt", label: "Less than (<)" },
  { value: "lte", label: "At most (≤)" },
  { value: "set", label: "Has a quote" },
  { value: "unset", label: "No quote yet" },
];
const labelCls =
  "mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-500";
// Quote operator dropdown: fixed width so the amount box beside it keeps its room
const opCls =
  "w-44 flex-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20";
const inputCls =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20";
const CREATED_KEY = "crm-spin-created-column"; // remembered so later loads need one request

// Which spin field is which. Matching ignores case, "_" and the "additional_details." prefix.
const FIELDS = {
  name: [
    "name",
    "fullname",
    "bridegroomname",
    "customername",
    "leadname",
    "clientname",
    "contactname",
  ],
  phone: [
    "phone",
    "phonenumber",
    "mobile",
    "mobilenumber",
    "bridegroomphone",
    "contactnumber",
    "whatsapp",
    "whatsappnumber",
  ],
  email: ["email", "emailaddress", "customeremail"],
  occasion: ["occasiontype", "eventtype", "occasion"],
  eventDate: ["occasiondate", "eventdate", "weddingdate"],
  pincode: ["pincode", "pin", "zipcode"],
  city: ["city", "location", "eventcity"],
  budget: ["estimatedbudgetpercard", "servicebudget", "budget"],
  created: ["createdat", "created", "createdon", "submittedat"],
  branch: ["branchid", "spinbranchid", "branch", "storeid", "store"],
};
const norm = (s) =>
  String(s)
    .toLowerCase()
    .replace(/^additional_details\./, "")
    .replace(/[^a-z0-9]/g, "");

function pick(columns) {
  const names = columns.map((c) => c.name);
  const out = {};
  for (const [field, candidates] of Object.entries(FIELDS)) {
    out[field] =
      candidates.map((c) => names.find((n) => norm(n) === c)).find(Boolean) ??
      null;
  }
  if (!out.name) out.name = names.find((n) => norm(n).includes("name")) ?? null;
  if (!out.phone)
    out.phone = names.find((n) => /phone|mobile/.test(norm(n))) ?? null;
  // Branch: any field with "branch" or "store" in its name (branch_id, spin_branch, storeId…)
  if (!out.branch)
    out.branch =
      names.find((n) => /branch/.test(norm(n))) ??
      names.find((n) => /store/.test(norm(n))) ??
      null;
  return out;
}

function label(col) {
  const raw = col.json_field ? col.key : col.name;
  return raw
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function show(value, col) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  if (col && !col.json_field && /TIMESTAMP/i.test(col.type ?? ""))
    return dateTime(value);
  if (col?.type === "range")
    return /^\d/.test(String(value))
      ? `₹${String(value).replace(/[-_]/g, "–")}`
      : String(value);
  return String(value);
}

// "Chamrajpet store · 560018 · Bangalore": branch, pincode and the area it belongs to
function locationOf(lead, f, branches) {
  // Branch: from the backend, or looked up from the lead's branch id (1-12 = the 12 stores)
  const branchId = lead.branch?.id ?? (f.branch ? lead[f.branch] : null);
  const branch =
    branchId != null && branchId !== "" ? storeFor(branchId, branches) : null;
  const pin = f.pincode && lead[f.pincode] ? String(lead[f.pincode]) : null;
  const city = f.city && lead[f.city] ? String(lead[f.city]) : null;
  const area = city || pincodeArea(pin) || (pin ? null : branch?.city) || null;
  return { branch, pin, area };
}

// A spin lead goes to its branch's vendor automatically (RJ / Phodeo / OHP), unless someone
// assigned a vendor in the CRM. The backend does this too; this covers older backends.
function withBranchVendor(crm, branch, vendors) {
  if (crm && ["manual", "sheet", "branch"].includes(crm.vendor_source))
    return crm;
  const vendor = branch?.vendor
    ? vendors.find((v) => v.name.toLowerCase() === branch.vendor.toLowerCase())
    : null;
  if (!vendor) return crm;
  return {
    ...crm,
    vendor: { id: vendor.id, name: vendor.name },
    vendor_source: "branch",
  };
}

function storedCreated() {
  try {
    const v = sessionStorage.getItem(CREATED_KEY);
    return v === null ? undefined : v || null; // "" = no created column
  } catch {
    return undefined;
  }
}

export default function RecentLeads() {
  const { isAdmin } = useAuth();
  const [createdCol, setCreatedCol] = useState(storedCreated);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput.trim());
  const [sortValue, setSortValue] = useState("created:desc");
  const [branch, setBranch] = useState("");
  const [pincode, setPincode] = useState("");
  const [openKey, setOpenKey] = useState(null); // lead to open (picked from the search suggestions)
  const [budget, setBudget] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [interest, setInterest] = useState("");
  const [converted, setConverted] = useState("");
  const [quotedOp, setQuotedOp] = useState("");
  const [quotedInput, setQuotedInput] = useState("");
  const quotedValue = useDebounced(quotedInput.replace(/\D/g, ""));
  const [options, setOptions] = useState(
    () => getSpinFilterOptions.peek() ?? null,
  );
  const [branches, setBranches] = useState(
    () => listBranches.peek()?.branches ?? [],
  );
  const vendors = useVendors();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const columns = useMemo(() => data?.columns ?? [], [data]);
  const f = useMemo(() => pick(columns), [columns]);

  // Sort options depend on which fields exist
  const sorts = useMemo(() => {
    const list = [];
    if (createdCol)
      list.push(
        { value: "created:desc", label: "Newest first" },
        { value: "created:asc", label: "Oldest first" },
      );
    if (f.eventDate)
      list.push({ value: `${f.eventDate}:asc`, label: "Event date (soonest)" });
    if (f.name) list.push({ value: `${f.name}:asc`, label: "Name A–Z" });
    return list.length ? list : [{ value: "none:asc", label: "Default" }];
  }, [createdCol, f]);

  useEffect(
    () => setPage(1),
    [
      search,
      sortValue,
      branch,
      pincode,
      budget,
      vendorId,
      interest,
      converted,
      quotedOp,
      quotedValue,
    ],
  );

  // Budget values for the dropdown
  useEffect(() => {
    if (!isAdmin) return;
    getSpinFilterOptions()
      .then(setOptions)
      .catch(() => {});
  }, [isAdmin]);

  // Branch names for the filter
  useEffect(() => {
    if (!isAdmin) return;
    listBranches()
      .then((d) => setBranches(d.branches))
      .catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;

    const [key, order] = sortValue.split(":");
    const sort =
      key === "created"
        ? createdCol || undefined
        : key === "none"
          ? undefined
          : key;
    const quoteReady =
      quotedOp === "set" ||
      quotedOp === "unset" ||
      (quotedOp && quotedValue !== "");
    const params = {
      page,
      pageSize: PAGE_SIZE,
      search,
      sort,
      order,
      branch: branch || undefined,
      pincode: pincode || undefined,
      budget: budget || undefined,
      vendorId: vendorId || undefined,
      interest: interest || undefined,
      converted: converted || undefined,
      quotedOp: quoteReady ? quotedOp : undefined,
      quotedValue:
        quoteReady && quotedValue !== "" ? Number(quotedValue) : undefined,
    };

    const cached =
      createdCol !== undefined ? listSpinLeads.peek(params) : undefined;
    if (cached) setData(cached);
    setLoading(!cached);

    (async () => {
      try {
        let res;
        if (createdCol === undefined) {
          // First visit: learn the columns, find the "created" column, then sort by it
          res = await listSpinLeads({ page: 1, pageSize: PAGE_SIZE });
          const found = pick(res.columns).created;
          try {
            sessionStorage.setItem(CREATED_KEY, found ?? "");
          } catch {
            // fine: found again next time
          }
          if (!cancelled) setCreatedCol(found ?? null);
          return; // the effect runs again with the column known
        }
        res = await listSpinLeads(params);
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      } catch (err) {
        if (!cancelled)
          setError({
            kind: "error",
            text:
              err.status === 503
                ? "The workflow database is unavailable right now."
                : err.message,
          });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isAdmin,
    page,
    search,
    sortValue,
    createdCol,
    branch,
    pincode,
    budget,
    vendorId,
    interest,
    converted,
    quotedOp,
    quotedValue,
  ]);

  if (!isAdmin) return null;
  const items = data?.items ?? [];

  // Search suggestions: the best matching leads (name, phone, email, branch)
  function suggestLeads(q) {
    const sort = createdCol || undefined;
    return listSpinLeads({
      page: 1,
      pageSize: 7,
      search: q,
      sort,
      order: "desc",
    }).then((res) => {
      const ff = pick(res.columns);
      return res.items.map((l) => {
        const name = (ff.name && l[ff.name]) || "Unnamed lead";
        const phone = ff.phone && l[ff.phone] ? String(l[ff.phone]) : null;
        const email = ff.email && l[ff.email] ? String(l[ff.email]) : null;
        const b = locationOf(l, ff, branches).branch;
        return {
          key: l.id,
          title: name,
          subtitle: [
            phone,
            email,
            ff.pincode && l[ff.pincode] ? `Pincode ${l[ff.pincode]}` : null,
          ]
            .filter(Boolean)
            .join(" · "),
          meta: b?.name ?? null,
          searchText: phone || email || name,
        };
      });
    });
  }

  const branchChoices = branches.length
    ? branches.filter((b) => b.is_active)
    : Object.values(STORES);
  const activeCount = [
    branch,
    pincode,
    budget,
    vendorId,
    interest,
    converted,
    quotedOp,
  ].filter(Boolean).length;
  function clearFilters() {
    setBranch("");
    setPincode("");
    setBudget("");
    setVendorId("");
    setInterest("");
    setConverted("");
    setQuotedOp("");
    setQuotedInput("");
    setSearchInput("");
  }
  const pkName = "id";

  return (
    <SectionShell
      theme="spin"
      icon={Target}
      title="Spin leads"
      subtitle={`Live from the workflow database (read-only) · ${columns.length || "—"} fields per lead`}
      action={
        <Link
          to="/leads"
          className="flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
        >
          Explore all fields <ArrowUpRight size={15} />
        </Link>
      }
      message={error}
      stats={[
        { label: "Total spin leads", value: fmt(data?.total) },
        { label: "On this page", value: fmt(items.length) },
        {
          label: "Converted (this page)",
          value: fmt(items.filter((i) => i.crm?.converted).length),
          tone: "emerald",
        },
      ]}
      toolbar={
        <div className="w-full space-y-4">
          {/* Branches on top */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Branch
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
              {[
                { id: "", name: "All branches", spin_leads: null },
                ...branchChoices,
              ].map((b) => {
                const active = String(branch) === String(b.id);
                return (
                  <button
                    key={b.id || "all"}
                    type="button"
                    onClick={() => setBranch(String(b.id))}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition ${
                      active
                        ? "bg-sky-600 text-white ring-sky-600 shadow-md shadow-sky-600/20"
                        : "bg-white text-gray-600 ring-gray-200 hover:bg-sky-50 hover:text-sky-800"
                    }`}
                  >
                    {b.id !== "" && <Building2 size={13} aria-hidden="true" />}
                    {b.name}
                    {b.spin_leads != null && (
                      <span
                        className={`text-xs ${active ? "text-white/80" : "text-gray-400"}`}
                      >
                        {b.spin_leads}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filters */}
          <div className="rounded-2xl bg-gray-50/80 p-4 ring-1 ring-gray-100">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Filter
                  size={15}
                  className="text-brand-600"
                  aria-hidden="true"
                />{" "}
                Filters
                {activeCount > 0 && (
                  <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                    {activeCount}
                  </span>
                )}
              </p>
              <div className="flex items-center gap-3">
                <LeadSearch
                  value={searchInput}
                  onChange={setSearchInput}
                  placeholder="Search name, phone, email…"
                  fetchSuggestions={suggestLeads}
                  onPick={(sug) => {
                    setSearchInput(sug.searchText);
                    setOpenKey(sug.key);
                  }}
                />
                {activeCount > 0 && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-gray-500 hover:bg-white hover:text-gray-900"
                  >
                    <X size={14} /> Clear
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div className="block">
                <span className={labelCls}>Pincode</span>
                <PincodePicker
                  value={pincode}
                  onChange={setPincode}
                  options={options?.pincodes ?? []}
                />
              </div>
              <label className="block">
                <span className={labelCls}>Budget</span>
                <select
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Any budget</option>
                  {(options?.budgets ?? []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {/^\d/.test(o.value)
                        ? `₹${String(o.value).replace(/[-_]/g, "–")}`
                        : o.value}{" "}
                      ({o.count})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelCls}>Assigned to</span>
                <select
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Any vendor</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelCls}>Interest</span>
                <select
                  value={interest}
                  onChange={(e) => setInterest(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Any</option>
                  {INTEREST_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                  <option value="none">Not set yet</option>
                </select>
              </label>
              <div className="block sm:col-span-2 lg:col-span-2 xl:col-span-2">
                <span className={labelCls}>Quoted amount</span>
                <div className="flex gap-2">
                  <select
                    value={quotedOp}
                    onChange={(e) => setQuotedOp(e.target.value)}
                    className={opCls}
                    aria-label="Quoted amount operator"
                  >
                    {QUOTE_OPS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <span className="relative block min-w-0 flex-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                      ₹
                    </span>
                    <input
                      inputMode="numeric"
                      value={quotedInput}
                      onChange={(e) =>
                        setQuotedInput(e.target.value.replace(/[^\d]/g, ""))
                      }
                      disabled={
                        !quotedOp || quotedOp === "set" || quotedOp === "unset"
                      }
                      placeholder={
                        quotedOp && quotedOp !== "set" && quotedOp !== "unset"
                          ? "Amount"
                          : "Pick an operator"
                      }
                      aria-label="Quoted amount value"
                      className={`${inputCls} pl-7 disabled:bg-gray-50 disabled:text-gray-400`}
                    />
                  </span>
                </div>
              </div>
              <label className="block">
                <span className={labelCls}>Converted</span>
                <select
                  value={converted}
                  onChange={(e) => setConverted(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Any</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
            </div>

            <div className="mt-3 flex justify-end">
              <FilterSelect
                label="Sort"
                value={sortValue}
                onChange={setSortValue}
                options={sorts}
              />
            </div>
          </div>
        </div>
      }
      footer={
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={data?.total}
          onPage={setPage}
          disabled={loading}
        />
      }
    >
      <LeadTable
        theme="spin"
        rows={items}
        rowKey={(l) => l[pkName] ?? JSON.stringify(l).slice(0, 80)}
        loading={loading && !data}
        dimmed={loading && Boolean(data)}
        identity={(l) => ({
          name: (f.name && l[f.name]) || "Unnamed lead",
          subtitle:
            (f.email && l[f.email]) ||
            [locationOf(l, f, branches).area, f.pincode && l[f.pincode]]
              .filter(Boolean)
              .join(" · ") ||
            null,
        })}
        contact={(l) => ({
          phone: f.phone ? l[f.phone] : null,
          email: f.email ? l[f.email] : null,
        })}
        columns={[
          {
            id: "branch",
            header: "Branch",
            render: (l) => {
              const b = locationOf(l, f, branches).branch;
              if (!b)
                return <span className="text-xs text-gray-400">No branch</span>;
              return (
                <span className="block leading-tight">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800 ring-1 ring-sky-100">
                    <Building2 size={12} aria-hidden="true" />
                    {b.name}
                  </span>
                  {(b.code || b.city) && (
                    <span className="mt-1 block pl-1 text-[11px] text-gray-500">
                      {[b.code, b.city].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
              );
            },
          },
          {
            id: "location",
            header: "Location",
            render: (l) => {
              const loc = locationOf(l, f, branches);
              if (!loc.pin && !loc.area) return null;
              return (
                <span className="flex items-center gap-1 text-sm text-gray-700">
                  <MapPin
                    size={12}
                    className="text-gray-400"
                    aria-hidden="true"
                  />
                  {[loc.area, loc.pin].filter(Boolean).join(" · ")}
                </span>
              );
            },
          },
          {
            id: "occasion",
            header: "Occasion",
            render: (l) =>
              f.occasion && l[f.occasion] ? (
                <span className="text-gray-800">{String(l[f.occasion])}</span>
              ) : null,
          },
          {
            id: "event",
            header: "Event date",
            render: (l) => {
              const v = f.eventDate ? l[f.eventDate] : null;
              if (!v) return null;
              const cd = countdown(v);
              return (
                <span>
                  <span className="text-gray-800">{dayDate(v)}</span>
                  {cd && (
                    <span className={`ml-1.5 text-xs ${cd.tone}`}>
                      {cd.text}
                    </span>
                  )}
                </span>
              );
            },
          },
          {
            id: "budget",
            header: "Budget",
            align: "right",
            render: (l) => {
              const col = columns.find((c) => c.name === f.budget);
              const v = f.budget ? show(l[f.budget], col) : null;
              return v ? (
                <span className="font-semibold tabular-nums text-gray-900">
                  {v}
                </span>
              ) : null;
            },
          },
        ]}
        trailing={[
          {
            id: "created",
            header: "Created",
            render: (l) =>
              createdCol && l[createdCol] ? (
                <span className="text-gray-500">{dateTime(l[createdCol])}</span>
              ) : null,
          },
        ]}
        source="spin"
        crm={(l) =>
          withBranchVendor(
            l.crm ?? (l.id != null ? emptyCrm(l.id) : null),
            locationOf(l, f, branches).branch,
            vendors,
          )
        }
        crmKey={(l) => l.id}
        context={(l) => ({
          pincode: f.pincode ? String(l[f.pincode] ?? "") : undefined,
          location: f.city ? l[f.city] : undefined,
        })}
        onCrmSaved={(key, crm) => setData((d) => withCrm(d, key, crm))}
        panel={(l) => ({
          sourceLabel: "Spin lead",
          title: (f.name && l[f.name]) || "Spin lead",
          subtitle: [
            locationOf(l, f, branches).branch?.name,
            f.occasion && l[f.occasion],
            f.pincode && l[f.pincode] ? `Pincode ${l[f.pincode]}` : null,
          ]
            .filter(Boolean)
            .join(" · "),
          sections: [
            {
              title: "Lead summary",
              rows: [
                [
                  "Branch",
                  (() => {
                    const b = locationOf(l, f, branches).branch;
                    return b
                      ? [b.name, b.code, b.city].filter(Boolean).join(" · ")
                      : null;
                  })(),
                ],
                [
                  "Location",
                  (() => {
                    const loc = locationOf(l, f, branches);
                    return (
                      [loc.area, loc.pin && `Pincode ${loc.pin}`]
                        .filter(Boolean)
                        .join(" · ") || null
                    );
                  })(),
                ],
                ["Name", f.name ? show(l[f.name]) : null],
                ["Phone", f.phone ? show(l[f.phone]) : null],
                ["Email", f.email ? show(l[f.email]) : null],
                ["Occasion", f.occasion ? show(l[f.occasion]) : null],
                [
                  "Event date",
                  f.eventDate && l[f.eventDate]
                    ? dayDate(l[f.eventDate])
                    : null,
                ],
                ["Pincode", f.pincode ? show(l[f.pincode]) : null],
                [
                  "Budget",
                  f.budget
                    ? show(
                        l[f.budget],
                        columns.find((c) => c.name === f.budget),
                      )
                    : null,
                ],
                [
                  "Created",
                  createdCol && l[createdCol] ? dateTime(l[createdCol]) : null,
                ],
              ],
            },
            {
              title: "All fields",
              rows: columns
                .filter(
                  (c) =>
                    ![
                      f.name,
                      f.phone,
                      f.email,
                      f.occasion,
                      f.eventDate,
                      f.pincode,
                      f.budget,
                      createdCol,
                    ].includes(c.name),
                )
                .map((c) => [label(c), show(l[c.name], c)]),
            },
          ],
        })}
        empty={
          search || activeCount
            ? "No spin leads match these filters."
            : "No spin leads yet."
        }
        openKey={openKey}
        onOpened={() => setOpenKey(null)}
      />
    </SectionShell>
  );
}
