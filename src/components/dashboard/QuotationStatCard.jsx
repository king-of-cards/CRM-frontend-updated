import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import StatCard from "./StatCard.jsx";
import { QUOTATIONS_CHANGED, getQuotationStats } from "../../api/leadActivity.js";
import { formatINR } from "../../utils/format.js";

// "Quotations sent" KPI: how many quotations have been sent and their total amount.
// Real numbers from the backend; refreshes whenever a quotation is added, changed or deleted.
export default function QuotationStatCard() {
  const [stats, setStats] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let ignore = false;
    function load() {
      getQuotationStats()
        .then((data) => {
          if (ignore) return;
          setStats(data);
          setFailed(false);
        })
        .catch(() => {
          if (!ignore) setFailed(true);
        });
    }
    load();
    window.addEventListener(QUOTATIONS_CHANGED, load);
    return () => {
      ignore = true;
      window.removeEventListener(QUOTATIONS_CHANGED, load);
    };
  }, []);

  return (
    <StatCard
      label="Quotations sent"
      value={stats ? stats.count.toLocaleString("en-IN") : failed ? "—" : "…"}
      note={
        stats
          ? `${formatINR(stats.total)} quoted in total`
          : failed
            ? "Couldn't load quotation totals"
            : "Loading…"
      }
      icon={FileText}
      tint="bg-violet-50 text-violet-600"
    />
  );
}