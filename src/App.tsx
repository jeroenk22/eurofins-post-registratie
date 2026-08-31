import { useCallback, useEffect, useRef, useState } from "react";
import type { Photo, SubmitState } from "./types";
import { useStore } from "./useStore";
import { submitToWebhook, isWebhookConfigured } from "./webhookService";
import { validateForm, isValidEmail, isValidPhone } from "./validation";
import { useRecipientData } from "./hooks/useRecipientData";
import Header from "./components/Header";
import PostCard from "./components/PostCard";
import SuccessScreen from "./components/SuccessScreen";
import PrintLinkScreen from "./components/PrintLinkScreen";
import SectionDivider from "./components/SectionDivider";
import FormField from "./components/FormField";
import PwaInstallBanner from "./components/PwaInstallBanner";
import QrCodeFloat from "./components/QrCodeFloat";
import { useMobilePhotoSync } from "./hooks/useMobilePhotoSync";
import { useSwUpdateCheck } from "./hooks/useSwUpdateCheck";
import { decodePrintData } from "./services/printService";
import { syncServerTime } from "./services/serverTime";

// Generate a stable session ID for this browser session
function getSessionId(): string {
  let id = sessionStorage.getItem("mobile_session_id");
  if (!id) {
    id = `s${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem("mobile_session_id", id);
  }
  return id;
}

export default function App() {
  const params = new URLSearchParams(window.location.search);

  // Print-link mode
  const printDataParam = params.get("printData");
  if (printDataParam) {
    const printEntries = decodePrintData(printDataParam);
    if (printEntries) return <PrintLinkScreen entries={printEntries} />;
  }

  const store = useStore();
  const { recipients } = useRecipientData();
  const [submitState, setSubmitState] = useState<SubmitState>(() =>
    sessionStorage.getItem("submit_state") === "success" ? "success" : "idle"
  );
  const [submittedAt, setSubmittedAt] = useState<string>(
    () => sessionStorage.getItem("submit_time") ?? "",
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [errorEntryIds, setErrorEntryIds] = useState<Set<string>>(new Set());
  const [showCc, setShowCc] = useState(() => !!sessionStorage.getItem("show_cc") || store.senderCcEmail !== "");
  const [sessionId] = useState(getSessionId);
  const [sessionReady, setSessionReady] = useState(false);
  useSwUpdateCheck();

  // Haal eenmalig de servertijd op, zodat een verkeerd lopende werkplekklok
  // geen verkeerd tijdstip op het verzendlabel of in de payload zet.
  useEffect(() => { void syncServerTime(); }, []);

  // Stable ref so the sync callback never causes re-renders
  const storeRef = useRef(store);
  storeRef.current = store;

  const handlePhotosReceived = useCallback((entryId: string, mobilePhotos: Photo[]) => {
    const entry = storeRef.current.entries.find(e => e.id === entryId);
    if (!entry) return;
    const existingIds = new Set(entry.photos.map(p => p.id));
    const toAdd = mobilePhotos.filter(p => !existingIds.has(p.id));
    if (toAdd.length > 0) {
      storeRef.current.updateEntry(entryId, { photos: [...entry.photos, ...toAdd] });
    }
  }, []);

  const syncedEntryIds = useMobilePhotoSync(
    sessionId,
    handlePhotosReceived,
    sessionReady && (submitState === "idle" || submitState === "error"),
  );

  const senderPhoneInvalid = showErrors && store.senderPhone.trim() !== '' && !isValidPhone(store.senderPhone.trim())
  const senderEmailInvalid = showErrors && store.senderEmail.trim() !== '' && !isValidEmail(store.senderEmail.trim())
  const ccEmailInvalid = showErrors && store.senderCcEmail.trim() !== '' && !isValidEmail(store.senderCcEmail.trim())

  const handleSubmit = async () => {
    const err = validateForm(store.entries, store.senderName, store.senderEmail, store.senderCcEmail, store.senderPhone);
    if (err) {
      setErrorMsg(err);
      setShowErrors(true);
      setErrorEntryIds(new Set(store.entries.map(e => e.id)));
      return;
    }
    setShowErrors(false);
    setErrorEntryIds(new Set());

    setSubmitState("sending");
    setErrorMsg("");

    try {
      const sentAt = await submitToWebhook(
        store.entries,
        store.senderName,
        store.senderPhone,
        store.senderEmail,
        store.senderCcEmail,
      );
      setSubmittedAt(sentAt);
      sessionStorage.setItem("submit_time", sentAt);
      setSubmitState("success");
      sessionStorage.setItem("submit_state", "success");
    } catch (e) {
      setSubmitState("error");
      setErrorMsg(
        `Verzenden mislukt: ${e instanceof Error ? e.message : "Onbekende fout"}`,
      );
    }
  };

  const handleReset = () => {
    store.reset();
    sessionStorage.removeItem("submit_state");
    sessionStorage.removeItem("submit_time");
    sessionStorage.removeItem("show_cc");
    setSubmittedAt("");
    setSubmitState("idle");
    setErrorMsg("");
    setShowErrors(false);
    setErrorEntryIds(new Set());
    setShowCc(false);
  };

  if (!isWebhookConfigured()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl border border-amber-200 p-6 max-w-sm text-center shadow-sm">
          <p className="text-2xl mb-3">⚠️</p>
          <h2 className="font-bold text-gray-800 mb-2">
            Webhook niet geconfigureerd
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Maak een <code className="bg-gray-100 px-1 rounded">.env</code>{" "}
            bestand aan met:
          </p>
          <pre className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-left text-gray-700">
            VITE_WEBHOOK_URL=https://hook.eu2.make.com/...
          </pre>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-lg mx-auto min-h-screen bg-white shadow-sm flex flex-col">
          <Header />

          {submitState === "success" ? (
            <SuccessScreen
              entries={store.entries}
              senderEmail={store.senderEmail}
              submittedAt={submittedAt}
              onReset={handleReset}
            />
          ) : (
            <div className="flex-1 px-4 pt-4 pb-8">
              <SectionDivider
                label={`${store.entries.length} ${store.entries.length === 1 ? "zending" : "zendingen"}`}
              />

              {store.entries.map((entry, i) => (
                <PostCard
                  key={entry.id}
                  entry={entry}
                  index={i}
                  onUpdate={store.updateEntry}
                  onRemove={store.removeEntry}
                  showRemove={store.entries.length > 1}
                  recipients={recipients}
                  showErrors={errorEntryIds.has(entry.id)}
                />
              ))}

              <button
                type="button"
                onClick={store.addEntry}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm font-semibold text-ef-blue hover:border-ef-blue hover:bg-ef-blue-light transition-all mb-5 flex items-center justify-center gap-1.5"
              >
                <span className="text-lg leading-none">+</span>
                Nog een zending toevoegen
              </button>

              <SectionDivider label="Ingevuld door" />

              <div className="card p-4 mb-4">
                <div className="h-1 -mx-4 -mt-4 mb-4 rounded-t-xl bg-mi-yellow" />
                <div className="space-y-3">
                  <FormField
                    id="sender-name"
                    label="Jouw naam *"
                    type="text"
                    placeholder="bijv. Sophie Jansen"
                    value={store.senderName}
                    onChange={(e) => store.setSenderName(e.currentTarget.value)}
                    autoComplete="name"
                    className={showErrors && !store.senderName.trim() ? '!border-red-400' : ''}
                  />
                  <div>
                    <label htmlFor="sender-phone" className="label-base">
                      Telefoonnummer
                      <span className="normal-case font-normal text-gray-400 ml-1">(optioneel)</span>
                    </label>
                    <div className="relative">
                      <input
                        id="sender-phone"
                        type="tel"
                        className={`input-base !pr-7${senderPhoneInvalid ? ' !border-red-400' : ''}`}
                        placeholder="06 12345678"
                        value={store.senderPhone}
                        onChange={(e) => store.setSenderPhone(e.currentTarget.value)}
                        inputMode="tel"
                        autoComplete="tel"
                      />
                      {store.senderPhone && (
                        <button
                          type="button"
                          tabIndex={-1}
                          onMouseDown={(e) => { e.preventDefault(); store.setSenderPhone('') }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          aria-label="Veld leegmaken"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="sender-email" className="label-base">
                      E-mailadres
                      <span className="normal-case font-normal text-gray-400 ml-1">(optioneel — voor bevestiging)</span>
                    </label>
                    <div className="relative">
                      <input
                        id="sender-email"
                        type="email"
                        className={`input-base !pr-7${senderEmailInvalid ? ' !border-red-400' : ''}`}
                        placeholder="jouw@emailadres.nl"
                        value={store.senderEmail}
                        onChange={(e) => store.setSenderEmail(e.currentTarget.value)}
                        inputMode="email"
                        autoComplete="email"
                      />
                      {store.senderEmail && (
                        <button
                          type="button"
                          tabIndex={-1}
                          onMouseDown={(e) => { e.preventDefault(); store.setSenderEmail('') }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          aria-label="Veld leegmaken"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                  {!showCc && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowCc(true);
                        sessionStorage.setItem("show_cc", "1");
                      }}
                      className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2 self-start py-2 pr-2"
                    >
                      + CC
                    </button>
                  )}
                  {showCc && (
                    <div>
                      <label htmlFor="sender-cc-email" className="label-base">
                        CC e-mailadres
                        <span className="normal-case font-normal text-gray-400 ml-1">(optioneel)</span>
                      </label>
                      <div className="relative">
                        <input
                          id="sender-cc-email"
                          type="email"
                          className={`input-base !pr-7${ccEmailInvalid ? ' !border-red-400' : ''}`}
                          placeholder="cc@emailadres.nl"
                          value={store.senderCcEmail}
                          onChange={(e) => store.setSenderCcEmail(e.currentTarget.value)}
                          inputMode="email"
                          autoComplete="email"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            store.setSenderCcEmail('');
                            setShowCc(false);
                            sessionStorage.removeItem('show_cc');
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          aria-label="CC verwijderen"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="mb-4 px-3 py-2.5 rounded-lg bg-red-50 border border-red-100 text-xs text-red-600"
                >
                  {errorMsg}
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitState === "sending"}
                className={`w-full py-3.5 rounded-xl text-white text-sm font-bold tracking-wide flex items-center justify-center gap-2 transition-all ${
                  submitState === "sending"
                    ? "bg-ef-blue/60 cursor-not-allowed"
                    : "bg-ef-blue hover:bg-ef-blue/90 active:scale-[0.98]"
                }`}
              >
                {submitState === "sending"
                  ? "⏳ Bezig met verzenden…"
                  : "📤 Versturen"}
              </button>
              <p className="text-center text-xs text-gray-300 mt-2">v{__APP_VERSION__}</p>
            </div>
          )}
        </div>
      </div>
      <PwaInstallBanner />
      {submitState !== "success" && (
        <QrCodeFloat
          sessionId={sessionId}
          entries={store.entries}
          syncedEntryIds={syncedEntryIds}
          onSessionReady={() => setSessionReady(true)}
        />
      )}
    </>
  );
}
