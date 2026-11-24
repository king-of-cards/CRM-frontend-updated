import { Building2 } from "lucide-react";

// A lead's branch in a list: the name as a pill, "code · city" underneath (Spin, KOC → Dhruva).
// branch: { name, code, city } from stores.js (storeFor / branchOf), or null.
export default function BranchCell({ branch, empty = "No branch" }) {
  if (!branch?.name) return <span className="text-xs text-gray-400">{empty}</span>;
  return (
    <span className="block leading-tight">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800 ring-1 ring-sky-100">
        <Building2 size={12} aria-hidden="true" />
        {branch.name}
      </span>
      {(branch.code || branch.city) && (
        <span className="mt-1 block pl-1 text-[11px] text-gray-500">
          {[branch.code, branch.city].filter(Boolean).join(" · ")}
        </span>
      )}
    </span>
  );
}
