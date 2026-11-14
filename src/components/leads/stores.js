// The 12 King of Cards stores, by the branch id the spin wheel stores on each lead.
// Used to show a branch name even before the backend's Branches setup is in place.
// Names edited on the Branches page take priority over these.
// vendor: what the vendor rules give each store (RJ = Chamrajpet, Phodeo = rest of Bangalore,
// OHP = outside Bangalore). Only used if the backend doesn't send the branch's vendor yet.
export const STORES = {
  1: { id: 1, name: "Chamrajpet", code: "CHA-001", city: "Bangalore", vendor: "RJ" },
  2: { id: 2, name: "HSR Layout", code: "HSR 002", city: "Bangalore", vendor: "Phodeo" },
  3: { id: 3, name: "Hoodi(whitefield)", code: "Hoodi-003", city: "Bangalore", vendor: "Phodeo" },
  4: { id: 4, name: "Jayanagar", code: "JNG-004", city: "Bangalore", vendor: "Phodeo" },
  5: { id: 5, name: "Bommasandra", code: "BMSD-005", city: "Bangalore", vendor: "Phodeo" },
  6: { id: 6, name: "Sahakar Nagar", code: "SKN-006", city: "Bangalore", vendor: "Phodeo" },
  7: { id: 7, name: "Hyderabad - Kondhapur", code: "HYB-007", city: "Hyderabad", vendor: "OHP" },
  8: { id: 8, name: "Visakhapatnam", code: "VIZ-008", city: "Visakhapatnam", vendor: "OHP" },
  9: { id: 9, name: "Hubballi", code: "HUBL-009", city: "Hubballi", vendor: "OHP" },
  10: { id: 10, name: "Mysore", code: "MYS-010", city: "Mysore", vendor: "OHP" },
  11: { id: 11, name: "Chitradurga", code: "CTRD-011", city: "Chitradurga", vendor: "OHP" },
  12: { id: 12, name: "Banjara Hills Hyderabad", code: "BANJARA-009", city: "Hyderabad", vendor: "OHP" },
};

const norm = (v) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

// { id, name, code, city, vendor } for a branch id (or its slug, name or code),
// using the Branches page list first, then the 12 built-in stores
export function storeFor(branchId, branches = []) {
  if (branchId === null || branchId === undefined || branchId === "") return null;
  const key = String(branchId).trim();
  const k = norm(key);
  const fromList = branches.find((b) => String(b.id) === key) ?? branches.find((b) => [b.slug, b.name, b.code].some((x) => x && norm(x) === k));
  if (fromList) {
    const v = fromList.vendor ?? fromList.auto_vendor;
    return { id: fromList.id, name: fromList.name, code: fromList.code, city: fromList.city, vendor: v?.name ?? null };
  }
  const builtIn = STORES[Number(key)] ?? Object.values(STORES).find((s) => [s.name, s.code].some((x) => norm(x) === k));
  return builtIn ?? { id: key, name: /^\d+$/.test(key) ? `Branch #${key}` : key, code: null, city: null, vendor: null };
}