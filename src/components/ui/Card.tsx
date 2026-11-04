import { ChevronRight, Download } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { FiltroSucursal } from '../Filtros'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>
}

export function CardTitulo({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-sm font-bold text-noche">{children}</h2>
      {accion}
    </div>
  )
}

type Tono = 'neutro' | 'marca' | 'verde' | 'amarillo' | 'rojo'

const TONO_VALOR: Record<Tono, string> = {
  neutro: 'text-noche',
  marca: 'text-marca',
  verde: 'text-esmeralda',
  amarillo: 'text-sem-amarillo',
  rojo: 'text-sem-rojo',
}

/**
 * Tarjeta de indicador (KPI). El número se achica con el ancho de la pantalla para que los
 * importes grandes ($ 1.873.420.646,07) entren siempre en una línea. Con `to`, la tarjeta se puede
 * tocar y abre el detalle.
 */
export function Indicador({
  titulo,
  valor,
  ayuda,
  tono = 'neutro',
  icono,
  to,
  punto,
}: {
  titulo: string
  valor: string
  ayuda?: string
  tono?: Tono
  icono?: ReactNode
  to?: string
  /** color de un puntito antes del título, para relacionarlo con una barra o un gráfico (ej. 'bg-marca') */
  punto?: string
}) {
  const contenido = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {punto && <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${punto}`} aria-hidden="true" />}
          {titulo}
        </div>
        {icono && <div className="text-slate-400">{icono}</div>}
        {to && <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-marca" />}
      </div>
      <div
        className={`mt-2 whitespace-nowrap font-extrabold tracking-tight tabular-nums ${TONO_VALOR[tono]}`}
        style={{ fontSize: 'clamp(1rem, 1.3vw, 1.5rem)' }}
      >
        {valor}
      </div>
      {ayuda && <div className="mt-1 text-xs text-slate-500">{ayuda}</div>}
    </>
  )
  if (to) {
    return (
      <Link
        to={to}
        className="group block min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-marca/40 hover:shadow-md"
      >
        {contenido}
      </Link>
    )
  }
  return <Card className="min-w-0 overflow-hidden p-4">{contenido}</Card>
}

/**
 * Título de cada pantalla. Con `sucursal`, el filtro de sucursal queda debajo del título, a la vista
 * (no arriba a la derecha). La fecha del día no se repite acá: está una sola vez, en el menú.
 */
export function EncabezadoPagina({
  titulo,
  subtitulo,
  acciones,
  sucursal = false,
}: {
  titulo: string
  subtitulo?: string
  acciones?: ReactNode
  sucursal?: boolean
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-noche">{titulo}</h1>
        {(sucursal || subtitulo) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            {sucursal && <FiltroSucursal enLinea />}
            {subtitulo && <p className="text-sm text-slate-500">{subtitulo}</p>}
          </div>
        )}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </div>
  )
}

/** Botón estándar para exportar la tabla de la pantalla a Excel. */
export function BotonExportar({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-noche shadow-sm hover:bg-fondo"
    >
      <Download className="h-4 w-4 text-esmeralda" />
      Exportar a Excel
    </button>
  )
}
