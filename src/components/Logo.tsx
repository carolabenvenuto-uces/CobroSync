
/**
 * Isologotipo: un imán con forma de C (lila) con los polos en verde agua, que atrae puntitos
 * (los cobros). Sobre fondo oscuro, el lila va más claro para que se lea.
 */
export function Isologo({ className = 'h-9 w-9', claro = false }: { className?: string; claro?: boolean }) {
  const lila = claro ? '#B9AEFF' : '#5B4FC7'
  const agua = claro ? '#3FD4C2' : '#0E9F8E'
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <path d="M86 28 H58 A32 32 0 0 0 58 92 H86" fill="none" stroke={lila} strokeWidth="22" strokeLinejoin="round" />
      <path d="M76 28 H94" stroke={agua} strokeWidth="22" />
      <path d="M76 92 H94" stroke={agua} strokeWidth="22" />
      <circle cx="104" cy="60" r="5" fill={agua} />
      <circle cx="112" cy="48" r="3.5" fill={agua} opacity="0.8" />
      <circle cx="112" cy="72" r="3.5" fill={agua} opacity="0.8" />
      <circle cx="117" cy="60" r="2.5" fill={agua} opacity="0.6" />
    </svg>
  )
}

/** Marca: isologo + "CobroSync" con la versión y la firma corta, chiquitas. */
export function Marca({ oscuro = false }: { oscuro?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Isologo claro={oscuro} />
      <div className="leading-none">
        <div className={`text-lg font-extrabold tracking-tight ${oscuro ? 'text-white' : 'text-noche'}`}>
          Cobro<span className={oscuro ? 'text-[#B9AEFF]' : 'text-marca'}>Sync</span>
        </div>
      </div>
    </div>
  )
}
