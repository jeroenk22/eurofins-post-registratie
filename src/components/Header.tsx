export default function Header() {
  return (
    <header className="bg-white border-b border-gray-100">
      {/* Logo bar */}
      <div className="flex items-center justify-between px-4 py-3 gap-4">
        {/* Miedema logo */}
        <img
          src="/miedema_logo.svg"
          alt="Miedema Ophaaldienst"
          className="h-8 w-auto object-contain"
        />

        {/* Divider */}
        <div className="h-8 w-px bg-gray-200 flex-shrink-0" />

        {/* Eurofins logo */}
        <img
          src="/eurofins_agro.svg"
          alt="Eurofins Agro"
          className="h-7 w-auto object-contain"
        />
      </div>

      {/* Title band */}
      <div className="bg-ef-blue px-4 py-3">
        <h1 className="text-white font-semibold text-base leading-tight">
          Post registratie
        </h1>
        <p className="text-ef-blue-light/70 text-xs mt-0.5">
          Vul in wat er klaarstaat — de chauffeur wordt op de hoogte gesteld
        </p>
      </div>
    </header>
  );
}
