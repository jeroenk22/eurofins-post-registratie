export interface MestklantOption {
  label: string; // dropdown + print op standaard/grote etiketten
  labelShort: string; // print op kleine etiketten (smaller dan standaard formaat)
  tms: string; // TMS-omschrijving voor webhook
}

export const MESTKLANT_OPTIONS: MestklantOption[] = [
  { label: "Eijkelkamp deksels", labelShort: "Deksels", tms: "Doos deksels" },
  {
    label: "D-Tech (KLEINE DOOS)",
    labelShort: "D-Tech (KLEINE DOOS)",
    tms: "Doosje sealrollen",
  },
  {
    label: "D-Tech (GROTE DOOS)",
    labelShort: "D-Tech (GROTE DOOS)",
    tms: "Grote doos sealrollen (10 doosjes)",
  },
  {
    label: "Vaste mestzakken (50st)",
    labelShort: "Vaste mestzakken (50st)",
    tms: "Setje vaste mestzakken (50 stuks)",
  },
  {
    label: "Vaste mestzakken (500st)",
    labelShort: "Vaste mestzakken (500st)",
    tms: "Grote doos vaste mestzakken (500 stuks)",
  },
];

/** Lookup: label → TMS-omschrijving (voor webhook) */
export const MESTKLANT_TMS_BY_LABEL: Record<string, string> =
  Object.fromEntries(MESTKLANT_OPTIONS.map((o) => [o.label, o.tms]));

/** Lookup: label → kort label (voor kleine etiketten) */
export const MESTKLANT_SHORT_BY_LABEL: Record<string, string> =
  Object.fromEntries(MESTKLANT_OPTIONS.map((o) => [o.label, o.labelShort]));
