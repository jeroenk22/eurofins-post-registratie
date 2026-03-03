/**
 * IP-whitelist configuratie
 *
 * Zet FILTER_ENABLED op false om het filter tijdelijk uit te schakelen
 * (toegang voor alle IP-adressen). Commit en push naar main — Netlify
 * herdeployt automatisch binnen ~1-2 minuten.
 */
export const FILTER_ENABLED = true;

/**
 * Publieke IP-adressen die toegang hebben tot de app.
 * Controleer het IP-adres van elk netwerk via https://whatismyip.com
 * terwijl je verbonden bent met dat wifi-netwerk.
 */
export const ALLOWED_IPS: string[] = [
  "195.222.119.185", // Miedema
  "5.6.7.8", // ← vervang met het werkelijke IP-adres van locatie 2
];
