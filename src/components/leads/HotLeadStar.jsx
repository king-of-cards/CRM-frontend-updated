import { Star } from "lucide-react";

export default function HotLeadStar({ isHot, pending = false, onToggle }) {
  const label = isHot ? "Remove hot lead" : "Mark as hot lead";
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={Boolean(isHot)}
      title={label}
      disabled={pending}
      onClick={(event) => {
        event.stopPropagation();
        onToggle?.();
      }}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-amber-500 transition hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-amber-500 disabled:cursor-wait disabled:opacity-60"
    >
      <Star size={17} fill={isHot ? "currentColor" : "none"} aria-hidden="true" />
    </button>
  );
}
