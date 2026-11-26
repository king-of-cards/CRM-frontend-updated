import { Download, Loader2 } from "lucide-react";

export default function LeadPdfButton({ onClick, loading = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label="Download PDF"
      title="Download PDF"
      className="flex h-10 w-10 items-center justify-center gap-1.5 rounded-full bg-white text-sm font-medium text-brand-800 shadow-sm transition hover:bg-brand-50 disabled:opacity-70 sm:h-auto sm:w-auto sm:px-3.5 sm:py-1.5"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
      {/* Phones: icon only, so the lead's name keeps its room in the panel header */}
      <span className="hidden sm:inline">Download</span>
    </button>
  );
}
