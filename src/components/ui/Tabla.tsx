import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3, Search } from 'lucide-react'
import { BotonExportar } from './Card'

/**
 * Tabla común a todas las pantallas:
 * - filtros sobre el nombre de cada columna (desplegable con los valores que hay)
 * - orden tocando el título (ascendente / descendente)
 * - lupa para buscar directo una factura
 * - encabezado fijo al bajar y primera columna fija al correr de costado
 * - compacta, para que entre a lo ancho de la pantalla sin correr la barra; las columnas que se
 *   usan poco se pueden ocultar con "Columnas" (la elección se recuerda en esa computadora)
 * - en el celular, cada fila es una tarjeta: arriba lo principal (por ejemplo, la factura) y el
 *   botón; abajo el resto de los datos con su nombre. Nada se corre de costado.
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
  /** arranca oculta (se puede mostrar con el botón "Columnas") */
  oculta?: boolean
  /**
   * En el celular: 'titulo' va arriba a la izquierda (si ninguna lo dice, la primera columna),
   * 'accion' arriba a la derecha (un botón), 'ancha' ocupa todo el ancho y 'no' no se muestra.
   */
  movil?: 'titulo' | 'accion' | 'ancha' | 'no'
}

interface Props<T> {
  /** nombre de la tabla, para recordar qué columnas eligió mostrar cada persona */
  id?: string
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
  /** con esto aparece una casilla por fila (y una para elegir todas las filtradas) */
  seleccion?: { elegidas: Set<string>; alCambiar: (elegidas: Set<string>) => void }
}

const TODOS = '__todos__'
/** La primera columna queda fija si igual hay que correr de costado (para no perderse en la fila). */
const FIJA = 'sticky left-0 z-10 shadow-[1px_0_0_0_#E2E8F0]'

function leerOcultas(id: string | undefined, columnas: { clave: string; oculta?: boolean }[]): Set<string> {
  if (id) {
    try {
      const guardadas = localStorage.getItem(`cobrosync-columnas-${id}`)
      if (guardadas) return new Set(JSON.parse(guardadas) as string[])
    } catch {
      /* sin almacenamiento: las de siempre */
    }
  }
  return new Set(columnas.filter((c) => c.oculta).map((c) => c.clave))
}

export function Tabla<T>({
  id,
  filas,
  columnas: todasLasColumnas,
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
  seleccion,
}: Props<T>) {
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState<Record<string, string>>(filtrosIniciales)
  const [orden, setOrden] = useState(ordenInicial ?? null)
  const [pagina, setPagina] = useState(1)
  const [ocultas, setOcultas] = useState<Set<string>>(() => leerOcultas(id, todasLasColumnas))
  // Una columna con un filtro puesto (por ejemplo, desde un aviso) se muestra aunque esté oculta
  const columnas = todasLasColumnas.filter((c) => !ocultas.has(c.clave) || (filtrosIniciales[c.clave] ?? '') !== '')
  function alternarColumna(clave: string) {
    const n = new Set(ocultas)
    if (n.has(clave)) n.delete(clave)
    else n.add(clave)
    setOcultas(n)
    if (id) {
      try {
        localStorage.setItem(`cobrosync-columnas-${id}`, JSON.stringify([...n]))
      } catch {
        /* no se recuerda, pero funciona igual */
      }
    }
  }

  // Valores posibles de cada filtro: solo los que existen con los demás filtros puestos (así no
  // se ofrece algo que deja la lista vacía), con cuántas filas hay de cada uno
  const opciones = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    const r: Record<string, { valor: string; cantidad: number }[]> = {}
    for (const col of todasLasColumnas) {
      if (!col.filtro) continue
      const valores = new Map<string, { cantidad: number; orden: string | number | null }>()
      for (const f of filas) {
        const pasaLosDemas = todasLasColumnas.every((otra) => {
          if (otra === col || !otra.filtro) return true
          const elegido = filtros[otra.clave]
          return !elegido || elegido === TODOS || otra.filtro(f) === elegido
        })
        if (!pasaLosDemas || (texto && buscar && !buscar(f).toLowerCase().includes(texto))) continue
        const v = col.filtro(f)
        if (!v) continue
        const x = valores.get(v)
        if (x) x.cantidad++
        else valores.set(v, { cantidad: 1, orden: col.orden ? col.orden(f) : null })
      }
      // Si la columna se ordena (fechas, números), las opciones siguen ese orden; si no, alfabético
      r[col.clave] = [...valores.entries()]
        .sort(([a, x], [b, y]) =>
          col.orden && typeof x.orden === typeof y.orden && x.orden !== null && y.orden !== null && x.orden !== y.orden
            ? x.orden < y.orden
              ? -1
              : 1
            : a.localeCompare(b, 'es'),
        )
        .map(([valor, x]) => ({ valor, cantidad: x.cantidad }))
    }
    return r
  }, [filas, todasLasColumnas, filtros, busqueda, buscar])
  /** Un filtro con una sola opción no sirve para nada: no se muestra (salvo que ya esté puesto) */
  const conFiltro = (col: Columna<T>) =>
    !!col.filtro && ((opciones[col.clave]?.length ?? 0) > 1 || (!!filtros[col.clave] && filtros[col.clave] !== TODOS))

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    let lista = filas.filter((f) => {
      for (const col of todasLasColumnas) {
        const elegido = filtros[col.clave]
        if (col.filtro && elegido && elegido !== TODOS && col.filtro(f) !== elegido) return false
      }
      return !texto || !buscar || buscar(f).toLowerCase().includes(texto)
    })
    const col = orden && todasLasColumnas.find((c) => c.clave === orden.clave)
    if (orden && col?.orden) {
      const valor = col.orden
      const signo = orden.dir === 'asc' ? 1 : -1
      const vacio = (v: string | number | null | undefined) => v === null || v === undefined || v === ''
      lista = [...lista].sort((a, b) => {
        const va = valor(a)
        const vb = valor(b)
        if (va === vb) return 0
        // Las que no tienen dato (por ejemplo, sin fecha de subida) van siempre al final, nunca se pierden
        if (vacio(va)) return vacio(vb) ? 0 : 1
        if (vacio(vb)) return -1
        return (va < vb ? -1 : 1) * signo
      })
    }
    return lista
  }, [filas, todasLasColumnas, filtros, busqueda, buscar, orden])

  const totalPaginas = Math.max(1, Math.ceil(visibles.length / porPagina))
  const actual = Math.min(pagina, totalPaginas)
  const pagina_ = visibles.slice((actual - 1) * porPagina, actual * porPagina)
  // Si la búsqueda no encuentra nada con los filtros puestos, cuántas encuentra sin ellos
  const fueraDeFiltros = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    if (!texto || !buscar || visibles.length > 0) return 0
    return filas.filter((f) => buscar(f).toLowerCase().includes(texto)).length
  }, [busqueda, buscar, visibles.length, filas])
  const hayFiltros = busqueda !== '' || Object.values(filtros).some((v) => v && v !== TODOS)

  function ordenar(col: Columna<T>) {
    if (!col.orden) return
    // Mayor primero → menor primero → como venía (tercer toque, para volver al orden original)
    setOrden((o) => {
      if (o?.clave !== col.clave) return { clave: col.clave, dir: 'desc' }
      if (o.dir === 'desc') return { clave: col.clave, dir: 'asc' }
      return ordenInicial && ordenInicial.clave !== col.clave ? ordenInicial : null
    })
    setPagina(1)
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Barra: lupa, resumen y exportar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
        {buscar && (
          <label className="relative w-full sm:w-auto sm:min-w-64 sm:flex-1">
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
        <div className="ml-auto flex items-center gap-2">
          {todasLasColumnas.length > 6 && !pie && (
            <details className="relative hidden sm:block">
              <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-noche shadow-sm hover:bg-fondo">
                <Columns3 className="h-4 w-4 text-marca" />
                Columnas
                {ocultas.size > 0 && <span className="text-xs font-normal text-slate-500">({ocultas.size} ocultas)</span>}
              </summary>
              <div className="absolute right-0 z-30 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                <p className="px-2 pb-1 text-[11px] text-slate-500">Columnas a la vista. La elección se recuerda en esta computadora.</p>
                {todasLasColumnas.map((c) => (
                  <label key={c.clave} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-fondo">
                    <input type="checkbox" checked={!ocultas.has(c.clave)} onChange={() => alternarColumna(c.clave)} />
                    {c.titulo}
                  </label>
                ))}
              </div>
            </details>
          )}
          {exportar && <BotonExportar onClick={() => exportar(visibles)} />}
        </div>
      </div>

      {/* Celular: una tarjeta por fila (las tablas con totales al pie se ven como tabla) */}
      {!pie && (
        <div className="sm:hidden">
          {(todasLasColumnas.some((c) => c.filtro) || todasLasColumnas.some((c) => c.orden)) && (
            <details className="border-b border-slate-100 px-4 py-2">
              <summary className="cursor-pointer list-none text-sm font-semibold text-marca">Filtrar y ordenar</summary>
              <div className="mt-2 grid gap-2">
                {todasLasColumnas
                  .filter((c) => conFiltro(c))
                  .map((col) => (
                    <label key={col.clave} className="flex items-center justify-between gap-2 text-xs text-slate-600">
                      {col.titulo}
                      <select
                        value={filtros[col.clave] ?? TODOS}
                        onChange={(e) => {
                          setFiltros((f) => ({ ...f, [col.clave]: e.target.value }))
                          setPagina(1)
                        }}
                        className="w-44 rounded-md border border-slate-200 bg-white px-1 py-1.5 text-xs"
                      >
                        <option value={TODOS}>Todos</option>
                        {(opciones[col.clave] ?? []).map((o) => (
                          <option key={o.valor} value={o.valor}>
                            {o.valor} ({o.cantidad.toLocaleString('es-AR')})
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                {todasLasColumnas.some((c) => c.orden) && (
                  <label className="flex items-center justify-between gap-2 text-xs text-slate-600">
                    Ordenar por
                    <select
                      value={orden ? `${orden.clave}|${orden.dir}` : ''}
                      onChange={(e) => {
                        const [c, d] = e.target.value.split('|')
                        setOrden(c ? { clave: c, dir: d as 'asc' | 'desc' } : null)
                      }}
                      className="w-44 rounded-md border border-slate-200 bg-white px-1 py-1.5 text-xs"
                    >
                      <option value="">Como viene</option>
                      {todasLasColumnas
                        .filter((c) => c.orden)
                        .flatMap((c) => [
                          <option key={`${c.clave}-d`} value={`${c.clave}|desc`}>
                            {c.titulo || c.clave} (mayor primero)
                          </option>,
                          <option key={`${c.clave}-a`} value={`${c.clave}|asc`}>
                            {c.titulo || c.clave} (menor primero)
                          </option>,
                        ])}
                    </select>
                  </label>
                )}
              </div>
            </details>
          )}
          <ul className="divide-y divide-slate-100">
            {pagina_.map((f) => {
              const titulo = columnas.find((c) => c.movil === 'titulo') ?? columnas.find((c) => c.movil !== 'accion' && c.movil !== 'no')
              const accion = columnas.find((c) => c.movil === 'accion')
              const resto = columnas.filter((c) => c !== titulo && c !== accion && c.movil !== 'no')
              return (
                <li key={clave(f)} onClick={onFila ? () => onFila(f) : undefined} className={`px-4 py-3 ${onFila ? 'cursor-pointer active:bg-marca/5' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2">
                      {seleccion && (
                        <input
                          type="checkbox"
                          aria-label="Elegir esta fila"
                          className="mt-1"
                          onClick={(e) => e.stopPropagation()}
                          checked={seleccion.elegidas.has(clave(f))}
                          onChange={(e) => {
                            const n = new Set(seleccion.elegidas)
                            if (e.target.checked) n.add(clave(f))
                            else n.delete(clave(f))
                            seleccion.alCambiar(n)
                          }}
                        />
                      )}
                      <div className="min-w-0 text-sm">{titulo?.celda(f)}</div>
                    </div>
                    {accion && <div className="shrink-0">{accion.celda(f)}</div>}
                  </div>
                  {resto.length > 0 && (
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13px]">
                      {resto.map((col) => (
                        <div key={col.clave} className={`min-w-0 ${col.movil === 'ancha' ? 'col-span-2' : ''}`}>
                          {col.titulo && <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{col.titulo}</dt>}
                          <dd className="min-w-0 break-words">{col.celda(f)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </li>
              )
            })}
            {pagina_.length === 0 && <li className="px-4 py-10 text-center text-sm text-slate-500">{vacio}</li>}
          </ul>
        </div>
      )}

      <div className={`max-h-[70vh] overflow-auto ${pie ? '' : 'hidden sm:block'}`}>
        <table className="w-full text-left text-[13px]">
          <thead className="sticky top-0 z-20 bg-fondo shadow-[0_1px_0_0_#E2E8F0]">
            <tr className="text-[11px] uppercase tracking-wide text-slate-500">
              {seleccion && (
                <th rowSpan={2} className="w-8 px-2 align-middle">
                  <input
                    type="checkbox"
                    aria-label="Elegir todas las filas filtradas"
                    checked={visibles.length > 0 && visibles.every((f) => seleccion.elegidas.has(clave(f)))}
                    onChange={(e) => {
                      const n = new Set(seleccion.elegidas)
                      for (const f of visibles) {
                        if (e.target.checked) n.add(clave(f))
                        else n.delete(clave(f))
                      }
                      seleccion.alCambiar(n)
                    }}
                  />
                </th>
              )}
              {columnas.map((col, i) => (
                <th
                  key={col.clave}
                  className={`px-2 pb-1 pt-2.5 align-bottom font-semibold leading-tight ${col.derecha ? 'text-right' : ''} ${i === 0 && !seleccion ? FIJA + ' bg-fondo' : ''}`}
                >
                  {col.orden ? (
                    <button
                      type="button"
                      onClick={() => ordenar(col)}
                      className={`inline-flex items-end gap-1 text-left uppercase hover:text-noche ${orden?.clave === col.clave ? 'text-noche' : ''}`}
                      title={orden?.clave === col.clave ? (orden.dir === 'desc' ? 'Ordenar de menor a mayor' : 'Volver al orden original') : 'Ordenar (las que no tienen dato quedan al final)'}
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
              {columnas.map((col, i) => (
                <th key={col.clave} className={`px-2 pb-2 font-normal ${i === 0 && !seleccion ? FIJA + ' bg-fondo' : ''}`}>
                  {conFiltro(col) && (
                    <select
                      value={filtros[col.clave] ?? TODOS}
                      onChange={(e) => {
                        setFiltros((f) => ({ ...f, [col.clave]: e.target.value }))
                        setPagina(1)
                      }}
                      className={`w-full min-w-[4.5rem] max-w-40 rounded-md border px-1 py-1 text-xs ${
                        filtros[col.clave] && filtros[col.clave] !== TODOS
                          ? 'border-marca bg-marca/5 font-semibold text-marca'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                      aria-label={`Filtrar ${col.titulo}`}
                    >
                      <option value={TODOS}>Todos</option>
                      {(opciones[col.clave] ?? []).map((o) => (
                        <option key={o.valor} value={o.valor}>
                          {o.valor} ({o.cantidad.toLocaleString('es-AR')})
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
              <tr
                key={clave(f)}
                onClick={onFila ? () => onFila(f) : undefined}
                className={`group even:bg-slate-50/70 ${onFila ? 'cursor-pointer hover:bg-marca/5' : ''}`}
              >
                {seleccion && (
                  <td className="w-8 px-2 py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label="Elegir esta fila"
                      checked={seleccion.elegidas.has(clave(f))}
                      onChange={(e) => {
                        const n = new Set(seleccion.elegidas)
                        if (e.target.checked) n.add(clave(f))
                        else n.delete(clave(f))
                        seleccion.alCambiar(n)
                      }}
                    />
                  </td>
                )}
                {columnas.map((col, i) => (
                  <td
                    key={col.clave}
                    className={`px-2 py-2 ${col.derecha ? 'text-right tabular-nums' : ''} ${col.clase ?? ''} ${i === 0 && !seleccion ? FIJA + ' bg-white group-even:bg-slate-50 group-hover:bg-indigo-50' : ''}`}
                  >
                    {col.celda(f)}
                  </td>
                ))}
              </tr>
            ))}
            {pagina_.length === 0 && (
              <tr>
                <td colSpan={columnas.length + (seleccion ? 1 : 0)} className="px-4 py-10 text-center text-slate-500">
                  {fueraDeFiltros > 0 ? (
                    <>
                      No aparece con los filtros elegidos, pero hay {fueraDeFiltros} {fueraDeFiltros === 1 ? 'resultado' : 'resultados'} en
                      otros meses o filtros.{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setFiltros({})
                          setPagina(1)
                        }}
                        className="font-semibold text-marca hover:underline"
                      >
                        Buscar en todo
                      </button>
                    </>
                  ) : (
                    vacio
                  )}
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
