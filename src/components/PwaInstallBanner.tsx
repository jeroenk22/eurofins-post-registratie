import { useState, useEffect } from "react";
import { usePwaInstall } from "../usePwaInstall";

export default function PwaInstallBanner() {
  const { canInstall, install, dismiss } = usePwaInstall();
  const [slideIn, setSlideIn] = useState(false);

  useEffect(() => {
    if (!canInstall) return;

    const timer = setTimeout(() => setSlideIn(true), 50);
    return () => clearTimeout(timer);
  }, [canInstall]);

  if (!canInstall) return null;

  return (
    <div
      role="banner"
      aria-label="App installeren"
      className={`fixed bottom-0 inset-x-0 z-50 transition-transform duration-300 ease-out ${
        slideIn ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="max-w-lg mx-auto bg-white border-t border-gray-100 shadow-[0_-4px_24px_rgba(0,56,131,0.10)]">
        <div className="h-1 bg-ef-blue" />

        <div className="px-4 pt-4 pb-5">
          <div className="flex items-center gap-3 mb-4">
            <img
              src="/pwa-192x192.png"
              alt="App icoon"
              className="w-12 h-12 rounded-xl flex-shrink-0 border border-gray-100"
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 text-sm leading-tight">
                Post aanmelden app
              </p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                Installeer als app voor snellere toegang — altijd bij de hand.
              </p>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Sluiten"
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors p-1 -mr-1"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={dismiss}
              className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              Niet nu
            </button>
            <button
              type="button"
              onClick={() => {
                void install();
              }}
              className="flex-[2] py-2.5 rounded-lg bg-ef-blue text-white text-sm font-semibold hover:bg-ef-blue/90 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
              Installeren
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
