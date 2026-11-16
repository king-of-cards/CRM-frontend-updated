// withCrm: put a saved CRM object back into a list answer's rows (by lead key), so the row
// updates without reloading the list.
export function withCrm(data, leadKey, crm) {
  if (!data) return data;
  return {
    ...data,
    items: data.items.map((i) =>
      i.crm?.lead_key === leadKey ? { ...i, crm } : i,
    ),
  };
}
