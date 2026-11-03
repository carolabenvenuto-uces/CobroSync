import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FileSpreadsheet, Info, X } from 'lucide-react'
import { FiltroSucursal } from '../components/Filtros'
import { BadgeEtapa, nombreEtapa, quienEtapa } from '../components/ui/Badges'
import { EncabezadoPagina } from '../components/ui/Card'
import { Tabla, type Columna } from '../components/ui/Tabla'
import { useApp, useComprobantes } from '../context/AppContext'
import { ultimoReclamo } from '../domain/reclamos'
import { calcularSemaforo } from '../domain/semaforo'
import type { Comprobante } from '../domain/tipos'
import { diffDias } from '../lib/fechas'
import { descargarExcel, fechaExcel } from '../lib/exportar'
import { formatoComprobante, formatoFecha, formatoPesos, MESES } from '../lib/formato'
import { importarErp } from '../services/erp'
import { leerArchivo } from '../services/planilla'

/** "2026-10 · Octubre": así el filtro de mes queda ordenado. */
const mesDeFecha = (iso: string) => `${iso.slice(0, 7)} · ${MESES[Number(iso.slice(5, 7)) - 1]}`

function avisoNc(c: Comprobante): string {
  if (c.tipo !== 'NC') return ''
  return c.ncInformada ? 'Informada' : 'Sin aviso'
}

/**
 * Control diario: la hoja "Diario" de la planilla, con el estado calculado y el legajo a un clic.
 * Para Gerencia es "Buscar una factura": la misma tabla, solo para consultar.
 */
export default function ControlDiario() {
  const { datos, hoy, rol, abrirLegajo, agregarComprobante } = useApp()
  const filtradosPorSucursal = useComprobantes()
  const { aseguradoras, meta } = datos!
  const [params] = useSearchParams()
  const soloConsulta = rol === 'gerencia'
  // Gerencia filtra la sucursal desde la columna: busca siempre en todas
  const comprobantes = soloConsulta ? datos!.comprobantes : filtradosPorSucursal
  const entradaErp = useRef<HTMLInputElement>(null)
  const [mensajeErp, setMensajeErp] = useState<{ texto: string; error?: boolean } | null>(null)

  const nombreCompania = useMemo(
    () => Object.fromEntries(aseguradoras.map((a) => [a.id, a.nombre])) as Record<string, string>,
    [aseguradoras],
  )

  const filas = useMemo(() => comprobantes.map((c) => ({ c, s: calcularSemaforo(c, hoy) })), [comprobantes, hoy])
  type Fila = (typeof filas)[number]

  // Auditoría arranca en el mes en curso (si no viene un filtro desde un aviso).
  // Gerencia busca facturas de cualquier mes: arranca sin filtro de fecha.
  const filtrosIniciales =
    [...params.keys()].length > 0 ? Object.fromEntries(params.entries()) : soloConsulta ? {} : { mes: mesDeFecha(hoy) }

  async function cargarErp(archivo: File | undefined) {
    if (!archivo) return
    try {
      const texto = await leerArchivo(archivo)
      const r = importarErp(texto, datos!.comprobantes, aseguradoras, meta.sucursales, hoy)
      r.nuevas.forEach(agregarComprobante)
      setMensajeErp({
        texto: `Se agregaron ${r.nuevas.length} facturas nuevas en "Doc. pendiente". ${r.repetidas} ya estaban cargadas y ${r.ignoradas} filas no eran de compañías de seguros o no se pudieron leer.`,
      })
    } catch (e) {
      setMensajeErp({ texto: e instanceof Error ? e.message : 'No se pudo leer el archivo.', error: true })
    }
    if (entradaErp.current) entradaErp.current.value = ''
  }

  const diasHasta = (desde: string, hasta: string | null) =>
    hasta ? <span className="ml-1 text-xs text-slate-400">{diffDias(desde, hasta)} d</span> : null

  const columnas: Columna<Fila>[] = [
    {
      clave: 'mes',
      titulo: 'Fecha',
      orden: (x) => x.c.fecha,
      filtro: (x) => mesDeFecha(x.c.fecha),
      celda: (x) => <span className="whitespace-nowrap">{formatoFecha(x.c.fecha)}</span>,
    },
    { clave: 'ref', titulo: 'Ref.', orden: (x) => x.c.ref, celda: (x) => <span className="text-slate-500">{x.c.ref}</span> },
    { clave: 'sucursal', titulo: 'Sucursal', filtro: (x) => x.c.sucursal, celda: (x) => <span className="whitespace-nowrap">{x.c.sucursal}</span> },
    {
      clave: 'comprobante',
      titulo: 'Comprobante',
      filtro: (x) => (x.c.tipo === 'NC' ? 'Nota de crédito' : 'Factura'),
      celda: (x) => <span className="whitespace-nowrap font-medium">{formatoComprobante(x.c)}</span>,
    },
    {
      clave: 'compania',
      titulo: 'Compañía',
      filtro: (x) => nombreCompania[x.c.aseguradoraId] ?? x.c.aseguradoraId,
      celda: (x) => <span className="whitespace-nowrap">{nombreCompania[x.c.aseguradoraId]}</span>,
    },
    { clave: 'siniestro', titulo: 'Siniestro', celda: (x) => <span className="whitespace-nowrap text-slate-600">{x.c.siniestro}</span> },
    { clave: 'patente', titulo: 'Patente', celda: (x) => <span className="whitespace-nowrap text-slate-600">{x.c.patente}</span> },
    {
      clave: 'total',
      titulo: 'Total',
      derecha: true,
      orden: (x) => x.c.total,
      celda: (x) => <span className={`whitespace-nowrap font-semibold tabular-nums ${x.c.total < 0 ? 'text-sem-rojo' : ''}`}>{formatoPesos(x.c.total)}</span>,
    },
    {
      clave: 'subida',
      titulo: 'Subida',
      orden: (x) => x.c.fechaDrive,
      celda: (x) => (
        <span className="whitespace-nowrap">
          {formatoFecha(x.c.fechaDrive)}
          {diasHasta(x.c.fecha, x.c.fechaDrive)}
        </span>
      ),
    },
    {
      clave: 'presentacion',
      titulo: 'Presentación',
      orden: (x) => x.c.fechaPresentacion,
      celda: (x) => (
        <span className="whitespace-nowrap">
          {formatoFecha(x.c.fechaPresentacion)}
          {diasHasta(x.c.fecha, x.c.fechaPresentacion)}
        </span>
      ),
    },
    { clave: 'vto', titulo: 'Vto.', orden: (x) => x.c.vencimiento, celda: (x) => <span className="whitespace-nowrap">{formatoFecha(x.c.vencimiento)}</span> },
    { clave: 'cobro', titulo: 'Cobro', orden: (x) => x.c.fechaCobro, celda: (x) => <span className="whitespace-nowrap">{formatoFecha(x.c.fechaCobro)}</span> },
    {
      clave: 'estado',
      titulo: 'Estado',
      filtro: (x) => nombreEtapa(x.s.etapa),
      celda: (x) => (
        <div title={x.s.detalle.join(' · ')}>
          <BadgeEtapa etapa={x.s.etapa} />
          {x.c.reclamos.length > 0 && <div className="mt-0.5 text-[11px] text-slate-500">{x.c.reclamos.length} reclamo(s)</div>}
        </div>
      ),
    },
    {
      clave: 'nc',
      titulo: 'Aviso de NC',
      filtro: (x) => avisoNc(x.c),
      celda: (x) =>
        x.c.tipo === 'NC' ? (
          <span className={`whitespace-nowrap text-xs ${x.c.ncInformada ? 'text-slate-600' : 'font-semibold text-sem-rojo'}`}>{avisoNc(x.c)}</span>
        ) : null,
    },
    { clave: 'obs', titulo: 'Observaciones', celda: (x) => <span className="block max-w-56 truncate text-xs text-slate-600">{x.c.observaciones}</span> },
  ]

  function exportar(lista: Fila[]) {
    descargarExcel(
      `control-diario-${hoy}`,
      ['Fecha', 'Ref.', 'Sucursal', 'CTE.', 'Número', 'Compañía', 'Siniestro', 'Patente', 'Total', 'Subida', 'Días', 'Presentación', 'Días', 'Vto.', 'Fecha de cobro', 'Estado', 'Le toca a', 'Aviso de NC', 'Reclamos', 'Último reclamo', 'Observaciones'],
      lista.map(({ c, s }) => [
        fechaExcel(c.fecha),
        c.ref,
        c.sucursal,
        `${c.tipo} E`,
        `${c.puntoVenta} - ${String(c.numero).padStart(8, '0')}`,
        nombreCompania[c.aseguradoraId],
        c.siniestro || null,
        c.patente || null,
        c.total,
        fechaExcel(c.fechaDrive),
        c.fechaDrive ? diffDias(c.fecha, c.fechaDrive) : null,
        fechaExcel(c.fechaPresentacion),
        c.fechaPresentacion ? diffDias(c.fecha, c.fechaPresentacion) : null,
        fechaExcel(c.vencimiento),
        fechaExcel(c.fechaCobro),
        nombreEtapa(s.etapa),
        quienEtapa(s.etapa),
        avisoNc(c) || null,
        c.reclamos.length || null,
        fechaExcel(ultimoReclamo(c)),
        c.observaciones || null,
      ]),
    )
  }

  return (
    <>
      <EncabezadoPagina
        titulo={soloConsulta ? 'Buscar una factura' : 'Control diario'}
        subtitulo={
          soloConsulta
            ? 'Escribí el número, el siniestro o la patente y tocá la fila para ver en qué está'
            : 'Todas las facturas y notas de crédito, como la hoja "Diario" de la planilla'
        }
        acciones={
          <>
            {!soloConsulta && <FiltroSucursal />}
            {!soloConsulta && (
              <>
                <input ref={entradaErp} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => cargarErp(e.target.files?.[0])} />
                <button
                  type="button"
                  onClick={() => entradaErp.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-noche hover:bg-fondo"
                  title="Elegí la exportación de facturas del ERP guardada como CSV"
                >
                  <FileSpreadsheet className="h-4 w-4" /> Cargar Excel del ERP
                </button>
              </>
            )}
          </>
        }
      />

      {mensajeErp && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
            mensajeErp.error ? 'border-sem-rojo/30 bg-sem-rojo/5 text-red-900' : 'border-marca/20 bg-marca/5 text-blue-900'
          }`}
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            {mensajeErp.texto}
            {!mensajeErp.error && (
              <div className="mt-1 text-xs">
                Es una vista previa: <strong>no se guarda</strong> y se pierde al recargar la página. Guardarlo queda para la etapa 2 (Google).
              </div>
            )}
          </div>
          <button type="button" onClick={() => setMensajeErp(null)} aria-label="Cerrar" className="text-slate-500 hover:text-noche">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <Tabla
        key={params.toString()}
        filas={filas}
        columnas={columnas}
        clave={(x) => x.c.id}
        onFila={(x) => abrirLegajo(x.c.id)}
        buscar={(x) => [x.c.ref, formatoComprobante(x.c), x.c.siniestro, x.c.patente, x.c.observaciones].join(' ')}
        textoBusqueda="Buscar por ref., número de factura, siniestro, patente u observación"
        filtrosIniciales={filtrosIniciales}
        ordenInicial={{ clave: 'mes', dir: 'desc' }}
        exportar={exportar}
        resumen={(l) => (
          <>
            <strong>{l.length.toLocaleString('es-AR')}</strong> comprobantes · <strong>{formatoPesos(l.reduce((s, x) => s + x.c.total, 0))}</strong>
          </>
        )}
        vacio="No hay comprobantes con estos filtros."
      />
    </>
  )
}
