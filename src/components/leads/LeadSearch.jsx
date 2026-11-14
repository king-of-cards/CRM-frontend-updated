import { useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";

// Search box with live suggestions of matching leads. Typing filters the table (as before);
// the dropdown shows the best matches, and picking one opens that lead.
//
// fetchSuggestions(q) -> Promise<[{ key, title, subtitle, meta }]>
// onPick(suggestion)
export default function LeadSearch({
  value,
  onChange,
  fetchSuggestions,
  onPick,
  placeholder = "Search leads…",
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef(null);
  const query = value.trim();

  // Suggestions, a moment after typing pauses
  useEffect(() => {
    if (query.length < 2) {
      setItems([]);
      return;
    }
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      fetchSuggestions(query)
        .then((r) => alive && setItems(r))
        .catch(() => alive && setItems([]))
        .finally(() => alive && setLoading(false));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => setActive(-1), [items]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) =>
      box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const choose = (s) => {
    setOpen(false);
    onPick(s);
  };

  // Bold the part that matches
  const mark = (text) => {
    const str = String(text ?? "");
    const i = str.toLowerCase().indexOf(query.toLowerCase());
    if (!query || i < 0) return str;
    return (
      <>
        {str.slice(0, i)}
        <mark className="rounded bg-amber-100 px-0.5 text-inherit">
          {str.slice(i, i + query.length)}
        </mark>
        {str.slice(i + query.length)}
      </>
    );
  };

  const showList = open && query.length >= 2;

  return (
    <div ref={box} className="relative w-full sm:w-80">
      <Search
        size={16}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
        aria-hidden="true"
      />
      <input
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-label={placeholder}
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, items.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, -1));
          } else if (e.key === "Enter") {
            if (active >= 0 && items[active]) choose(items[active]);
            else setOpen(false); // keep the typed text as the table filter
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        className="w-full rounded-full border border-gray-200 bg-white py-2 pl-10 pr-9 text-sm outline-none transition placeholder:text-gray-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <X size={14} />
        </button>
      )}

      {showList && (
        <div className="absolute right-0 z-30 mt-2 w-full min-w-[340px] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-gray-100">
          <p className="flex items-center justify-between border-b border-gray-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Matching leads
            {loading && <Loader2 size={13} className="animate-spin" />}
          </p>
          <ul role="listbox" className="max-h-80 overflow-y-auto p-1.5">
            {items.map((s, i) => (
              <li key={s.key} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(s)}
                  className={`w-full rounded-xl px-3 py-2.5 text-left transition ${i === active ? "bg-brand-50" : "hover:bg-gray-50"}`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-semibold text-gray-900">
                      {mark(s.title)}
                    </span>
                    {s.meta && (
                      <span className="shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800">
                        {s.meta}
                      </span>
                    )}
                  </span>
                  {s.subtitle && (
                    <span className="mt-0.5 block truncate text-xs text-gray-500">
                      {mark(s.subtitle)}
                    </span>
                  )}
                </button>
              </li>
            ))}
            {!loading && !items.length && (
              <li className="px-3 py-4 text-sm text-gray-500">
                No leads match “{query}”.
              </li>
            )}
          </ul>
          <p className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-[11px] text-gray-500">
            Pick a lead to open it · press Enter to filter the table
          </p>
        </div>
      )}
    </div>
  );
}
