// Two-column card: the form on one side, the colour panel on the other.
// panelSide="right" puts the panel on the right (as on the Login page), "left" swaps the sides.
export default function AuthLayout({ panel, panelSide = "right", children }) {
  const panelLeft = panelSide === "left";

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-50 p-4 sm:p-8">
      <div className="w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-xl shadow-brand-800/10 md:grid md:min-h-[540px] md:grid-cols-2">
        <section
          className={`flex items-center justify-center px-6 py-12 sm:px-12 ${
            panelLeft ? "md:order-2" : ""
          }`}
        >
          <div className="w-full max-w-sm">{children}</div>
        </section>

        <div className={`hidden md:block ${panelLeft ? "md:order-1" : ""}`}>
          {panel}
        </div>
      </div>
    </main>
  );
}
