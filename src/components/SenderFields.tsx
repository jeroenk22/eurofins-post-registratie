import type { Store } from '../useStore'
import { isValidEmail, isValidPhone } from '../validation'
import FormField from './FormField'

interface SenderFieldsProps {
  store: Store
  showErrors: boolean
  showCc: boolean
  onShowCcChange: (show: boolean) => void
  /** Twee kolommen naast elkaar (desktop-instellingen) in plaats van onder elkaar. */
  columns?: boolean
}

/** Naam, telefoon, e-mail en CC van wie aanmeldt; mobiel onderaan, desktop in de instellingen. */
export default function SenderFields({ store, showErrors, showCc, onShowCcChange, columns = false }: SenderFieldsProps) {
  const senderPhoneInvalid = showErrors && store.senderPhone.trim() !== '' && !isValidPhone(store.senderPhone.trim())
  const senderEmailInvalid = showErrors && store.senderEmail.trim() !== '' && !isValidEmail(store.senderEmail.trim())
  const ccEmailInvalid = showErrors && store.senderCcEmail.trim() !== '' && !isValidEmail(store.senderCcEmail.trim())

  return (
    <div className={columns ? 'grid grid-cols-2 gap-x-4 gap-y-3 items-start' : 'space-y-3'}>
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
          onClick={() => onShowCcChange(true)}
          className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2 self-start justify-self-start py-2 pr-2"
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
                onShowCcChange(false);
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
  )
}
