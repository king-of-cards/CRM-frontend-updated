import DashboardLayout from "../components/layout/DashboardLayout.jsx";
import NotLinkedVendor from "../components/leads/NotLinkedVendor.jsx";
import { useAuth } from "../auth/useAuth.js";
import { flowLabels } from "../components/layout/leadFlow.js";

// A top-bar tab page that shows one lead source in full. flowTitle ("vendors"): a flow page whose
// title a vendor login reads with its vendor's name ("Kraftyz → KOC").
export default function LeadSourcePage({ title, flowTitle, description, children }) {
  const { isVendor, vendor } = useAuth();
  const shown = flowTitle ? flowLabels(isVendor ? vendor : null)[flowTitle] ?? title : title;
  return (
    <DashboardLayout title={shown} description={description}>
      {isVendor && !vendor ? <NotLinkedVendor /> : children}
    </DashboardLayout>
  );
}
