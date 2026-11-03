/** Isologotipo: anillo de sincronización (dos flechas que se persiguen). */
export function Isologo({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="cobrosync-anillo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2563EB" />
          <stop offset="1" stopColor="#10B981" />
        </linearGradient>
      </defs>
      <path d="M33 20a13 13 0 0 1-22.5 8.9" fill="none" stroke="url(#cobrosync-anillo)" strokeWidth="4" strokeLinecap="round" />
      <path d="M7 20a13 13 0 0 1 22.5-8.9" fill="none" stroke="url(#cobrosync-anillo)" strokeWidth="4" strokeLinecap="round" />
      <path d="M29 4.7 29.5 11.1 23.2 10.2" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.8 29.8 10.5 28.9 11 35.3" fill="none" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="20" cy="20" r="3.2" fill="#10B981" />
    </svg>
  )
}

/** Marca completa: isologo + "CobroSync" + firma "by CAROLA". */
export function Marca({ oscuro = false }: { oscuro?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Isologo />
      <div className="leading-none">
        <div className={`text-lg font-extrabold tracking-tight ${oscuro ? 'text-white' : 'text-noche'}`}>
          CobroSync
        </div>
        <div className={`mt-1 text-[10px] font-semibold tracking-[0.2em] ${oscuro ? 'text-slate-400' : 'text-slate-500'}`}>
          BY CAROLA
        </div>
      </div>
    </div>
  )
}
