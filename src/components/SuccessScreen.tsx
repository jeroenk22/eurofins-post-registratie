import { useState } from "react";
import type { PostEntry } from "../types";
import {
  getSelectedFormat,
  setSelectedFormat,
  printLabels,
  type PrintEntry,
} from "../services/printService";
import LabelFormatSelect from "./LabelFormatSelect";

interface SuccessScreenProps {
  entries: PostEntry[];
  senderEmail: string;
  onReset: () => void;
}

function formatRoute(entry: PostEntry): string {
  if (entry.shelf === "overig") return "";
  if (entry.shelf) return `Route ${entry.shelf}`;
  return "";
}

function toPrintEntry(e: PostEntry): PrintEntry {
  return {
    name: e.name,
    adres: e.adres,
    postcode: e.postcode,
    plaats: e.plaats,
    land: e.land,
    route: formatRoute(e),
    colli: e.colli,
    colliOmschrijvingen: e.colliOmschrijvingen,
    spoed: e.spoed,
  };
}

export default function SuccessScreen({
  entries,
  senderEmail,
  onReset,
}: SuccessScreenProps) {
  const [formatId, setFormatId] = useState(() => getSelectedFormat().id);

  const handleFormatChange = (id: string) => {
    setSelectedFormat(id);
    setFormatId(id);
  };

  const totalColli = entries.reduce((sum, e) => sum + e.colli, 0);

  const handlePrintAll = () => {
    printLabels(entries.map(toPrintEntry), getSelectedFormat());
  };

  const handlePrintEntry = (e: PostEntry) => {
    printLabels([toPrintEntry(e)], getSelectedFormat());
  };

  return (
    <div className="flex flex-col items-center text-center px-6 py-10">
      <div className="w-16 h-16 rounded-full bg-mi-green-light border-2 border-mi-green flex items-center justify-center text-3xl mb-5 text-mi-green">
        ✓
      </div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">Verstuurd!</h2>
      <p className="text-sm text-gray-500 mb-1 leading-relaxed">
        {entries.length} {entries.length === 1 ? "zending" : "zendingen"}{" "}
        aangemeld.
      </p>
      {senderEmail && (
        <p className="text-xs text-gray-400 mb-6">
          Bevestiging wordt gestuurd naar <strong>{senderEmail}</strong>.
        </p>
      )}
      {!senderEmail && <div className="mb-6" />}

      {/* Print sectie */}
      <div className="w-full max-w-sm border border-gray-200 rounded-xl mb-6">
        {/* Formaat selector */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 rounded-t-xl flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-600">Formaat:</span>
          <LabelFormatSelect value={formatId} onChange={handleFormatChange} />
        </div>

        {/* Print alle labels */}
        <div className="px-4 py-3 border-b border-gray-200">
          <button
            type="button"
            onClick={handlePrintAll}
            className="w-full py-2.5 rounded-lg bg-ef-blue text-white text-sm font-semibold hover:bg-ef-blue/90 active:scale-[0.98] transition-all"
          >
            Print alle labels ({totalColli} colli)
          </button>
        </div>

        {/* Print per entry */}
        <div className="divide-y divide-gray-100 rounded-b-xl overflow-hidden">
          {entries.map((entry, i) => (
            <div
              key={entry.id}
              className="px-4 py-3 flex items-center justify-between gap-3"
            >
              <div className="text-left min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {i + 1}. {entry.name || <span className="text-gray-400 italic">Naam onbekend</span>}
                </p>
                {formatRoute(entry) && (
                  <p className="text-xs text-gray-500">{formatRoute(entry)}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handlePrintEntry(entry)}
                className="shrink-0 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 active:scale-[0.97] transition-all"
              >
                Print {entry.colli} {entry.colli === 1 ? "label" : "labels"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="px-5 py-2.5 rounded-lg bg-ef-blue text-white text-sm font-semibold hover:bg-ef-blue/90 transition-colors"
      >
        + Nieuwe aanmelding
      </button>
    </div>
  );
}
