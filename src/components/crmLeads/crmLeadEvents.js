// Row actions (edit, archive) are asked for from the row's badge, but handled by the page's
// CrmLeadActions: that one stays on screen while the list reloads (an archived row disappears,
// and its "Undo" message must stay).
//   { type: "edit", source, leadKey }
//   { type: "archive", source, leadKey }

const listeners = new Set();

export function onCrmLeadEvent(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitCrmLeadEvent(event) {
  for (const listener of listeners) listener(event);
}
