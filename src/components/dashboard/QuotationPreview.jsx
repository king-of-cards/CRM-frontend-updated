import { useEffect, useRef, useState } from "react";
import { Download, FileText, LoaderCircle, X } from "lucide-react";
import { fetchQuotationDocument } from "../../api/leadActivity.js";
import { formatINR } from "../../utils/format.js";

function fileSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Shows a quotation file over everything else.
// `preview`: { leadId, leadName, quotationId, amount, document: { file_name, content_type, size } }
export default function QuotationPreview({ preview, onClose }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);
  const closeRef = useRef(null);
  const open = Boolean(preview);
  const doc = preview?.document;
  const isPdf = doc?.content_type === "application/pdf";
  const isImage = doc?.content_type?.startsWith("image/");

  // Load the file with the login token, then show it from a temporary browser URL
  useEffect(() => {
    if (!preview) return;
    let objectUrl = null;
    let ignore = false;
    setUrl(null);
    setError(null);
    fetchQuotationDocument(preview.leadId, preview.quotationId)
      .then((blob) => {
        if (ignore) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err) => {
        if (!ignore) setError(err.message || "Couldn't load the file.");
      });
    return () => {
      ignore = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [preview]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    // Capture phase: Esc closes the preview only, not the lead panel behind it
    function handleKey(e) {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-title"
        className="relative flex h-full max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
            <FileText className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="preview-title" className="truncate font-semibold text-gray-900">
              {doc.file_name}
            </h2>
            <p className="truncate text-sm text-gray-500">
              {[preview.leadName, preview.amount != null && formatINR(preview.amount), fileSize(doc.size)]
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
          {url && (
            <a
              href={url}
              download={doc.file_name}
              className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold text-brand-700 ring-1 ring-gray-200 transition-colors hover:bg-brand-50"
            >
              <Download className="size-4" aria-hidden="true" />
              Download
            </a>
          )}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center bg-gray-100">
          {error ? (
            <p className="px-6 text-center text-gray-700">{error}</p>
          ) : !url ? (
            <p className="flex items-center gap-2 text-gray-500">
              <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
              Loading file…
            </p>
          ) : isPdf ? (
            <iframe src={url} title={doc.file_name} className="size-full border-0 bg-white" />
          ) : isImage ? (
            <img src={url} alt={`Quotation: ${doc.file_name}`} className="max-h-full max-w-full object-contain p-4" />
          ) : (
            <div className="px-6 text-center">
              <p className="text-gray-800">Word and Excel files can't be shown here.</p>
              <a href={url} download={doc.file_name} className="mt-2 inline-block font-medium text-brand-700 hover:underline">
                Download {doc.file_name}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}