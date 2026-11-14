import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

// The picture panel next to the form:
//  - the cards image fills the background, under a translucent colour layer
//  - a stack of framed photos: every few seconds the next one drops onto the top
//  - the cursive heading and text below
//
// The photos live in the public/ folder. List them by file name WITHOUT the extension:
// .jpg, .jpeg, .png and .webp are all tried, so it works whatever format each file is.
// They appear in this order. A photo that can't be found is skipped automatically.
const PHOTOS = [
  {
    name: "auth-wedding",
    alt: "Bride and groom exchanging garlands at their wedding",
  },
  {
    name: "auth-folio",
    alt: "Folio-style wedding invitation with a peach rose",
  },
  { name: "auth-mehendi", alt: "Bride's hands decorated with mehendi" },
  { name: "auth-wax-seal", alt: "Invitation envelope closed with a wax seal" },
  {
    name: "auth-caraousal",
    alt: "Cream invitation card styled with soft fabric",
  },
];

const BACKGROUND = "auth-cards"; // the cards image behind everything
const EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

const SLIDE_MS = 4000; // time each photo stays on top

// Where each print sits, by how far it is from the current one (0 = on top)
const STACK = [
  "z-30 opacity-100 [transform:translate(0,0)_rotate(-3deg)_scale(1)]",
  "z-20 opacity-100 [transform:translate(18px,8px)_rotate(5deg)_scale(0.96)] brightness-90",
  "z-10 opacity-90 [transform:translate(-16px,12px)_rotate(-9deg)_scale(0.92)] brightness-75",
];
// Waiting prints: invisible, above the stack, so the next one "drops" in
const WAITING =
  "z-0 opacity-0 [transform:translate(40px,-60px)_rotate(14deg)_scale(1.06)]";

// <img> that tries each extension in turn; calls onMissing (or hides itself) if none exist
function SmartImage({ name, onMissing, ...props }) {
  const [attempt, setAttempt] = useState(0);
  if (attempt >= EXTENSIONS.length) return null;
  return (
    <img
      {...props}
      src={`/${name}${EXTENSIONS[attempt]}`}
      onError={() => {
        if (attempt + 1 >= EXTENSIONS.length) onMissing?.();
        setAttempt((a) => a + 1);
      }}
    />
  );
}

export default function InfoPanel({
  title,
  text,
  actionLabel,
  actionTo,
  background = BACKGROUND,
  photos = PHOTOS,
}) {
  const [broken, setBroken] = useState(() => new Set());
  const list = useMemo(
    () => photos.filter((p) => !broken.has(p.name)),
    [photos, broken],
  );
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  // Advance to the next photo on a timer (paused while hovered or focused)
  useEffect(() => {
    if (paused || list.length < 2) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const t = setTimeout(
      () => setCurrent((c) => (c + 1) % list.length),
      reduceMotion ? SLIDE_MS * 1.5 : SLIDE_MS,
    );
    return () => clearTimeout(t);
  }, [current, paused, list.length]);

  // Keep the index valid if a photo failed to load
  const top = list.length ? current % list.length : 0;

  return (
    <aside className="relative h-full overflow-hidden bg-brand-700">
      {/* 1. Cards image (background) */}
      <SmartImage
        name={background}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* 2. Translucent colour layer */}
      <div
        aria-hidden="true"
        className="absolute inset-0 scale-125 opacity-50 blur-3xl"
      >
        <div className="absolute left-[12%] top-[8%] h-64 w-40 rotate-12 rounded-full bg-orange-500/70" />
        <div className="absolute left-[38%] top-[28%] h-72 w-56 -rotate-12 rounded-full bg-red-600/60" />
        <div className="absolute bottom-[4%] right-[4%] h-48 w-48 rounded-full bg-teal-300/40" />
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-b from-brand-800/40 via-brand-800/35 to-brand-800/80"
      />

      {/* 3. Photo stack + text */}
      <div className="relative flex h-full flex-col items-center justify-center gap-10 px-10 py-12 text-center text-white">
        {list.length > 0 && (
          <div
            className="animate-photo-in motion-reduce:animate-none"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
          >
            <div
              className="relative h-[320px] w-[240px] lg:h-[380px] lg:w-[280px]"
              role="region"
              aria-roledescription="carousel"
              aria-label="Photos"
            >
              {list.map((p, i) => {
                const offset = (top - i + list.length) % list.length; // 0 = on top, 1 = just behind…
                const place = offset < STACK.length ? STACK[offset] : WAITING;
                return (
                  <figure
                    key={p.name}
                    aria-hidden={offset !== 0}
                    className={`absolute inset-0 rounded-3xl bg-white p-2.5 shadow-2xl shadow-black/40 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${place}`}
                  >
                    <SmartImage
                      name={p.name}
                      alt={p.alt}
                      className="h-full w-full rounded-2xl object-cover"
                      onMissing={() => setBroken((b) => new Set(b).add(p.name))}
                    />
                  </figure>
                );
              })}
            </div>

            {/* Dots: jump to a photo */}
            {list.length > 1 && (
              <div className="mt-8 flex justify-center gap-2">
                {list.map((p, i) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setCurrent(i)}
                    aria-label={`Show photo ${i + 1} of ${list.length}`}
                    aria-current={i === top ? "true" : undefined}
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      i === top
                        ? "w-6 bg-white"
                        : "w-1.5 bg-white/50 hover:bg-white/80"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <h2 className="font-script text-5xl font-bold leading-tight drop-shadow-lg animate-write motion-reduce:animate-none lg:text-6xl">
            {title}
          </h2>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-white/90 drop-shadow animate-fade-up motion-reduce:animate-none">
            {text}
          </p>
          {actionLabel && actionTo && (
            <Link
              to={actionTo}
              className="mt-8 inline-block rounded-full border border-white px-10 py-2.5 text-sm font-semibold backdrop-blur-sm transition-colors animate-fade-up hover:bg-white hover:text-brand-700 motion-reduce:animate-none"
            >
              {actionLabel}
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}
