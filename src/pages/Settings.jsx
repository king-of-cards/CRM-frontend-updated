import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Database,
  RefreshCw,
  Sheet,
  UserRound,
  XCircle,
} from "lucide-react";
import DashboardLayout from "../components/layout/DashboardLayout.jsx";
import { useAuth } from "../auth/useAuth.js";
import { checkDatabase } from "../api/health.js";
import { readDbHealth } from "../api/readDb.js";
import { listSheetSources, syncSheet } from "../api/sheets.js";

// Settings: your account, system status, and the Google Sheets connections (sync status + Sync now).

const SOURCE_LABELS = {
  whatsapp: "International",
  wedding: "Wedding",
  wedding_planner: "Wedding planner",
};

function formatDateTime(iso) {
  if (!iso) return "never";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Card({ icon: Icon, title, subtitle, action, children }) {
  return (
    <section className="mt-6 rounded-2xl bg-white ring-1 ring-gray-100 shadow-sm shadow-gray-200/60">
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 pt-5">
        <div className="flex items-start gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-600"
            aria-hidden="true"
          >
            <Icon size={17} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>
            )}
          </div>
        </div>
        {action}
      </div>
      <div className="px-6 pb-6 pt-4">{children}</div>
    </section>
  );
}

function StatusRow({ name, state, detail }) {
  const ok = state === "ok";
  return (
    <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-gray-900">{name}</p>
        {detail && <p className="text-xs text-gray-500">{detail}</p>}
      </div>
      {state === "loading" ? (
        <span className="h-4 w-20 animate-pulse rounded bg-gray-200" />
      ) : (
        <span
          className={`flex items-center gap-1.5 text-sm font-medium ${ok ? "text-emerald-600" : "text-red-600"}`}
        >
          {ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {ok ? "Connected" : "Not reachable"}
        </span>
      )}
    </div>
  );
}

export default function Settings() {
  const { user, isAdmin } = useAuth();
  const [health, setHealth] = useState({
    main: "loading",
    read: "loading",
    readDetail: "",
  });
  const [sources, setSources] = useState(null);
  const [syncing, setSyncing] = useState({}); // source -> true while syncing
  const [messages, setMessages] = useState({}); // source -> { kind, text }

  const loadSources = useCallback(() => {
    listSheetSources()
      .then((res) => setSources(res.sources))
      .catch((err) => setSources({ error: err.message }));
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    checkDatabase()
      .then(() => setHealth((h) => ({ ...h, main: "ok" })))
      .catch(() => setHealth((h) => ({ ...h, main: "down" })));
    readDbHealth()
      .then((r) =>
        setHealth((h) => ({
          ...h,
          read: "ok",
          readDetail: [r.engine, r.name].filter(Boolean).join(" · "),
        })),
      )
      .catch((err) =>
        setHealth((h) => ({ ...h, read: "down", readDetail: err.message })),
      );
    loadSources();
  }, [isAdmin, loadSources]);

  async function sync(source) {
    setSyncing((s) => ({ ...s, [source]: true }));
    setMessages((m) => ({ ...m, [source]: null }));
    try {
      const run = await syncSheet(source);
      const changes = [
        run.inserted && `${run.inserted} new`,
        run.updated && `${run.updated} updated`,
        run.removed && `${run.removed} removed`,
      ].filter(Boolean);
      setMessages((m) => ({
        ...m,
        [source]: {
          kind: "ok",
          text: changes.length ? changes.join(", ") : "No changes",
        },
      }));
    } catch (err) {
      setMessages((m) => ({
        ...m,
        [source]: {
          kind: "error",
          text: err.status === 409 ? "Another sync is running" : err.message,
        },
      }));
    } finally {
      setSyncing((s) => ({ ...s, [source]: false }));
      loadSources();
    }
  }

  async function syncAll() {
    for (const s of sources ?? []) {
      if (s.syncable) await sync(s.source); // one after another: the backend runs one sync at a time
    }
  }

  const anySyncing = Object.values(syncing).some(Boolean);
  const initials = (user?.name ?? "")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <DashboardLayout
      title="Settings"
      description="Your account, system status and Google Sheets connections."
    >
      {/* Account */}
      <Card icon={UserRound} title="Your account">
        {user && (
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-brand-600 to-brand-800 text-lg font-semibold text-white">
              {initials}
            </span>
            <div>
              <p className="text-base font-semibold text-gray-900">
                {user.name}
              </p>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
            <span className="ml-auto rounded-full bg-brand-50 px-3 py-1 text-xs font-medium capitalize text-brand-800 ring-1 ring-brand-200">
              {user.role}
            </span>
          </div>
        )}
      </Card>

      {isAdmin && (
        <>
          {/* System status */}
          <Card
            icon={Database}
            title="System status"
            subtitle="Whether the backend can reach its databases right now."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <StatusRow
                name="CRM database (MySQL)"
                state={health.main}
                detail="Users, sessions and synced sheet leads"
              />
              <StatusRow
                name="Workflow database (read-only)"
                state={health.read}
                detail={health.readDetail || "Spin leads"}
              />
            </div>
          </Card>

          {/* Google Sheets */}
          <Card
            icon={Sheet}
            title="Google Sheets"
            subtitle="Sheets are copied into the database automatically every few minutes. Use Sync now to copy them immediately."
            action={
              <button
                type="button"
                onClick={syncAll}
                disabled={anySyncing || !Array.isArray(sources)}
                className="flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-60"
              >
                <RefreshCw
                  size={15}
                  className={anySyncing ? "animate-spin" : ""}
                />
                Sync all
              </button>
            }
          >
            {sources?.error ? (
              <p
                role="alert"
                className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200"
              >
                {sources.error}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="whitespace-nowrap border-b border-gray-100 text-xs text-gray-500">
                    <tr>
                      <th className="py-2.5 pr-4 font-medium">Sheet</th>
                      <th className="px-4 py-2.5 font-medium">
                        Last successful sync
                      </th>
                      <th className="px-4 py-2.5 font-medium">Last attempt</th>
                      <th className="px-4 py-2.5 font-medium">Last changes</th>
                      <th className="py-2.5 pl-4 text-right font-medium">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {!sources &&
                      Array.from({ length: 3 }).map((_, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td colSpan={5} className="py-3">
                            <span className="block h-3 w-2/3 animate-pulse rounded bg-gray-100" />
                          </td>
                        </tr>
                      ))}
                    {Array.isArray(sources) &&
                      sources.map((s) => {
                        const latest = s.latest_sync;
                        const ok = s.last_success;
                        const msg = messages[s.source];
                        return (
                          <tr
                            key={s.source}
                            className="border-b border-gray-100 last:border-0"
                          >
                            <td className="py-3 pr-4">
                              <p className="font-medium text-gray-900">
                                {SOURCE_LABELS[s.source] ?? s.source}
                              </p>
                              <p className="text-xs text-gray-400">
                                {s.source}
                              </p>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                              {formatDateTime(ok?.finished_at)}
                              {ok && (
                                <span className="ml-1 text-xs text-gray-400">
                                  ({ok.trigger})
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {!latest ? (
                                <span className="text-gray-400">—</span>
                              ) : latest.status === "success" ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600">
                                  <CheckCircle2 size={14} /> Success
                                </span>
                              ) : latest.status === "failed" ? (
                                <span
                                  className="block max-w-[260px] text-red-600"
                                  title={latest.error ?? ""}
                                >
                                  <span className="inline-flex items-center gap-1">
                                    <XCircle size={14} /> Failed
                                  </span>
                                  <span className="block truncate text-xs">
                                    {latest.error}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-gray-500 capitalize">
                                  {latest.status}
                                </span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">
                              {ok ? (
                                <>
                                  {ok.rows_read} rows ·{" "}
                                  <span className="text-emerald-600">
                                    +{ok.inserted}
                                  </span>{" "}
                                  · {ok.updated} updated · {ok.removed} removed
                                </>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="py-3 pl-4 text-right">
                              <div className="flex items-center justify-end gap-3">
                                {msg && (
                                  <span
                                    className={`text-xs ${msg.kind === "error" ? "text-red-600" : "text-emerald-600"}`}
                                  >
                                    {msg.text}
                                  </span>
                                )}
                                {s.syncable ? (
                                  <button
                                    type="button"
                                    onClick={() => sync(s.source)}
                                    disabled={anySyncing}
                                    className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                                  >
                                    <RefreshCw
                                      size={13}
                                      className={
                                        syncing[s.source] ? "animate-spin" : ""
                                      }
                                    />
                                    Sync now
                                  </button>
                                ) : (
                                  <span className="text-xs text-gray-400">
                                    No sync set up
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-4 text-xs text-gray-500">
              To connect another sheet: share it with the backend's service
              account (Viewer), add it to GOOGLE_SHEETS in the backend .env, and
              restart the backend.
            </p>
          </Card>
        </>
      )}
    </DashboardLayout>
  );
}
