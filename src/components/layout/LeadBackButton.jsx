import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { backTarget, leadDashboardFallback } from "./leadBack.js";

export default function LeadBackButton({ inverted = false }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const fallback = leadDashboardFallback(pathname);
  const cls = inverted
    ? "flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-medium text-brand-800 shadow-sm transition hover:bg-brand-50"
    : "flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50";
  return <button type="button" onClick={() => navigate(backTarget(window.history.state?.idx, fallback))} className={cls} aria-label="Back">
    <ArrowLeft size={15} aria-hidden="true" />Back
  </button>;
}
