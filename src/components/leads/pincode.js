// Rough location from an Indian pincode (its first 3 digits = the sorting district).
// Good enough to show "Bangalore" or "Visakhapatnam" next to a pincode; not an exact address.
const AREAS = {
  // Karnataka
  560: "Bangalore", 561: "Bangalore Rural", 562: "Bangalore Rural", 563: "Kolar", 570: "Mysore", 571: "Mysore",
  572: "Tumkur", 573: "Hassan", 574: "Dakshina Kannada", 575: "Mangalore", 576: "Udupi", 577: "Shimoga / Chitradurga",
  580: "Hubballi-Dharwad", 581: "Uttara Kannada / Haveri", 582: "Gadag", 583: "Ballari", 584: "Raichur",
  585: "Kalaburagi / Bidar", 586: "Vijayapura", 587: "Bagalkot", 590: "Belagavi", 591: "Belagavi",
  // Telangana
  500: "Hyderabad", 501: "Ranga Reddy", 502: "Sangareddy / Medak", 503: "Nizamabad", 504: "Adilabad",
  505: "Karimnagar", 506: "Warangal", 507: "Khammam", 508: "Nalgonda", 509: "Mahabubnagar",
  // Andhra Pradesh
  515: "Anantapur", 516: "Kadapa", 517: "Chittoor / Tirupati", 518: "Kurnool", 520: "Vijayawada", 521: "Krishna",
  522: "Guntur", 523: "Prakasam", 524: "Nellore", 530: "Visakhapatnam", 531: "Visakhapatnam", 532: "Srikakulam",
  533: "East Godavari", 534: "West Godavari", 535: "Vizianagaram",
  // Tamil Nadu, Kerala and big cities elsewhere
  600: "Chennai", 601: "Chennai region", 603: "Chengalpattu", 625: "Madurai", 641: "Coimbatore", 620: "Tiruchirappalli",
  682: "Kochi", 695: "Thiruvananthapuram", 673: "Kozhikode", 400: "Mumbai", 411: "Pune", 110: "Delhi",
  700: "Kolkata", 380: "Ahmedabad", 302: "Jaipur", 226: "Lucknow", 201: "Noida / Ghaziabad", 122: "Gurugram",
};

export function pincodeArea(pincode) {
  const digits = String(pincode ?? "").replace(/\D/g, "");
  if (digits.length !== 6) return null;
  return AREAS[Number(digits.slice(0, 3))] ?? null;
}