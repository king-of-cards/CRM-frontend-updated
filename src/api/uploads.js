import {
  downloadCrmLeadTemplate,
  getCrmLeadFields,
  getCrmLeadTemplateHeaders,
  importCrmLeads,
  previewCrmLeadImport,
} from "./crmLeads.js";
import {
  downloadKocToDhruvaTemplate,
  getKocToDhruvaTemplateHeaders,
  importKocToDhruvaLeads,
  previewKocToDhruvaImport,
} from "./kocToDhruva.js";

// The bulk upload's calls for one source. The four KOC → Vendors sources use
// /crm-leads/{source}/… (unchanged); KOC → Dhruva uses /koc-to-dhruva/leads/… (docs section 18).
// KOC → Dhruva has no fields endpoint: fields() borrows Spin's (its rows are Spin's fields, and
// Spin's answer carries the branch list), and the dialog adds the columns the preview names.
export const KOC_TO_DHRUVA_SOURCE = "koc_to_dhruva";

export function uploadApi(source) {
  if (source === KOC_TO_DHRUVA_SOURCE) {
    return {
      fields: () => getCrmLeadFields("spin"),
      templateHeaders: () => getKocToDhruvaTemplateHeaders(),
      template: (format) => downloadKocToDhruvaTemplate(format),
      preview: (file, sheetName) => previewKocToDhruvaImport(file, sheetName),
      importRows: (rows) => importKocToDhruvaLeads(rows),
    };
  }
  return {
    fields: () => getCrmLeadFields(source),
    templateHeaders: () => getCrmLeadTemplateHeaders(source),
    template: (format) => downloadCrmLeadTemplate(source, format),
    preview: (file, sheetName) => previewCrmLeadImport(source, file, sheetName),
    importRows: (rows) => importCrmLeads(source, rows),
  };
}
