import { Link } from "react-router";

// The panel next to the form: your cards image at the back, a translucent
// colour layer over it, then the heading and text on top (the button is optional).
// Put your image in the project's public/ folder as auth-cards.jpg,
// or pass a different path with the `image` prop.
export default function InfoPanel({
  title,
  text,
  actionLabel,
  actionTo,
  image = "/auth-cards.jpg",
}) {
  return (
    <aside className="relative h-full overflow-hidden bg-brand-700">
      {/* 1. The cards image */}
      <img
        src={image}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />

      {/* 2. Translucent colour layer, so the image shows through */}
      <div
        aria-hidden="true"
        className="absolute inset-0 scale-125 opacity-50 blur-3xl"
      >
        <div className="absolute left-[12%] top-[8%] h-64 w-40 rotate-12 rounded-full bg-orange-500/70" />
        <div className="absolute left-[38%] top-[28%] h-72 w-56 -rotate-12 rounded-full bg-red-600/60" />
        <div className="absolute bottom-[4%] right-[4%] h-48 w-48 rounded-full bg-teal-300/40" />
      </div>
      <div aria-hidden="true" className="absolute inset-0 bg-brand-800/45" />

      {/* 3. Text and button */}
      <div className="relative flex h-full flex-col items-center justify-center px-10 text-center text-white">
        <h2 className="font-script text-5xl font-bold leading-tight drop-shadow-lg animate-write motion-reduce:animate-none lg:text-6xl">
          {title}
        </h2>
        <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/90 drop-shadow animate-fade-up motion-reduce:animate-none">
          {text}
        </p>
        {actionLabel && actionTo && (
          <Link
            to={actionTo}
            className="mt-8 rounded-full border border-white px-10 py-2.5 text-sm font-semibold backdrop-blur-sm animate-fade-up motion-reduce:animate-none transition-colors hover:bg-white hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {actionLabel}
          </Link>
        )}
      </div>
    </aside>
  );
}
