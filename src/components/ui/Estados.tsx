import { LockKeyhole } from 'lucide-react'

/** Mensajes mientras se cargan los datos o si falla la carga. */
export function Cargando({ pantallaCompleta = false }: { pantallaCompleta?: boolean }) {
  if (!pantallaCompleta) return <div className="p-10 text-center text-sm text-slate-500">Cargando datos…</div>
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-noche text-center">
      <ImanCargando />
      <div className="text-2xl font-extrabold text-white">CobroSync</div>
      <div className="text-sm text-slate-300">Ingresando con la cuenta de la empresa…</div>
    </div>
  )
}

/** Con Google: la cuenta no está habilitada (o no es de la empresa). */
export function SinAcceso({ mensaje }: { mensaje: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-noche px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sem-rojo/10 text-sem-rojo">
          <LockKeyhole className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-extrabold text-noche">Todavía sin acceso</h1>
        <p className="mt-2 text-sm text-slate-600">{mensaje}</p>
        <p className="mt-4 text-xs text-slate-500">
          Si la cuenta debería tener acceso, Cobranzas puede agregarla. Si se ingresó con una cuenta personal, hay que cerrar sesión en
          Google y volver a entrar con la de la empresa.
        </p>
      </div>
    </div>
  )
}

export function ErrorCarga({ mensaje }: { mensaje: string }) {
  return (
    <div className="m-6 rounded-xl border border-sem-rojo/30 bg-sem-rojo/5 p-6 text-sm text-red-800">
      No se pudieron cargar los datos: {mensaje}
    </div>
  )
}

export const claseSelect =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-noche shadow-sm focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/20'

/**
 * Pantalla de carga: el imán del logo quieto y una fila de puntitos verde agua que avanza hacia él
 * y desaparece al llegar, como si los atrajera (los cobros), mientras se cargan los datos.
 */
function ImanCargando() {
  const lila = '#B9AEFF'
  const agua = '#3FD4C2'
  const puntos = 6
  const duracion = 1.8
  return (
    <svg viewBox="0 0 230 120" className="h-16 w-auto" role="img" aria-label="Cargando">
      <style>{`
        .iman-punto { animation: iman-atrae ${duracion}s cubic-bezier(.45,0,.75,1) infinite; transform-box: fill-box; transform-origin: center; opacity: 0; }
        @keyframes iman-atrae {
          0%   { transform: translateX(0) scale(.45); opacity: 0; }
          20%  { opacity: .55; }
          80%  { transform: translateX(-112px) scale(1); opacity: 1; }
          100% { transform: translateX(-124px) scale(.6); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .iman-punto { animation: none; opacity: .8; }
        }
      `}</style>
      <path d="M86 28 H58 A32 32 0 0 0 58 92 H86" fill="none" stroke={lila} strokeWidth="22" strokeLinejoin="round" />
      <path d="M76 28 H94" stroke={agua} strokeWidth="22" />
      <path d="M76 92 H94" stroke={agua} strokeWidth="22" />
      {Array.from({ length: puntos }, (_, i) => (
        <circle
          key={i}
          className="iman-punto"
          cx="222"
          cy="60"
          r="5"
          fill={agua}
          style={{ animationDelay: `${(-(duracion / puntos) * i).toFixed(2)}s` }}
        />
      ))}
    </svg>
  )
}
