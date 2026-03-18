import { useState, useRef, useEffect } from "react";
import { LABEL_FORMATS } from "../services/printService";

interface LabelFormatSelectProps {
  value: string;
  onChange: (id: string) => void;
}

export default function LabelFormatSelect({ value, onChange }: LabelFormatSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = LABEL_FORMATS.find((f) => f.id === value) ?? LABEL_FORMATS[0];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-ef-blue/40 transition-all"
      >
        <span className="truncate">{selected.name}</span>
        <svg
          className={`shrink-0 w-4 h-4 text-gray-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {LABEL_FORMATS.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => { onChange(f.id); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                  f.id === value
                    ? "bg-ef-blue text-white font-semibold"
                    : "text-gray-700 hover:bg-ef-blue-light"
                }`}
              >
                {f.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
