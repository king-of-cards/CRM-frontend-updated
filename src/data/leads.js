// Sample data so the dashboard has something to show.
// Replace with data from the Spring Boot API later.

// Commission is only counted on converted leads.
// KOC -> Vendors: KOC sends the lead, so the vendor pays KOC (commission earned).
// Vendors -> KOC: the vendor sends the lead, so KOC pays the vendor (commission payable).
export const DIRECTIONS = [
  {
    id: "koc-to-vendor",
    from: "KOC",
    to: "Vendors",
    hint: "Leads we pass on to vendors",
    commissionLabel: "Commission earned",
    commissionHint: "Vendors pay KOC",
  },
  {
    id: "vendor-to-koc",
    from: "Vendors",
    to: "KOC",
    hint: "Leads vendors pass on to us",
    commissionLabel: "Commission payable",
    commissionHint: "KOC pays vendors",
  },
];

export const SERVICES = [
  { id: "photography", label: "Photography" },
  { id: "holiday-travel", label: "Holiday & travel" },
  { id: "makeup", label: "Make-up artist" },
  { id: "wedding-planner", label: "Wedding planner" },
  { id: "gift-hampers", label: "Gift hampers" },
];

// commissionRate: % of the quotation amount, agreed with each vendor.
export const VENDORS = [
  { id: "v1", name: "Lens & Light Studio", service: "photography", commissionRate: 10 },
  { id: "v2", name: "Candid Frames", service: "photography", commissionRate: 10 },
  { id: "v3", name: "Wanderway Holidays", service: "holiday-travel", commissionRate: 8 },
  { id: "v4", name: "Skyline Tours", service: "holiday-travel", commissionRate: 8 },
  { id: "v5", name: "Glow by Ananya", service: "makeup", commissionRate: 12 },
  { id: "v6", name: "Bridal Blush", service: "makeup", commissionRate: 12 },
  { id: "v7", name: "Shubh Vivah Planners", service: "wedding-planner", commissionRate: 10 },
  { id: "v8", name: "Mandap Stories", service: "wedding-planner", commissionRate: 10 },
  { id: "v9", name: "The Hamper Co.", service: "gift-hampers", commissionRate: 15 },
  { id: "v10", name: "Mithaas Gifting", service: "gift-hampers", commissionRate: 15 },
];

export const SOURCES = [
  { id: "website", label: "Website" },
  { id: "instagram", label: "Instagram" },
  { id: "referral", label: "Referral" },
  { id: "vendor-referral", label: "Vendor referral" },
  { id: "walk-in", label: "Walk-in" },
  { id: "trade-show", label: "Trade show" },
];

export const STATUSES = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "qualified", label: "Qualified" },
  { id: "quotation-sent", label: "Quotation sent" },
  { id: "converted", label: "Converted" },
  { id: "not-interested", label: "Not interested" },
];

// quotation: amount quoted to the customer (null until a quotation is sent).
// Revenue and commission are worked out from the quotation of converted leads.
export const LEADS = [
  { id: 1, name: "Aarav Mehta", company: "Mehta Traders", phone: "+91 98201 45678", email: "aarav.mehta@gmail.com", direction: "koc-to-vendor", service: "photography", vendorId: "v1", source: "website", status: "new", quotation: null, added: "2 hours ago" },
  { id: 2, name: "Priya Shah", company: "Shah Prints", phone: "+91 99300 12874", email: "priya@shahprints.in", direction: "koc-to-vendor", service: "wedding-planner", vendorId: "v7", source: "referral", status: "contacted", quotation: null, added: "Yesterday" },
  { id: 3, name: "Rohan Kapoor", company: "Kapoor & Sons", phone: "+91 98670 33021", email: "rohan@kapoorandsons.com", direction: "koc-to-vendor", service: "holiday-travel", vendorId: "v3", source: "trade-show", status: "converted", quotation: 260000, added: "9 Nov" },
  { id: 4, name: "Neha Joshi", company: "Joshi Events", phone: "+91 97690 55410", email: "neha.joshi@outlook.com", direction: "koc-to-vendor", service: "makeup", vendorId: "v5", source: "instagram", status: "qualified", quotation: null, added: "8 Nov" },
  { id: 5, name: "Vikram Rao", company: "Rao Hospitality", phone: "+91 98190 77215", email: "vikram@raohospitality.in", direction: "koc-to-vendor", service: "gift-hampers", vendorId: "v9", source: "walk-in", status: "not-interested", quotation: 195000, added: "7 Nov" },
  { id: 6, name: "Isha Kulkarni", company: "Kulkarni Family", phone: "+91 90040 61938", email: "isha.kulkarni@gmail.com", direction: "koc-to-vendor", service: "wedding-planner", vendorId: "v8", source: "referral", status: "quotation-sent", quotation: 320000, added: "6 Nov" },
  { id: 7, name: "Kabir Malhotra", company: "Malhotra Realty", phone: "+91 98330 20457", email: "kabir@malhotrarealty.com", direction: "koc-to-vendor", service: "gift-hampers", vendorId: "v10", source: "website", status: "converted", quotation: 72000, added: "5 Nov" },
  { id: 8, name: "Sneha Iyer", company: "Iyer Family", phone: "+91 99870 41123", email: "sneha.iyer@gmail.com", direction: "vendor-to-koc", service: "photography", vendorId: "v2", source: "vendor-referral", status: "contacted", quotation: null, added: "3 hours ago" },
  { id: 9, name: "Arjun Nair", company: "Nair Exports", phone: "+91 98925 66780", email: "arjun@nairexports.com", direction: "vendor-to-koc", service: "holiday-travel", vendorId: "v4", source: "vendor-referral", status: "quotation-sent", quotation: 410000, added: "Yesterday" },
  { id: 10, name: "Meera Pillai", company: "Pillai Weddings", phone: "+91 97730 18842", email: "meera.pillai@yahoo.com", direction: "vendor-to-koc", service: "makeup", vendorId: "v6", source: "instagram", status: "converted", quotation: 38000, added: "9 Nov" },
  { id: 11, name: "Dev Khanna", company: "Khanna Group", phone: "+91 98111 90364", email: "dev@khannagroup.in", direction: "vendor-to-koc", service: "wedding-planner", vendorId: "v7", source: "vendor-referral", status: "qualified", quotation: null, added: "8 Nov" },
  { id: 12, name: "Tanvi Desai", company: "Desai Foods", phone: "+91 99200 53617", email: "tanvi@desaifoods.com", direction: "vendor-to-koc", service: "gift-hampers", vendorId: "v9", source: "vendor-referral", status: "not-interested", quotation: null, added: "6 Nov" },
  { id: 13, name: "Riya Sen", company: "Sen & Co.", phone: "+91 98204 72290", email: "riya.sen@senandco.com", direction: "vendor-to-koc", service: "photography", vendorId: "v1", source: "website", status: "converted", quotation: 120000, added: "4 Nov" },
];

// Builds the starting timeline for a sample lead from its current details.
// New events (status changes, quotations, notes) are added from the lead panel.
export function withTimeline(lead) {
  const statusLabel = STATUSES.find((s) => s.id === lead.status)?.label ?? lead.status;
  const timeline = [{ id: `${lead.id}-added`, type: "added", text: "Lead added", when: lead.added }];
  if (lead.quotation != null) {
    timeline.push({
      id: `${lead.id}-quotation`,
      type: "quotation",
      text: `Quotation sent: ₹${lead.quotation.toLocaleString("en-IN")}`,
      when: lead.added,
    });
  }
  if (lead.status !== "new") {
    timeline.push({ id: `${lead.id}-status`, type: "status", text: `Status set to ${statusLabel}`, when: lead.added });
  }
  return { ...lead, timeline };
}