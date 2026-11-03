import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, FileSpreadsheet, ScanLine, Search } from 'lucide-react'
import { FiltroMes, FiltroSucursal } from '../components/Filtros'
import { LegajoPanel } from '../components/LegajoPanel'
import { AYUDA_ETAPA, BadgeEtapa, ETAPAS_ACTIVAS, nombreEtapa, quienEtapa } from '../components/ui/Badges'
import { BotonExportar, Card, EncabezadoPagina } from '../components/ui/Card'
import { claseSelect } from '../components/ui/Estados'
import { useApp, useComprobantes } from '../context/AppContext'
import { ultimoReclamo } from '../domain/reclamos'
import { calcularSemaforo } from '../domain/semaforo'
import type { Etapa } from '../domain/tipos'
import { diffDias, enMes } from '../lib/fechas'
import { descargarExcel, fechaExcel } from '../lib/exportar'
import { formatoComprobante, formatoFecha, formatoPesos, MESES } from '../lib/formato'

const POR_PAGINA = 25
type FiltroEtapa = Etapa | 'todas'

/**
 * Control diario: la misma información y el mismo orden de columnas que la hoja
 * "Diario" de la planilla, con el estado calculado y el legajo a un clic.
 */
export default function ControlDiario() {
  const { datos, anio, mes, hoy } = useApp()
  const comprobantes = useComprobantes()
  const { aseguradoras } = datos!
  const [params, setParams] = useSearchParams()

  // Los filtros de etapa y período viven en la URL: así los links del Inicio llegan ya filtrados.
  const etapa = (params.get('etapa') ?? 'todas') as FiltroEtapa
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
      .map((c) => ({ c, semaforo: calcularSemaforo(c, hoy) }))
      .filter(({ c, semaforo: s }) => {
        if (periodo === 'mes' && !enMes(c.fecha, anio, mes)) return false
        if (etapa !== 'todas' && s.etapa !== etapa) return false
        if (compania !== 'todas' && c.aseguradoraId !== compania) return false
        if (texto) {
          const campos = [c.ref, formatoComprobante(c), c.patente, c.siniestro, c.observaciones].join(' ').toLowerCase()
          if (!campos.includes(texto)) return false
        }
        return true
      })
      .sort((a, b) => b.c.fecha.localeCompare(a.c.fecha) || b.c.numero - a.c.numero)
  }, [comprobantes, periodo, anio, mes, etapa, compania, busqueda, hoy])

  const totalFiltrado = filas.reduce((s, f) => s + f.c.total, 0)
  const totalPaginas = Math.max(1, Math.ceil(filas.length / POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const visibles = filas.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA)
  const seleccionado = comprobantes.find((c) => c.id === seleccionadoId) ?? null
  const conteo = (e: Etapa) => filas.filter((f) => f.semaforo.etapa === e).length

  function exportar() {
    descargarExcel(
      `control-diario-${periodo === 'mes' ? `${anio}-${mes}` : anio}`,
      ['Fecha', 'Ref.', 'Sucursal', 'CTE.', 'Número', 'Compañía', 'Siniestro/Patente', 'Total', 'En Drive', 'Días', 'Presentación', 'Días', 'Vto.', 'Fecha de cobro', 'Estado', 'Le toca a', 'Reclamos', 'Último reclamo', 'Observaciones'],
      filas.map(({ c, semaforo: s }) => [
        fechaExcel(c.fecha),
        c.ref,
        c.sucursal,
        `${c.tipo} E`,
        `${c.puntoVenta} - ${String(c.numero).padStart(8, '0')}`,
        nombreCompania[c.aseguradoraId],
        [c.siniestro, c.patente].filter(Boolean).join(' · '),
        c.total,
        fechaExcel(c.fechaDrive),
        c.fechaDrive ? diffDias(c.fecha, c.fechaDrive) : null,
        fechaExcel(c.fechaPresentacion),
        c.fechaPresentacion ? diffDias(c.fecha, c.fechaPresentacion) : null,
        fechaExcel(c.vencimiento),
        fechaExcel(c.fechaCobro),
        nombreEtapa(s.etapa),
        quienEtapa(s.etapa),
        c.reclamos.length || null,
        fechaExcel(ultimoReclamo(c)),
        c.observaciones || null,
      ]),
    )
  }

  const botonEtapa2 =
    'inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-400'

  return (
    <>
      <EncabezadoPagina
        titulo="Control diario"
        subtitulo={periodo === 'mes' ? `Facturas y NC de ${MESES[mes - 1].toLowerCase()} ${anio}` : `Todas las facturas y NC de ${anio}`}
        acciones={
          <>
            <button type="button" disabled className={botonEtapa2} title="Disponible en la etapa 2">
              <FileSpreadsheet className="h-4 w-4" /> Cargar Excel del ERP
            </button>
            <button type="button" disabled className={botonEtapa2} title="Disponible en la etapa 2">
              <ScanLine className="h-4 w-4" /> Subir escaneo
            </button>
            <BotonExportar onClick={exportar} />
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
              placeholder="Buscar por ref., número, siniestro, patente u observación"
              className={`${claseSelect} w-full pl-9`}
            />
          </label>
          <FiltroSucursal />
          <select className={claseSelect} value={periodo} onChange={(e) => cambiarParam('periodo', e.target.value)}>
            <option value="mes">Un mes</option>
            <option value="anio">Todo el año</option>
          </select>
          {periodo === 'mes' && <FiltroMes />}
          <select className={claseSelect} value={etapa} onChange={(e) => cambiarParam('etapa', e.target.value)}>
            <option value="todas">Todos los estados</option>
            {(['doc_pendiente', 'doc_atrasada', 'doc_observada', 'pres_pendiente', 'al_dia', 'vencida', 'cobrado', 'no_aplica'] as Etapa[]).map(
              (e) => (
                <option key={e} value={e}>
                  {nombreEtapa(e)} · {AYUDA_ETAPA[e].toLowerCase()}
                </option>
              ),
            )}
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
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          <span className="font-semibold text-noche">
            {filas.length.toLocaleString('es-AR')} comprobantes · {formatoPesos(totalFiltrado)}
          </span>
          {ETAPAS_ACTIVAS.map((e) => (
            <span key={e}>
              {nombreEtapa(e)}: <strong>{conteo(e)}</strong>
            </span>
          ))}
          <span>
            Cobrado: <strong>{conteo('cobrado')}</strong>
          </span>
        </div>
      </Card>

      <Card className="mt-4 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-fondo uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3 font-semibold">Fecha</th>
                <th className="px-2 py-3 font-semibold">Ref.</th>
                <th className="px-2 py-3 font-semibold">Sucursal</th>
                <th className="px-2 py-3 font-semibold">Comprobante</th>
                <th className="px-2 py-3 font-semibold">Compañía</th>
                <th className="px-2 py-3 font-semibold">Siniestro / patente</th>
                <th className="px-2 py-3 text-right font-semibold">Total</th>
                <th className="px-2 py-3 font-semibold">En Drive</th>
                <th className="px-2 py-3 font-semibold">Presentación</th>
                <th className="px-2 py-3 font-semibold">Vto.</th>
                <th className="px-2 py-3 font-semibold">Cobro</th>
                <th className="px-2 py-3 font-semibold">Estado</th>
                <th className="px-3 py-3 font-semibold">Observaciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {visibles.map(({ c, semaforo: s }) => (
                <tr key={c.id} onClick={() => setSeleccionadoId(c.id)} className="cursor-pointer hover:bg-marca/5" title={s.detalle.join(' · ')}>
                  <td className="px-3 py-2 whitespace-nowrap">{formatoFecha(c.fecha)}</td>
                  <td className="px-2 py-2 text-slate-500">{c.ref}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{c.sucursal}</td>
                  <td className="px-2 py-2 whitespace-nowrap font-medium">{formatoComprobante(c)}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{nombreCompania[c.aseguradoraId]}</td>
                  <td className="px-2 py-2 whitespace-nowrap text-slate-600">{[c.siniestro, c.patente].filter(Boolean).join(' · ')}</td>
                  <td className={`px-2 py-2 text-right whitespace-nowrap font-semibold tabular-nums ${c.total < 0 ? 'text-sem-rojo' : ''}`}>
                    {formatoPesos(c.total)}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {formatoFecha(c.fechaDrive)}
                    {c.fechaDrive && <span className="ml-1 text-xs text-slate-400">{diffDias(c.fecha, c.fechaDrive)} d</span>}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {formatoFecha(c.fechaPresentacion)}
                    {c.fechaPresentacion && <span className="ml-1 text-xs text-slate-400">{diffDias(c.fecha, c.fechaPresentacion)} d</span>}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">{formatoFecha(c.vencimiento)}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{formatoFecha(c.fechaCobro)}</td>
                  <td className="px-2 py-2">
                    <BadgeEtapa etapa={s.etapa} />
                    {c.reclamos.length > 0 && <div className="mt-0.5 text-[11px] text-slate-500">{c.reclamos.length} reclamo(s)</div>}
                  </td>
                  <td className="max-w-56 truncate px-3 py-2 text-xs text-slate-600">{c.observaciones}</td>
                </tr>
              ))}
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-10 text-center text-slate-500">
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
