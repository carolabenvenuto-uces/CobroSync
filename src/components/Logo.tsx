import { FIRMA, VERSION } from '../lib/marca'

/**
 * Isologotipo (provisorio, hasta el diseño definitivo): una C abierta que gira, con una moneda
 * verde en la apertura. Sobre fondo oscuro, la C va en un azul más claro para que se lea.
 */
export function Isologo({ className = 'h-9 w-9', claro = false }: { className?: string; claro?: boolean }) {
  const azul = claro ? '#60A5FA' : '#2563EB'
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <path d="M90.4 34.2A40 40 0 1 0 90.4 85.8" fill="none" stroke={azul} strokeWidth="18" strokeLinecap="round" />
      <path d="M78 22l13 12-16 6" fill="none" stroke={azul} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="96" cy="60" r="12" fill="#10B981" />
    </svg>
  )
}

/** Marca completa: isologo + "CobroSync 1.0" + la firma de la autora. */
export function Marca({ oscuro = false }: { oscuro?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Isologo claro={oscuro} />
      <div className="leading-none">
        <div className={`text-lg font-extrabold tracking-tight ${oscuro ? 'text-white' : 'text-noche'}`}>
          Cobro<span className={oscuro ? 'text-blue-400' : 'text-marca'}>Sync</span>
          <span className={`ml-1.5 align-top text-[10px] font-semibold ${oscuro ? 'text-slate-400' : 'text-slate-500'}`}>{VERSION}</span>
        </div>
        <div className={`mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${oscuro ? 'text-slate-400' : 'text-slate-500'}`}>{FIRMA}</div>
      </div>
    </div>
  )
}
