import { useCallback, useRef, useState } from "react";
import type { Photo, SubmitState } from "./types";
import { useStore } from "./useStore";
import { submitToWebhook, isWebhookConfigured } from "./webhookService";
import { validateForm } from "./validation";
import { useRecipientData } from "./hooks/useRecipientData";
import Header from "./components/Header";
import PostCard from "./components/PostCard";
import SuccessScreen from "./components/SuccessScreen";
import PrintLinkScreen from "./components/PrintLinkScreen";
import SectionDivider from "./components/SectionDivider";
import FormField from "./components/FormField";
import PwaInstallBanner from "./components/PwaInstallBanner";
import QrCodeFloat from "./components/QrCodeFloat";
import MobileCameraPage from "./components/MobileCameraPage";
import { useMobilePhotoSync } from "./hooks/useMobilePhotoSync";
import { decodePrintData } from "./services/printService";

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

  // Mobile photo page mode
  const mobileParam = params.get("mobile");
  if (mobileParam) {
    return <MobileCameraPage sessionId={mobileParam} />;
  }

  const store = useStore();
  const { recipients } = useRecipientData();
  const [submitState, setSubmitState] = useState<SubmitState>(() =>
    sessionStorage.getItem("submit_state") === "success" ? "success" : "idle"
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [sessionId] = useState(getSessionId);

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
    submitState === "idle" || submitState === "error",
  );

  const handleSubmit = async () => {
    const err = validateForm(store.entries, store.senderName, store.senderEmail);
    if (err) {
      setErrorMsg(err);
      return;
    }

    setSubmitState("sending");
    setErrorMsg("");

    try {
      await submitToWebhook(
        store.entries,
        store.senderName,
        store.senderPhone,
        store.senderEmail,
      );
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
    setSubmitState("idle");
    setErrorMsg("");
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
                  />
                  <FormField
                    id="sender-phone"
                    label="Telefoonnummer"
                    hint="(optioneel)"
                    type="tel"
                    placeholder="06 12345678"
                    value={store.senderPhone}
                    onChange={(e) =>
                      store.setSenderPhone(e.currentTarget.value)
                    }
                    inputMode="tel"
                    autoComplete="tel"
                  />
                  <FormField
                    id="sender-email"
                    label="E-mailadres"
                    hint="(optioneel — voor bevestiging)"
                    type="email"
                    placeholder="jouw@emailadres.nl"
                    value={store.senderEmail}
                    onChange={(e) =>
                      store.setSenderEmail(e.currentTarget.value)
                    }
                    inputMode="email"
                    autoComplete="email"
                  />
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
        />
      )}
    </>
  );
}
