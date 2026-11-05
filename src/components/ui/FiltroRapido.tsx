import { formatoPesos } from '../../lib/formato'

export interface OpcionRapida {
  clave: string
  titulo: string
  cantidad: number
  monto?: number
  /** rojo para lo que ya está fuera de plazo */
  alerta?: boolean
}

/**
 * Una fila de botones para ver una parte de la tabla (en vez de tarjetas grandes).
 * El que está elegido se marca; tocarlo otra vez vuelve a "Todas".
 */
export function FiltroRapido({ opciones, activa, onElegir }: { opciones: OpcionRapida[]; activa: string; onElegir: (clave: string) => void }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2" role="tablist">
      {opciones.map((o) => {
        const elegida = o.clave === activa
        return (
          <button
            key={o.clave}
            type="button"
            role="tab"
            aria-selected={elegida}
            onClick={() => onElegir(elegida ? opciones[0].clave : o.clave)}
            className={`rounded-lg border px-2.5 py-1.5 sm:px-3 sm:py-2 text-left text-sm transition ${
              elegida ? 'border-marca bg-marca text-white' : 'border-slate-200 bg-white hover:border-marca/50'
            }`}
          >
            <span className="font-semibold">{o.titulo}</span>
            <span className={`ml-2 font-bold tabular-nums ${elegida ? '' : o.alerta && o.cantidad ? 'text-red-800' : 'text-slate-600'}`}>{o.cantidad.toLocaleString('es-AR')}</span>
            {o.monto !== undefined && <span className={`ml-1.5 hidden text-xs sm:inline tabular-nums ${elegida ? 'text-white/80' : 'text-slate-500'}`}>· {formatoPesos(o.monto)}</span>}
          </button>
        )
      })}
    </div>
  )
}
