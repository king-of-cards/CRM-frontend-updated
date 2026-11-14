import DashboardLayout from "../components/layout/DashboardLayout.jsx";

// A top-bar tab page that shows one lead source in full.
export default function LeadSourcePage({ title, description, children }) {
  return (
    <DashboardLayout title={title} description={description}>
      {children}
    </DashboardLayout>
  );
}
