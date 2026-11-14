// How the dashboard reads leads from GET /api/v1/spin-leads.
// Edit this file to rearrange the table; no other file needs to change.

// Which backend column holds each piece of lead information.
// The first name that exists in the response's "columns" list is used,
// so put your real column names first. JSON fields look like "additional_details.<key>".
export const FIELD_CANDIDATES = {
  id: ["id", "lead_id"],
  name: ["name", "full_name", "customer_name", "additional_details.name"],
  phone: ["phone", "mobile", "phone_number", "contact_number", "additional_details.phone"],
  email: ["email", "email_id", "additional_details.email"],
  service: ["service", "additional_details.service", "additional_details.otherWeddingServices"],
  vendor: ["vendor", "vendor_name", "additional_details.vendor"],
  source: ["source", "lead_source", "utm_source", "additional_details.source"],
  status: ["status", "lead_status"],
  quotation: ["quotation", "quotation_amount", "additional_details.quotation"],
  created: ["created_at", "createdAt", "submitted_at"],
};

// Table columns, left to right. Reorder, remove or add lines to arrange the table.
// `field` is one of: name, phone, email, service, vendor, source, status, quotation, added,
// or a backend column. Backend names are matched loosely, so "pincode" finds "pincode",
// "pin_code" or "additional_details.pinCode".
// `width` is in rem (1rem = 16px). `format` can be "date" or "datetime".
// Every column not used here still appears in the lead panel under "More details".
export const TABLE_COLUMNS = [
  { label: "Name", field: "name", width: 15 },
  { label: "Phone", field: "phone", width: 10 },
  { label: "Email", field: "email", width: 15 },
  { label: "Service", field: "service", width: 12 },
  { label: "Status", field: "status", width: 10 },
  { label: "Quotation", field: "quotation", width: 8.5, align: "right" },
  { label: "Other wedding services", field: "otherWeddingServices", width: 14 },
  { label: "Pincode", field: "pincode", width: 7 },
  { label: "Occasion type", field: "occasionType", width: 9 },
  { label: "Occasion date", field: "occasionDate", width: 9, format: "date" },
  { label: "Bride groom name", field: "brideGroomName", width: 13 },
  { label: "Bride groom phone", field: "brideGroomPhone", width: 10 },
  { label: "Estimated budget per card", field: "estimatedBudgetPerCard", width: 9 },
  { label: "Quantity required", field: "quantityRequired", width: 8, align: "right" },
  { label: "Campaign ID", field: "campaignId", width: 9 },
  { label: "Consent at", field: "consentAt", width: 10.5, format: "datetime" },
  { label: "Customer ID", field: "customerId", width: 9 },
  { label: "Occasion", field: "occasion", width: 9 },
  { label: "Branch ID", field: "branchId", width: 8 },
];

// Leads shown per page in the table. All leads are loaded once, so filters,
// search and the date range cover every lead, not just one page.
export const PAGE_SIZE = 50;export const SERVICE_RENAMES = { "Wedding Decor": "Wedding Planner" };
export const HIDDEN_SERVICES = ["Wedding Cards"];
export const SOURCE_OPTIONS = ["Spin the wheel", "Photography page", "Event page", "Wedding planner page", "International", "Instagram"];
