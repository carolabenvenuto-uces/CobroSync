import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, FileSpreadsheet, ScanLine, Search } from 'lucide-react'
import { LegajoPanel } from '../components/LegajoPanel'
import { BadgeEstado, PuntoSemaforo } from '../components/ui/Badges'
import { Card, EncabezadoPagina } from '../components/ui/Card'
import { claseSelect } from '../components/ui/Estados'
import { useApp, useComprobantes } from '../context/AppContext'
import { calcularSemaforo } from '../domain/semaforo'
import type { ColorSemaforo } from '../domain/tipos'
import { diffDias, enMes } from '../lib/fechas'
import { formatoComprobante, formatoFecha, formatoPesos, MESES } from '../lib/formato'

const POR_PAGINA = 20
type FiltroSemaforo = ColorSemaforo | 'todos'

export default function ControlDiario() {
  const { datos, anio, mes } = useApp()
  const comprobantes = useComprobantes()
  const { aseguradoras } = datos!
  const [params, setParams] = useSearchParams()

  // Los filtros viven en la URL (?semaforo=rojo&periodo=anio): así los links del dashboard funcionan.
  const semaforo = (params.get('semaforo') ?? 'todos') as FiltroSemaforo
  const periodo = params.get('periodo') === 'anio' ? 'anio' : 'mes'
  const [busqueda, setBusqueda] = useState('')
  const [compania, setCompania] = useState('todas')
  const [pagina, setPagina] = useState(1)
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null)

  function cambiarParam(clave: string, valor: string) {
    const nuevos = new URLSearchParams(params)
    nuevos.set(clave, valor)
    setParams(nuevos, { replace: true })
    setPagina(1)
  }

  const nombreCompania = useMemo(
    () => Object.fromEntries(aseguradoras.map((a) => [a.id, a.nombre])) as Record<string, string>,
    [aseguradoras],
  )

  const filas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return comprobantes
      .map((c) => ({ c, semaforo: calcularSemaforo(c) }))
      .filter(({ c, semaforo: s }) => {
        if (periodo === 'mes' && !enMes(c.fecha, anio, mes)) return false
        if (semaforo !== 'todos' && s.color !== semaforo) return false
        if (compania !== 'todas' && c.aseguradoraId !== compania) return false
        if (texto) {
          const campos = [c.ref, formatoComprobante(c), c.patente, c.siniestro].join(' ').toLowerCase()
          if (!campos.includes(texto)) return false
        }
        return true
      })
      .sort((a, b) => b.c.fecha.localeCompare(a.c.fecha) || b.c.numero - a.c.numero)
  }, [comprobantes, periodo, anio, mes, semaforo, compania, busqueda])

  const totalPaginas = Math.max(1, Math.ceil(filas.length / POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const visibles = filas.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA)
  const seleccionado = comprobantes.find((c) => c.id === seleccionadoId) ?? null

  const conteo: Record<ColorSemaforo, number> = { rojo: 0, amarillo: 0, verde: 0, neutro: 0 }
  for (const f of filas) conteo[f.semaforo.color] += 1

  const botonEtapa2 =
    'inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-400'

  return (
    <>
      <EncabezadoPagina
        titulo="Control diario y legajos"
        subtitulo={periodo === 'mes' ? `${MESES[mes - 1]} ${anio}` : `Todo ${anio}`}
        acciones={
          <>
            <button type="button" disabled className={botonEtapa2} title="Disponible en la etapa 2">
              <FileSpreadsheet className="h-4 w-4" /> Cargar Excel del ERP
            </button>
            <button type="button" disabled className={botonEtapa2} title="Disponible en la etapa 2">
              <ScanLine className="h-4 w-4" /> Subir escaneo
            </button>
          </>
        }
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value)
                setPagina(1)
              }}
              placeholder="Buscar por ref., número, patente o siniestro"
              className={`${claseSelect} w-full pl-9`}
            />
          </label>
          <select className={claseSelect} value={periodo} onChange={(e) => cambiarParam('periodo', e.target.value)}>
            <option value="mes">Mes seleccionado</option>
            <option value="anio">Todo el año</option>
          </select>
          <select className={claseSelect} value={semaforo} onChange={(e) => cambiarParam('semaforo', e.target.value)}>
            <option value="todos">Todos los estados</option>
            <option value="rojo">Rojo: bloqueados</option>
            <option value="amarillo">Amarillo: en curso</option>
            <option value="verde">Verde: cobrados</option>
            <option value="neutro">Anulados y NC</option>
          </select>
          <select
            className={claseSelect}
            value={compania}
            onChange={(e) => {
              setCompania(e.target.value)
              setPagina(1)
            }}
          >
            <option value="todas">Todas las compañías</option>
            {aseguradoras.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
          <span>{filas.length} comprobantes</span>
          {(['rojo', 'amarillo', 'verde'] as const).map((color) => (
            <span key={color} className="flex items-center gap-1.5">
              <PuntoSemaforo color={color} /> {conteo[color]}
            </span>
          ))}
        </div>
      </Card>

      <Card className="mt-4 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-fondo text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold" aria-label="Semáforo" />
                <th className="px-3 py-3 font-semibold">Fecha</th>
                <th className="px-3 py-3 font-semibold">Ref.</th>
                <th className="px-3 py-3 font-semibold">Sucursal</th>
                <th className="px-3 py-3 font-semibold">Comprobante</th>
                <th className="px-3 py-3 font-semibold">Compañía</th>
                <th className="px-3 py-3 font-semibold">Siniestro / patente</th>
                <th className="px-3 py-3 text-right font-semibold">Total</th>
                <th className="px-3 py-3 font-semibold">Drive</th>
                <th className="px-3 py-3 font-semibold">Presentación</th>
                <th className="px-3 py-3 font-semibold">Vto.</th>
                <th className="px-3 py-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibles.map(({ c, semaforo: s }) => (
                <tr
                  key={c.id}
                  onClick={() => setSeleccionadoId(c.id)}
                  className="cursor-pointer hover:bg-marca/5"
                  title={s.detalle.join(' · ')}
                >
                  <td className="px-4 py-2.5">
                    <PuntoSemaforo color={s.color} />
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{formatoFecha(c.fecha)}</td>
                  <td className="px-3 py-2.5 text-slate-500">{c.ref}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{c.sucursal}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap font-medium">{formatoComprobante(c)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{nombreCompania[c.aseguradoraId]}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">
                    {c.siniestro} · {c.patente}
                  </td>
                  <td className={`px-3 py-2.5 text-right whitespace-nowrap font-semibold ${c.total < 0 ? 'text-sem-rojo' : ''}`}>
                    {formatoPesos(c.total)}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {formatoFecha(c.fechaDrive)}
                    {c.fechaDrive && <span className="ml-1 text-xs text-slate-400">+{diffDias(c.fecha, c.fechaDrive)}</span>}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {formatoFecha(c.fechaPresentacion)}
                    {c.fechaPresentacion && c.fechaDrive && (
                      <span className="ml-1 text-xs text-slate-400">+{diffDias(c.fechaDrive, c.fechaPresentacion)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{formatoFecha(c.vencimiento)}</td>
                  <td className="px-3 py-2.5">
                    <BadgeEstado estado={c.estado} />
                  </td>
                </tr>
              ))}
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-slate-500">
                    No hay comprobantes con estos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
          <span className="text-slate-500">
            Página {paginaActual} de {totalPaginas}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPagina(paginaActual - 1)}
              disabled={paginaActual === 1}
              className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40"
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPagina(paginaActual + 1)}
              disabled={paginaActual === totalPaginas}
              className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40"
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Card>

      {seleccionado && <LegajoPanel comprobante={seleccionado} onCerrar={() => setSeleccionadoId(null)} />}
    </>
  )
}
