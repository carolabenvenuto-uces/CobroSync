import { Check, X } from 'lucide-react'
import type { ReactNode } from 'react'

/** Color de cada tarjeta: una franja a la izquierda y, cuando está elegida, el fondo del mismo tono */
export type TonoTarjeta = 'ambar' | 'indigo' | 'celeste' | 'rojo' | 'gris'
const TONOS: Record<TonoTarjeta, { franja: string; elegida: string; texto: string }> = {
  ambar: { franja: 'border-l-amber-400', elegida: 'bg-amber-50 border-amber-400 ring-amber-200', texto: 'text-amber-800' },
  indigo: { franja: 'border-l-marca', elegida: 'bg-indigo-50 border-marca ring-indigo-200', texto: 'text-indigo-800' },
  celeste: { franja: 'border-l-sky-400', elegida: 'bg-sky-50 border-sky-400 ring-sky-200', texto: 'text-sky-800' },
  rojo: { franja: 'border-l-red-500', elegida: 'bg-red-50 border-red-400 ring-red-200', texto: 'text-red-800' },
  gris: { franja: 'border-l-slate-400', elegida: 'bg-slate-100 border-slate-400 ring-slate-200', texto: 'text-slate-700' },
}

/**
 * Tarjeta que filtra la tabla de abajo. La elegida se pinta de su color y muestra "Filtrando";
 * las otras quedan apagadas, para que se note que la tabla muestra solo una parte.
 */
export function TarjetaFiltro({
  titulo,
  cantidad,
  tono,
  activa,
  otraActiva,
  onClick,
  children,
}: {
  titulo: string
  cantidad: number
  tono: TonoTarjeta
  activa: boolean
  otraActiva: boolean
  onClick: () => void
  children?: ReactNode
}) {
  const t = TONOS[tono]
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={`rounded-xl border border-l-4 p-3 text-left transition ${t.franja} ${
        activa ? `${t.elegida} shadow-sm ring-2` : otraActiva ? 'border-slate-200 bg-slate-50 opacity-50 hover:opacity-80' : 'border-slate-200 bg-white hover:shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-semibold uppercase tracking-wide ${activa ? t.texto : 'text-slate-500'}`}>{titulo}</span>
        <span className="text-xl font-extrabold tabular-nums text-noche">{cantidad.toLocaleString('es-AR')}</span>
      </div>
      {children}
      {activa && (
        <span className={`mt-2 inline-flex items-center gap-1 text-[11px] font-bold ${t.texto}`}>
          <Check className="h-3.5 w-3.5" /> Filtrando · tocar de nuevo para ver todas
        </span>
      )}
    </button>
  )
}

/** Línea debajo de las tarjetas: qué se está mostrando y cómo volver a ver todo */
export function AvisoFiltroTarjeta({ texto, onQuitar }: { texto: string | null; onQuitar: () => void }) {
  if (!texto)
    return <p className="-mt-2 mb-3 text-xs text-slate-500">Tocar una tarjeta para ver solo esas facturas.</p>
  return (
    <div className="-mt-1 mb-3 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-slate-600">
        Se muestran solo: <strong className="text-noche">{texto}</strong>
      </span>
      <button
        type="button"
        onClick={onQuitar}
        className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-700 hover:bg-fondo"
      >
        <X className="h-3.5 w-3.5" /> Ver todas
      </button>
    </div>
  )
}
