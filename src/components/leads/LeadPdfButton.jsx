import { Download, Loader2 } from "lucide-react";

export default function LeadPdfButton({ onClick, loading = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-medium text-brand-800 shadow-sm transition hover:bg-brand-50 disabled:opacity-70"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
      Download
    </button>
  );
}
