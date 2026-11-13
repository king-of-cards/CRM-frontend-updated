// Two-column card: the form on one side, the picture panel on the other.
// panelSide="right" puts the panel on the right (as on the Login page), "left" swaps the sides.
export default function AuthLayout({ panel, panelSide = "right", children }) {
  const panelLeft = panelSide === "left";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white p-4 sm:p-8">
      {/* Soft background glow */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-brand-100/70 blur-3xl" />
        <div className="absolute -bottom-48 -right-32 h-[32rem] w-[32rem] rounded-full bg-rose-100/60 blur-3xl" />
      </div>

      <div className="relative w-full max-w-6xl overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-brand-800/15 ring-1 ring-gray-100 md:grid md:min-h-[680px] md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <section
          className={`flex items-center justify-center px-6 py-12 sm:px-14 ${panelLeft ? "md:order-2" : ""}`}
        >
          <div className="w-full max-w-md">{children}</div>
        </section>

        <div className={`hidden md:block ${panelLeft ? "md:order-1" : ""}`}>
          {panel}
        </div>
      </div>
    </main>
  );
}
