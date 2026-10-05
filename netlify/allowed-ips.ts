/**
 * Toegang per netwerk
 *
 * De beheerder geeft toegang via de toegangs-sheet ("Post-app toegang",
 * tabblad Netwerken): zet "ja" bij een netwerk. De app zet zelf nieuwe
 * netwerken in die sheet. De lijst hieronder is alleen een vangnet.
 *
 * FILTER_MODE:
 *  - 'uit'    geen registratie, niets blokkeren
 *  - 'meten'  netwerken registreren, niets blokkeren
 *  - 'aan'    registreren, en netwerken zonder toegang krijgen een 403 op de
 *             beschermde eindpunten
 *
 * Wijzigen: commit en push naar main; Netlify herdeployt binnen ~1-2 minuten.
 */
export type FilterMode = 'uit' | 'meten' | 'aan'
export const FILTER_MODE: FilterMode = 'meten';

/**
 * Vaste basislijst: deze netwerken hebben altijd toegang, ook als Google of
 * de sync hapert. Alleen voor vaste, betrouwbare locaties; de rest hoort in
 * de toegangs-sheet. Een regel mag een IPv4-adres, IPv4-CIDR of IPv6-/64-prefix zijn.
 */
export const ALLOWED_IPS: string[] = [
  "195.222.119.185", // Miedema
];
