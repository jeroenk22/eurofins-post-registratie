import type { PostEntry, SubmitPayload } from "./types";
import { encodePrintData, type PrintEntry } from "./services/printService";

// Functie i.p.v. constante — zodat tests de env kunnen overschrijven
function getWebhookUrl(): string | undefined {
  return import.meta.env.VITE_WEBHOOK_URL;
}

export function isWebhookConfigured(): boolean {
  const url = getWebhookUrl();
  return !!url && url.length > 0;
}

export async function submitToWebhook(
  entries: PostEntry[],
  senderName: string,
  senderPhone: string,
  senderEmail: string,
): Promise<void> {
  const url = getWebhookUrl();
  if (!url) throw new Error("VITE_WEBHOOK_URL is niet ingesteld in .env");

  const now = new Date();

  const base = `${window.location.origin}${window.location.pathname}`;

  const submitEntries = entries.map((e, i) => {
    const shelf = e.shelf === 'overig' ? `Overig: ${e.shelfDescription}` : `Schap ${e.shelf}`;
    const printEntry: PrintEntry = { name: e.name.trim(), schapnummer: shelf, colli: e.colli };
    return {
      entry_number: i + 1,
      shelf,
      recipient: e.name.trim(),
      colli: e.colli,
      spoed: e.spoed,
      photo_count: e.photos.length,
      photos: e.photos.map((p) => ({
        filename: p.name,
        base64: p.data,
        recipient: e.name.trim(),
        spoed: e.spoed,
      })),
      print_url: `${base}?printData=${encodePrintData([printEntry])}`,
    };
  });

  const allPrintEntries: PrintEntry[] = submitEntries.map((e) => ({
    name: e.recipient,
    schapnummer: e.shelf,
    colli: e.colli,
  }));
  const printUrl = `${base}?printData=${encodePrintData(allPrintEntries)}`;

  const payload: SubmitPayload = {
    submitted_at: now.toISOString(),
    datetime_nl: now.toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" }),
    sender_name: senderName.trim(),
    sender_phone: senderPhone.trim() || null,
    sender_email: senderEmail.trim() || null,
    total_entries: entries.length,
    print_url: printUrl,
    // recipient en spoed worden per foto meegestuurd zodat Make's foto-iterator
    // deze waarden direct beschikbaar heeft. In Make zijn parent-bundle velden
    // (zoals entry.recipient) niet bereikbaar vanuit een geneste sub-route iterator,
    // waardoor de bestandsnaam anders niet correct kan worden opgebouwd.
    // De duplicatie is bewust en alleen zichtbaar in de interne webhook payload.
    entries: submitEntries,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
}
