import { useState } from "react";
import Header from "./Header";
import {
  getSelectedFormat,
  setSelectedFormat,
  printLabels,
  type PrintEntry,
} from "../services/printService";
import LabelFormatSelect from "./LabelFormatSelect";

interface PrintLinkScreenProps {
  entries: PrintEntry[];
}

export default function PrintLinkScreen({ entries }: PrintLinkScreenProps) {
  const [formatId, setFormatId] = useState(() => getSelectedFormat().id);

  const handleFormatChange = (id: string) => {
    setSelectedFormat(id);
    setFormatId(id);
  };

  const totalColli = entries.reduce((sum, e) => sum + e.colli, 0);

  const handlePrintAll = () => {
    printLabels(entries, getSelectedFormat());
  };

  const handlePrintEntry = (e: PrintEntry) => {
    printLabels([e], getSelectedFormat());
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto min-h-screen bg-white shadow-sm flex flex-col">
        <Header />

        <div className="flex-1 px-4 pt-6 pb-10">
          <h2 className="text-base font-bold text-gray-800 mb-1">
            Verzendlabels printen
          </h2>
          <p className="text-sm text-gray-500 mb-5">
            Kies een labelformaat en print de labels voor deze aanmelding.
          </p>

          <div className="border border-gray-200 rounded-xl">
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
                  key={i}
                  className="px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div className="text-left min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {i + 1}. {entry.name || <span className="text-gray-400 italic">Naam onbekend</span>}
                    </p>
                    {entry.route && (
                      <p className="text-xs text-gray-500">{entry.route}</p>
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
        </div>
      </div>
    </div>
  );
}
