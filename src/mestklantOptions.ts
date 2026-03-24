export interface MestklantOption {
  label: string  // hun beschrijving — getoond in dropdown en op printlabel
  tms: string    // onze TMS-omschrijving — verstuurd via webhook
}

export const MESTKLANT_OPTIONS: MestklantOption[] = [
  { label: 'Eijkelkamp deksels',          tms: 'Doos deksels' },
  { label: 'D-Tech Mestzakken-KLEINE DOOS', tms: 'Doosje sealrollen' },
  { label: 'D-Tech Mestzakken-GROTE DOOS',  tms: 'Grote doos sealrollen (10 doosjes)' },
  { label: 'Vaste mestzakken-(50 zakken)',  tms: 'Setje vaste mestzakken (50 stuks)' },
  { label: 'Vaste mestzakken-(500 zakken)', tms: 'Grote doos vaste mestzakken (500 stuks)' },
]

/** Lookup: hun label → onze TMS-omschrijving */
export const MESTKLANT_TMS_BY_LABEL: Record<string, string> =
  Object.fromEntries(MESTKLANT_OPTIONS.map(o => [o.label, o.tms]))
