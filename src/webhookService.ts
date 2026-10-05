import type { PostEntry, SubmitPayload } from "./types";
import type { PrintEntry } from "./services/printService";
import { serverNow } from "./services/serverTime";
import { MESTKLANT_TMS_BY_LABEL } from "./mestklantOptions";
import { newSubmissionId, parseOrderIds } from "./services/orderIds";

const RECIPIENT_TYPE_LABEL: Record<string, string> = {
  Monsternemers: 'monsternemer',
  AP06: 'ap06',
  Mestklanten: 'mestklant',
}

export interface SubmitResult {
  /** Verzendtijdstip (ISO) — hetzelfde als in de payload en de print-link. */
  submittedAt: string;
  /**
   * Mendrix order-ID per entry (zelfde volgorde als de entries); `null` als de
   * order niet is aangemaakt. Leeg als de order-koppeling niet bereikbaar was.
   */
  orderIds: (string | null)[];
  /** Aanmeldingscode: onder deze code staan labels en foto's op de server. */
  submissionId: string;
}

export interface SubmitOptions {
  /** Bevestigingsmail van Make voor deze aanmelding (filter op module 82). */
  mailVersturen?: boolean;
}

/**
 * Een aanmelding waarvan de Mendrix-orders al bestaan, maar die Make niet
 * bereikte. Opnieuw proberen gaat alleen nog naar Make, met dezelfde payload:
 * nog eens langs create-order zou een tweede order maken.
 */
export interface PendingSubmission {
  payload: SubmitPayload;
  orderIds: (string | null)[];
}

/** Verzenden mislukt; `pending` is gezet als de orders toch al zijn aangemaakt. */
export class SubmitError extends Error {
  readonly pending: PendingSubmission | null;
  constructor(message: string, pending: PendingSubmission | null) {
    super(message);
    this.name = "SubmitError";
    this.pending = pending;
  }
}

// De Make-URL staat alleen server-side; de browser post naar deze Netlify-functie.
async function postToMake(payload: SubmitPayload): Promise<void> {
  const res = await fetch("/.netlify/functions/naar-make", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Verzenden naar Make mislukt (HTTP ${res.status})`);
}

/** Haalt de order-ID's uit het antwoord van forward-webhook; nooit een fout. */
async function readOrderIds(res: Response | null): Promise<(string | null)[]> {
  if (!res?.ok) return [];
  try {
    return parseOrderIds(await res.json());
  } catch {
    return [];
  }
}

export async function submitToWebhook(
  entries: PostEntry[],
  senderName: string,
  senderPhone: string,
  senderEmail: string,
  senderCcEmail: string = '',
  options: SubmitOptions = {},
): Promise<SubmitResult> {
  // Servertijd, niet de klok van de werkplek — die kan verkeerd lopen en zou
  // een verkeerd tijdstip op het verzendlabel en in de payload zetten.
  const now = serverNow();

  const base = `${window.location.origin}${window.location.pathname}`;

  const submitEntries = entries.map((e, i) => {
    const shelf = e.shelf === 'overig' ? `Overig: ${e.shelfDescription}` : `Schap ${e.shelf}`;
    return {
      entry_number: i + 1,
      shelf,
      recipient: e.name.trim(),
      recipient_type: e.recipientType ? (RECIPIENT_TYPE_LABEL[e.recipientType] ?? e.recipientType) : null,
      adres: e.adres.trim() || null,
      postcode: e.postcode.trim() || null,
      plaats: e.plaats.trim() || null,
      // Een lege land-kolom in de ontvangerslijst liet create-order crashen
      // (en daarmee de hele aanmelding); zonder land is het Nederland.
      land: e.land.trim() || 'Nederland',
      colli: e.colli,
      colli_omschrijvingen: (e.colliOmschrijvingen ?? []).slice(0, e.colli).map(v =>
        e.recipientType === 'Mestklanten' ? (MESTKLANT_TMS_BY_LABEL[v] ?? v) : v
      ),
      spoed: e.spoed,
      photo_count: e.photos.length,
      photos: e.photos.map((p) => ({
        filename: p.name,
        base64: p.data.replace(/^.*?(data:)/, '$1'),
        recipient: e.name.trim(),
        spoed: e.spoed,
      })),
    };
  });

  const allPrintEntries: PrintEntry[] = entries.map((e) => {
    const route = e.shelf === 'overig' ? '' : `Route ${e.shelf}`;
    return { name: e.name.trim(), adres: e.adres, postcode: e.postcode, plaats: e.plaats, land: e.land, route, colli: e.colli, colliOmschrijvingen: e.colliOmschrijvingen, spoed: e.spoed, orderedAt: now.toISOString() };
  });
  // Labels en foto's staan op de server onder deze code (naar-make slaat ze op);
  // de links bevatten alleen de code, geen persoonsgegevens.
  const submissionId = newSubmissionId();

  const payload: SubmitPayload = {
    submitted_at: now.toISOString(),
    datetime_nl: now.toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" }),
    app_version: __APP_VERSION__,
    sender_name: senderName.trim(),
    sender_phone: senderPhone.trim() || null,
    sender_email: senderEmail.trim() || null,
    cc_email: senderCcEmail.trim() || null,
    total_entries: entries.length,
    print_url: `${base}?s=${submissionId}`,
    fotos_url: `${base}?fotos=${submissionId}`,
    submission_id: submissionId,
    // Alleen de desktop kiest dit; zonder het veld stuurt Make de mail zoals altijd.
    ...(options.mailVersturen !== undefined && { mail_versturen: options.mailVersturen }),
    // recipient en spoed worden per foto meegestuurd zodat Make's foto-iterator
    // deze waarden direct beschikbaar heeft. In Make zijn parent-bundle velden
    // (zoals entry.recipient) niet bereikbaar vanuit een geneste sub-route iterator,
    // waardoor de bestandsnaam anders niet correct kan worden opgebouwd.
    // De duplicatie is bewust en alleen zichtbaar in de interne webhook payload.
    entries: submitEntries,
  };

  // Ook als Make faalt wachten op forward-webhook: create-order kan de orders
  // dan al hebben gemaakt, en die ID's zijn nodig om het niet dubbel te doen.
  // naar-make bewaart de labels; forward-webhook heeft ze niet nodig.
  const makePayload: SubmitPayload = { ...payload, labels: allPrintEntries };
  const [make, forwardRes] = await Promise.all([
    postToMake(makePayload).then(() => null, (err: unknown) => err),
    fetch("/.netlify/functions/forward-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null),
  ]);
  const orderIds = await readOrderIds(forwardRes);

  if (make) {
    const message = make instanceof Error ? make.message : String(make);
    throw new SubmitError(message, orderIds.some(Boolean) ? { payload: makePayload, orderIds } : null);
  }

  // Het verzendtijdstip wordt teruggegeven zodat de labels exact dezelfde
  // datum/tijd tonen als de payload en de print-link.
  return { submittedAt: payload.submitted_at, orderIds, submissionId };
}

/** Tweede poging na een SubmitError met `pending`: alleen Make, zelfde payload. */
export async function resubmitToMake(pending: PendingSubmission): Promise<SubmitResult> {
  try {
    await postToMake(pending.payload);
  } catch (err) {
    throw new SubmitError(err instanceof Error ? err.message : String(err), pending);
  }
  return { submittedAt: pending.payload.submitted_at, orderIds: pending.orderIds, submissionId: pending.payload.submission_id };
}
