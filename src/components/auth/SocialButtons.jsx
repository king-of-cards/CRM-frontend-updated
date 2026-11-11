// Round social sign-in buttons. The letters are placeholders:
// swap in each platform's official icon (from its brand resources) when you wire these up.
const providers = [
  { id: "facebook", label: "Facebook", short: "f" },
  { id: "google", label: "Google", short: "G" },
  { id: "instagram", label: "Instagram", short: "IG" },
  { id: "linkedin", label: "LinkedIn", short: "in" },
];

export default function SocialButtons({ onSelect }) {
  return (
    <div className="flex justify-center gap-3">
      {providers.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onSelect?.(p.id)}
          aria-label={`Continue with ${p.label}`}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-200 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {p.short}
        </button>
      ))}
    </div>
  );
}
