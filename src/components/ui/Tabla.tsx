import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { BotonExportar } from './Card'

/**
 * Tabla común a todas las pantallas:
 * - filtros sobre el nombre de cada columna (desplegable con los valores que hay)
 * - orden tocando el título (ascendente / descendente)
 * - lupa para buscar directo una factura
 * - encabezado fijo al bajar
 */
export interface Columna<T> {
  clave: string
  titulo: string
  celda: (fila: T) => ReactNode
  /** valor para ordenar; sin esto la columna no se ordena */
  orden?: (fila: T) => string | number | null
  /** texto con el que se filtra; sin esto la columna no tiene filtro */
  filtro?: (fila: T) => string
  derecha?: boolean
  /** clases extra de la celda */
  clase?: string
}

interface Props<T> {
  filas: T[]
  columnas: Columna<T>[]
  clave: (fila: T) => string
  /** texto en el que busca la lupa; sin esto no hay buscador */
  buscar?: (fila: T) => string
  textoBusqueda?: string
  onFila?: (fila: T) => void
  /** filtros que llegan, por ejemplo, desde un aviso: { estado: 'Crítica' } */
  filtrosIniciales?: Record<string, string>
  ordenInicial?: { clave: string; dir: 'asc' | 'desc' }
  porPagina?: number
  vacio?: string
  /** si está, aparece "Exportar a Excel" con las filas filtradas */
  exportar?: (filas: T[]) => void
  /** resumen de las filas filtradas (cantidad, total) */
  resumen?: (filas: T[]) => ReactNode
  /** fila de totales al pie */
  pie?: (filas: T[]) => ReactNode
}

const TODOS = '__todos__'

export function Tabla<T>({
  filas,
  columnas,
  clave,
  buscar,
  textoBusqueda = 'Buscar…',
  onFila,
  filtrosIniciales = {},
  ordenInicial,
  porPagina = 50,
  vacio = 'No hay filas con estos filtros.',
  exportar,
  resumen,
  pie,
}: Props<T>) {
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState<Record<string, string>>(filtrosIniciales)
  const [orden, setOrden] = useState(ordenInicial ?? null)
  const [pagina, setPagina] = useState(1)

  // Valores posibles de cada filtro, a partir de las filas
  const opciones = useMemo(() => {
    const r: Record<string, string[]> = {}
    for (const col of columnas) {
      if (!col.filtro) continue
      const valores = new Set<string>()
      for (const f of filas) {
        const v = col.filtro(f)
        if (v) valores.add(v)
      }
      r[col.clave] = [...valores].sort((a, b) => a.localeCompare(b, 'es'))
    }
    return r
  }, [filas, columnas])

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    let lista = filas.filter((f) => {
      for (const col of columnas) {
        const elegido = filtros[col.clave]
        if (col.filtro && elegido && elegido !== TODOS && col.filtro(f) !== elegido) return false
      }
      return !texto || !buscar || buscar(f).toLowerCase().includes(texto)
    })
    const col = orden && columnas.find((c) => c.clave === orden.clave)
    if (orden && col?.orden) {
      const valor = col.orden
      const signo = orden.dir === 'asc' ? 1 : -1
      lista = [...lista].sort((a, b) => {
        const va = valor(a)
        const vb = valor(b)
        if (va === vb) return 0
        if (va === null) return 1
        if (vb === null) return -1
        return (va < vb ? -1 : 1) * signo
      })
    }
    return lista
  }, [filas, columnas, filtros, busqueda, buscar, orden])

  const totalPaginas = Math.max(1, Math.ceil(visibles.length / porPagina))
  const actual = Math.min(pagina, totalPaginas)
  const pagina_ = visibles.slice((actual - 1) * porPagina, actual * porPagina)
  const hayFiltros = busqueda !== '' || Object.values(filtros).some((v) => v && v !== TODOS)

  function ordenar(col: Columna<T>) {
    if (!col.orden) return
    setOrden((o) => (o?.clave === col.clave ? { clave: col.clave, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { clave: col.clave, dir: 'desc' }))
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Barra: lupa, resumen y exportar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
        {buscar && (
          <label className="relative min-w-64 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value)
                setPagina(1)
              }}
              placeholder={textoBusqueda}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/20"
            />
          </label>
        )}
        <div className="text-sm text-slate-600">{resumen ? resumen(visibles) : `${visibles.length.toLocaleString('es-AR')} filas`}</div>
        {hayFiltros && (
          <button
            type="button"
            onClick={() => {
              setFiltros({})
              setBusqueda('')
              setPagina(1)
            }}
            className="text-xs font-semibold text-marca hover:underline"
          >
            Limpiar filtros
          </button>
        )}
        {exportar && (
          <div className="ml-auto">
            <BotonExportar onClick={() => exportar(visibles)} />
          </div>
        )}
      </div>

      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-fondo shadow-[0_1px_0_0_#E2E8F0]">
            <tr className="text-xs uppercase tracking-wide text-slate-500">
              {columnas.map((col) => (
                <th key={col.clave} className={`px-3 pt-3 pb-1 font-semibold whitespace-nowrap ${col.derecha ? 'text-right' : ''}`}>
                  {col.orden ? (
                    <button
                      type="button"
                      onClick={() => ordenar(col)}
                      className={`inline-flex items-center gap-1 uppercase hover:text-noche ${orden?.clave === col.clave ? 'text-noche' : ''}`}
                      title="Ordenar"
                    >
                      {col.titulo}
                      {orden?.clave === col.clave ? (
                        orden.dir === 'asc' ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.titulo
                  )}
                </th>
              ))}
            </tr>
            <tr>
              {columnas.map((col) => (
                <th key={col.clave} className="px-3 pb-2 font-normal">
                  {col.filtro && (
                    <select
                      value={filtros[col.clave] ?? TODOS}
                      onChange={(e) => {
                        setFiltros((f) => ({ ...f, [col.clave]: e.target.value }))
                        setPagina(1)
                      }}
                      className={`w-full min-w-24 rounded-md border px-1.5 py-1 text-xs ${
                        filtros[col.clave] && filtros[col.clave] !== TODOS
                          ? 'border-marca bg-marca/5 font-semibold text-marca'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                      aria-label={`Filtrar ${col.titulo}`}
                    >
                      <option value={TODOS}>Todos</option>
                      {(opciones[col.clave] ?? []).map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pagina_.map((f) => (
              <tr key={clave(f)} onClick={onFila ? () => onFila(f) : undefined} className={onFila ? 'cursor-pointer hover:bg-marca/5' : ''}>
                {columnas.map((col) => (
                  <td key={col.clave} className={`px-3 py-2.5 ${col.derecha ? 'text-right tabular-nums' : ''} ${col.clase ?? ''}`}>
                    {col.celda(f)}
                  </td>
                ))}
              </tr>
            ))}
            {pagina_.length === 0 && (
              <tr>
                <td colSpan={columnas.length} className="px-4 py-10 text-center text-slate-500">
                  {vacio}
                </td>
              </tr>
            )}
          </tbody>
          {pie && visibles.length > 0 && <tfoot className="bg-fondo font-bold">{pie(visibles)}</tfoot>}
        </table>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
          <span className="text-slate-500">
            Página {actual} de {totalPaginas}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPagina(actual - 1)}
              disabled={actual === 1}
              className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40"
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPagina(actual + 1)}
              disabled={actual === totalPaginas}
              className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40"
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
