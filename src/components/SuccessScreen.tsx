interface SuccessScreenProps {
  entryCount: number
  senderEmail: string
  onReset: () => void
}

export default function SuccessScreen({ entryCount, senderEmail, onReset }: SuccessScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 py-10">
      <div className="w-16 h-16 rounded-full bg-mi-green-light border-2 border-mi-green flex items-center justify-center text-3xl mb-5 text-mi-green">
        ✓
      </div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">Verstuurd!</h2>
      <p className="text-sm text-gray-500 mb-1 leading-relaxed">
        {entryCount} {entryCount === 1 ? 'zending' : 'zendingen'} geregistreerd.
      </p>
      {senderEmail && (
        <p className="text-xs text-gray-400 mb-6">
          Bevestiging wordt gestuurd naar <strong>{senderEmail}</strong>.
        </p>
      )}
      {!senderEmail && <div className="mb-6" />}
      <button
        type="button"
        onClick={onReset}
        className="px-5 py-2.5 rounded-lg bg-ef-blue text-white text-sm font-semibold hover:bg-ef-blue/90 transition-colors"
      >
        + Nieuwe registratie
      </button>
    </div>
  )
}
