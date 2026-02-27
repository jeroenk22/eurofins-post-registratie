import type { PostEntry, SubmitPayload } from "./types";

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

  const payload: SubmitPayload = {
    submitted_at: now.toISOString(),
    datetime_nl: now.toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" }),
    sender_name: senderName.trim(),
    sender_phone: senderPhone.trim() || null,
    sender_email: senderEmail.trim() || null,
    total_entries: entries.length,
    entries: entries.map((e, i) => ({
      entry_number: i + 1,
      shelf: `Schap ${e.shelf}`,
      recipient: e.name.trim(),
      colli: e.colli,
      spoed: e.spoed,
      photo_count: e.photos.length,
      photos: e.photos.map((p) => ({ filename: p.name, base64: p.data })),
    })),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
}
