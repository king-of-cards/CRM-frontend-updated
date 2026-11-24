import { Star } from "lucide-react";

// onToggle null / missing: read-only (view-only logins) — shows the state, not clickable.
// note: why it's read-only (default "View only"); name: whose star ("Kraftyz"), added to the label;
// touch: a 44 px target on phones (32 px from sm up)
export default function HotLeadStar({ isHot, pending = false, onToggle, note = "View only", name = "", touch = false }) {
  const size = touch ? "h-11 w-11 sm:h-8 sm:w-8" : "h-8 w-8";
  const whose = name ? ` for ${name}` : "";
  if (!onToggle) {
    const state = isHot ? "Hot lead" : "Not a hot lead";
    return (
      <span
        role="img"
        aria-label={`${state}${whose} (${note.toLowerCase()})`}
        title={`${state}${whose} · ${note}`}
        className={`inline-flex ${size} shrink-0 items-center justify-center rounded-full text-amber-500`}
      >
        <Star size={17} fill={isHot ? "currentColor" : "none"} className={isHot ? "" : "opacity-40"} aria-hidden="true" />
      </span>
    );
  }
  const label = `${isHot ? "Remove hot lead" : "Mark as hot lead"}${whose}`;
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
      className={`inline-flex ${size} shrink-0 items-center justify-center rounded-full text-amber-500 transition hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-amber-500 disabled:cursor-wait disabled:opacity-60`}
    >
      <Star size={17} fill={isHot ? "currentColor" : "none"} aria-hidden="true" />
    </button>
  );
}
