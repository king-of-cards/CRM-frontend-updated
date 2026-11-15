import DashboardLayout from "../components/layout/DashboardLayout.jsx";
import NotLinkedVendor from "../components/leads/NotLinkedVendor.jsx";
import { useAuth } from "../auth/useAuth.js";

// A top-bar tab page that shows one lead source in full.
export default function LeadSourcePage({ title, description, children }) {
  const { isVendor, vendor } = useAuth();
  return (
    <DashboardLayout title={title} description={description}>
      {isVendor && !vendor ? <NotLinkedVendor /> : children}
    </DashboardLayout>
  );
}
