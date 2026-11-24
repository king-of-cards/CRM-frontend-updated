import { Link } from "react-router";
import ContactActions from "../shared/ContactActions.jsx";
import { entryPhones, leadLink } from "../../pages/kocToDhruvaUtils.js";

// A compact list of KOC → Dhruva leads for the dashboard (upcoming, stale, latest): the name (opens
// the lead on the list), a detail line, a value on the right, and below them the contact buttons:
// Call, WhatsApp and Copy for each number, Email and Copy email once (docs section 18, "Contact
// details"). Missing phone or email: those buttons aren't shown. The buttons sit beside the link,
// never inside it, and stop their clicks, so they never open the lead. They wrap on a phone.

function LeadName({ lead }) {
  return (
    <Link to={leadLink(lead)} className="break-words font-medium text-gray-900 hover:text-brand-700 hover:underline">
      {lead.name || "Unnamed lead"}
    </Link>
  );
}

export default function KocToDhruvaLeadList({ leads, detail, right, none }) {
  if (!leads.length) return <p className="text-sm text-gray-500">{none}</p>;
  return (
    <ul className="divide-y divide-gray-100">
      {leads.map((l) => {
        const phones = entryPhones(l);
        return (
          <li key={l.lead_key} className="min-w-0 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <LeadName lead={l} />
                <span className="block truncate text-xs text-gray-500">{detail(l)}</span>
              </span>
              <span className="shrink-0 text-right text-sm tabular-nums text-gray-900">{right(l)}</span>
            </div>
            <ContactActions phones={phones} email={l.email} name={l.name} showNumber={phones.length > 0} className="mt-1.5" />
          </li>
        );
      })}
    </ul>
  );
}
