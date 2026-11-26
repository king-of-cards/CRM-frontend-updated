import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  ArrowUpRight,
  MapPin,
  Target,
} from "lucide-react";
import { getFilterOptions, getLeadStats, listLeads, listQuery } from "../../api/leadLists.js";
import { listBranches } from "../../api/branches.js";
import { pincodeArea } from "../leads/pincode.js";
import { storeFor } from "../leads/stores.js";
import BranchCell from "../leads/BranchCell.jsx";
import { useVendors } from "../leads/InlineCrm.jsx";
import LeadSearch from "../leads/LeadSearch.jsx";
import { useAuth } from "../../auth/useAuth.js";
import { withCrm } from "../leads/CrmColumns.jsx";
import {
  countdown,
  dateTime,
  dayDate,
  emptyCrm,
  LeadTable,
  Pagination,
  SectionShell,
} from "../leads/LeadKit.jsx";
import CrmLeadActions from "../crmLeads/CrmLeadActions.jsx";
import { kpiCards } from "../leads/kpiCards.js";
import CrmRowBadge from "../crmLeads/CrmRowBadge.jsx";
import LeadFilterBar from "../leads/LeadFilterBar.jsx";
import { useLeadFilters } from "../leads/useLeadFilters.js";
import { isGiftService, servicesOf } from "../leads/otherServices.js";

// Spin leads: read live from the workflow database (read-only), plus the leads added or uploaded
// in the CRM. The CRM columns come from our own database next to each lead (sidecar), matched by
// the lead's id. Gift leads (Other wedding services naming "Wedding Gifts & Return Gifts") are
// Spin leads too; only their automatic vendor differs (Kraftyz, docs section 17).

const PAGE_SIZE = 10; // the default page size (10 / 25 / 50 / 100)

// The page's look. branchVendor: Spin's leads go to their branch's vendor automatically (gift
// leads excepted: the API's "source_default" vendor is kept). explore: "Explore all fields".
const SPIN_PAGES = {
  spin: {
    theme: "spin",
    icon: Target,
    title: "Spin leads",
    leadLabel: "Spin lead",
    emptyName: "spin leads",
    branchVendor: true,
    explore: true,
  },
};

// Remembered so later loads need one request
const createdKey = (source) => `crm-${source}-created-column`;

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
  otherServices: ["otherweddingservices"],
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
  if (col && !col.json_field && /TIMESTAMP|DATETIME/i.test(col.type ?? ""))
    return dateTime(value);
  // Dates (typed DATE, or ISO text in any field) read "19 Nov 2026", never raw ISO
  if (col && !col.json_field && /^DATE$/i.test(col.type ?? "")) return dayDate(value);
  if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}.*)?$/.test(String(value)))
    return String(value).length > 10 ? dateTime(value) : dayDate(value);
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
  if (crm && ["manual", "sheet", "branch", "source_default"].includes(crm.vendor_source))
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

function storedCreated(source) {
  try {
    const v = sessionStorage.getItem(createdKey(source));
    return v === null ? undefined : v || null; // "" = no created column
  } catch {
    return undefined;
  }
}

export default function RecentLeads({ source = "spin" }) {
  const look = SPIN_PAGES[source] ?? SPIN_PAGES.spin;
  const Icon = look.icon;
  const { seesAll, canSeeLeads } = useAuth(); // admins and viewers: Explore all fields and the admin filters
  const [createdCol, setCreatedCol] = useState(() => storedCreated(source));
  const [page, setPage] = useState(1);
  // Filters, kept in the URL; the same for the list and the export
  // Rows per page live in the URL too (?page_size=25)
  const { filters, query, queryKey, update, clear, apply, clearFilters, count, pageSize, setPageSize } =
    useLeadFilters(source);
  const sortValue = filters.sort || "created:desc";
  const [openKey, setOpenKey] = useState(null); // lead to open (picked from the search suggestions)
  const [options, setOptions] = useState(() => getFilterOptions.peek(source) ?? null);
  const [stats, setStats] = useState(() => getLeadStats.peek(source, query) ?? null);
  const [branches, setBranches] = useState(
    () => listBranches.peek()?.branches ?? [],
  );
  const vendors = useVendors();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const lastParams = useRef({}); // the list's current params, for Export

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

  // Any filter or sort change goes back to page 1
  useEffect(() => setPage(1), [queryKey, sortValue, pageSize]);

  // Dropdown values: branches, pincodes, budgets, origins, interests, vendors (admins)
  useEffect(() => {
    if (!canSeeLeads) return;
    getFilterOptions(source)
      .then(setOptions)
      .catch(() => {});
  }, [canSeeLeads, reloadKey]);

  // Branch names for the filter
  useEffect(() => {
    if (!canSeeLeads) return;
    listBranches()
      .then((d) => setBranches(d.branches))
      .catch(() => {});
  }, [canSeeLeads]);

  useEffect(() => {
    if (!canSeeLeads) return;
    let cancelled = false;

    const [key, order] = sortValue.split(":");
    const sort =
      key === "created"
        ? createdCol || undefined
        : key === "none"
          ? undefined
          : key;
    const params = listQuery({
      page,
      pageSize,
      filters: query,
      sort,
      order: sort ? order : undefined,
    });
    lastParams.current = { ...query, sort, order: sort ? order : undefined };

    const cached =
      createdCol !== undefined ? listLeads.peek(source, params) : undefined;
    if (cached) setData(cached);
    setLoading(!cached);

    (async () => {
      try {
        let res;
        if (createdCol === undefined) {
          // First visit: learn the columns, find the "created" column, then sort by it
          res = await listLeads(source, { page: 1, page_size: PAGE_SIZE });
          const found = pick(res.columns).created;
          try {
            sessionStorage.setItem(createdKey(source), found ?? "");
          } catch {
            // fine: found again next time
          }
          if (!cancelled) setCreatedCol(found ?? null);
          return; // the effect runs again with the column known
        }
        res = await listLeads(source, params);
        // Stats over the same filters: GET /spin-leads/stats -> { total, kpis }
        getLeadStats(source, query)
          .then((st) => !cancelled && setStats(st))
          .catch(() => {});
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSeeLeads, page, pageSize, queryKey, sortValue, createdCol, reloadKey]);

  if (!canSeeLeads) return null;
  const items = data?.items ?? [];

  // Search suggestions: the best matching leads (name, phone, email, branch)
  function suggestLeads(q) {
    const sort = createdCol || undefined;
    return listLeads(source, {
      page: 1,
      page_size: 10,
      search: q,
      sort,
      order: sort ? "desc" : undefined,
    }).then((res) => {
      const ff = pick(res.columns);
      // page_size must be 10 / 25 / 50 / 100: ask for 10, suggest the first 7
      return res.items.slice(0, 7).map((l) => {
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

  const pkName = "id";

  return (
    <SectionShell
      theme={look.theme}
      icon={Icon}
      title={look.title}
      subtitle={`Live from the workflow database (read-only) · ${columns.length || "—"} fields per lead`}
      action={
        <div className="flex flex-wrap items-center gap-2">
          {seesAll && look.explore && (
            <Link
              to="/leads"
              className="flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
            >
              Explore all fields <ArrowUpRight size={15} />
            </Link>
          )}
          <CrmLeadActions
            source={source}
            exportParams={() => lastParams.current}
            onChanged={reload}
          />
        </div>
      }
      message={error}
      // The six KPIs over the current filters (stats.kpis)
      stats={kpiCards(stats?.kpis)}
      toolbar={
        <LeadFilterBar
          source={source}
          filters={filters}
          update={update}
          clear={clear}
          apply={apply}
          clearFilters={clearFilters}
          count={count}
          options={options}
          isAdmin={seesAll}
          sorts={sorts}
          sortValue={sortValue}
          renderSearch={({ value, onChange }) => (
            <LeadSearch
              value={value}
              onChange={onChange}
              placeholder="Search name, phone, email…"
              fetchSuggestions={suggestLeads}
              onPick={(sug) => {
                onChange(sug.searchText);
                setOpenKey(sug.key);
              }}
            />
          )}
        />
      }
      footer={
        <Pagination
          page={page}
          pageSize={pageSize}
          onPageSize={setPageSize}
          total={data?.total}
          onPage={setPage}
          disabled={loading}
        />
      }
    >
      <LeadTable
        theme={look.theme}
        rows={items}
        rowKey={(l) => l[pkName] ?? JSON.stringify(l).slice(0, 80)}
        loading={loading && !data}
        dimmed={loading && Boolean(data)}
        identity={(l) => ({
          badge: <CrmRowBadge source={source} lead={l} leadKey={l[pkName]} />,
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
            render: (l) => <BranchCell branch={locationOf(l, f, branches).branch} />,
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
            // Comma-separated services as small chips; the gift service is highlighted
            id: "other_services",
            header: "Other wedding services",
            render: (l) => {
              const list = servicesOf(f.otherServices ? l[f.otherServices] : null);
              if (!list.length) return null;
              return (
                <span className="flex min-w-[11rem] max-w-[18rem] flex-wrap gap-1 whitespace-normal">
                  {list.map((s) => (
                    <span
                      key={s}
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${isGiftService(s) ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-gray-50 text-gray-700 ring-gray-200"}`}
                    >
                      {s}
                    </span>
                  ))}
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
        source={source}
        crm={(l) => {
          const crm = l.crm ?? (l.id != null ? emptyCrm(l.id) : null);
          return look.branchVendor ? withBranchVendor(crm, locationOf(l, f, branches).branch, vendors) : crm;
        }}
        crmKey={(l) => l.id}
        context={(l) => ({
          pincode: f.pincode ? String(l[f.pincode] ?? "") : undefined,
          location: f.city ? l[f.city] : undefined,
        })}
        onCrmSaved={(key, crm) => setData((d) => withCrm(d, key, crm))}
        panel={(l) => ({
          sourceLabel: look.leadLabel,
          title: (f.name && l[f.name]) || look.leadLabel,
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
                ["Other wedding services", servicesOf(f.otherServices ? l[f.otherServices] : null).join(", ") || null],
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
                      f.otherServices,
                      createdCol,
                    ].includes(c.name),
                )
                .map((c) => [label(c), show(l[c.name], c)]),
            },
          ],
        })}
        empty={
          count || filters.search
            ? `No ${look.emptyName} match these filters.`
            : `No ${look.emptyName} yet.`
        }
        openKey={openKey}
        onOpened={() => setOpenKey(null)}
      />
    </SectionShell>
  );
}
