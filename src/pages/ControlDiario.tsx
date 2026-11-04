import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FileSpreadsheet, Info, X } from 'lucide-react'
import { BadgeEtapa, ETAPAS_ACTIVAS, nombreEtapa, quienEtapa } from '../components/ui/Badges'
import { EncabezadoPagina } from '../components/ui/Card'
import { Tabla, type Columna } from '../components/ui/Tabla'
import { useApp, useComprobantes } from '../context/AppContext'
import { ultimoReclamo } from '../domain/reclamos'
import { calcularSemaforo, enGrupo, GRUPOS_SALDO, type GrupoSaldo } from '../domain/semaforo'
import { saldoFactura } from '../domain/importes'
import { claveSiniestro, contarPorSiniestro } from '../domain/siniestros'
import type { Comprobante, Etapa } from '../domain/tipos'
import { diffDias } from '../lib/fechas'
import { descargarExcel, fechaExcel } from '../lib/exportar'
import { formatoComprobante, formatoFecha, formatoPesos, MESES } from '../lib/formato'
import { filasDeDatosErp, importarErp } from '../services/erp'
import { agregarAQuiterEnGoogle, conectadoAGoogle } from '../services/google'
import { leerArchivo } from '../services/planilla'

/** "2026-10 · Octubre": así el filtro de mes queda ordenado. */
const ORDEN_ETAPAS: Etapa[] = [...ETAPAS_ACTIVAS, 'cobrado', 'no_aplica']
const mesDeFecha = (iso: string) => `${iso.slice(0, 7)} · ${MESES[Number(iso.slice(5, 7)) - 1]}`

function avisoNc(c: Comprobante): string {
  if (c.tipo === 'FC') return c.anulacionInformada && c.estado !== 'anulada' ? 'Anulación informada' : c.acreditado ? 'NC parcial' : ''
  return c.ncInformada ? 'Informada' : 'Sin aviso'
}

/**
 * Control diario: la hoja "Diario" de la planilla, con el estado calculado y el legajo a un clic.
 * Para Gerencia es "Detalle de facturas": la misma tabla, solo para consultar (por si necesita buscar una).
 */
export default function ControlDiario() {
  const { datos, hoy, rol, fuente, abrirLegajo, agregarComprobante, actualizarComprobante, registrarEvento } = useApp()
  const filtradosPorSucursal = useComprobantes()
  const { aseguradoras, meta } = datos!
  const [params, setParams] = useSearchParams()
  const soloConsulta = rol === 'gerencia'
  // Gerencia filtra la sucursal desde la columna: busca siempre en todas
  const comprobantes = soloConsulta ? datos!.comprobantes : filtradosPorSucursal
  const porSiniestro = useMemo(() => contarPorSiniestro(datos!.comprobantes), [datos])
  const entradaErp = useRef<HTMLInputElement>(null)
  const [mensajeErp, setMensajeErp] = useState<{ texto: string; error?: boolean } | null>(null)

  const nombreCompania = useMemo(
    () => Object.fromEntries(aseguradoras.map((a) => [a.id, a.nombre])) as Record<string, string>,
    [aseguradoras],
  )

  // Desde las tarjetas del Resumen llega ?grupo=vencido (o sin_presentar, al_dia, pendiente)
  const grupoParam = params.get('grupo')
  const grupo = grupoParam && grupoParam in GRUPOS_SALDO ? (grupoParam as GrupoSaldo) : null
  const filas = useMemo(
    () =>
      comprobantes
        .map((c) => ({ c, s: calcularSemaforo(c, hoy) }))
        .filter((x) => !grupo || enGrupo(grupo, x.s.etapa, saldoFactura(x.c))),
    [comprobantes, hoy, grupo],
  )
  function quitarGrupo() {
    const nuevos = new URLSearchParams(params)
    nuevos.delete('grupo')
    setParams(nuevos)
  }
  type Fila = (typeof filas)[number]

  // Auditoría arranca en el mes en curso (si no viene un filtro desde un aviso).
  // Gerencia busca facturas de cualquier mes: arranca sin filtro de fecha.
  // Novedades: lo que entró con la última carga del ERP y lo que se movió desde ayer
  const ERP = 'Factura cargada desde el Excel del ERP'
  const ultimaCarga = useMemo(
    () => comprobantes.reduce((m, c) => c.eventos.reduce((n, e) => (e.texto === ERP && e.fecha > n ? e.fecha : n), m), ''),
    [comprobantes],
  )
  const ayer = useMemo(() => {
    const d = new Date(`${hoy}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - 1)
    return d.toISOString().slice(0, 10)
  }, [hoy])
  const novedad = (c: Comprobante): string => {
    if (ultimaCarga && c.eventos.some((e) => e.texto === ERP && e.fecha === ultimaCarga)) return 'Nueva (último ERP)'
    if (c.eventos.some((e) => e.fecha >= ayer && e.texto !== ERP)) return 'Con cambios desde ayer'
    return ''
  }
  const cuentaNovedad = (n: string) => comprobantes.filter((c) => novedad(c) === n).length

  const filtrosIniciales =
    [...params.keys()].length > 0
      ? Object.fromEntries([...params.entries()].filter(([k]) => k !== 'grupo'))
      : soloConsulta
        ? {}
        : { mes: mesDeFecha(hoy) }

  async function cargarErp(archivo: File | undefined) {
    if (!archivo) return
    try {
      const texto = await leerArchivo(archivo, /quiter|erp|factur/i)
      const r = importarErp(texto, datos!.comprobantes, aseguradoras, meta.sucursales, hoy)
      r.nuevas.forEach(agregarComprobante)
      // Notas de crédito que la sucursal había avisado: total → anula; parcial → resta del saldo
      r.vinculadas.forEach(({ facturaId, ncId, tipo, importe }) => {
        const nc = r.nuevas.find((x) => x.id === ncId)
        const factura = datos!.comprobantes.find((x) => x.id === facturaId)
        const numero = nc ? formatoComprobante(nc) : ''
        if (tipo === 'total') {
          actualizarComprobante(facturaId, { estado: 'anulada', anulacionInformada: null })
          registrarEvento(facturaId, 'nota_credito', `Anulada con la nota de crédito ${numero} (vinculada al cargar el ERP)`)
        } else {
          actualizarComprobante(facturaId, { acreditado: (factura?.acreditado ?? 0) + importe, anulacionInformada: null })
          registrarEvento(facturaId, 'nota_credito', `Nota de crédito parcial ${numero} por ${formatoPesos(importe)} (vinculada al cargar el ERP)`)
        }
      })
      // Con Google, las mismas filas van también al final de la pestaña Quiter de la planilla de control
      let enPlanilla = ''
      if (conectadoAGoogle()) {
        try {
          const q = await agregarAQuiterEnGoogle(filasDeDatosErp(texto))
          if (q.configurada) enPlanilla = ` En la planilla: ${q.agregadas} filas nuevas en Quiter.`
        } catch (e) {
          enPlanilla = ` No se pudo agregar a la pestaña Quiter de la planilla (${e instanceof Error ? e.message : 'error'}): hay que pegarlas a mano como siempre.`
        }
      }
      setMensajeErp({
        texto: `Se agregaron ${r.nuevas.length} comprobantes nuevos (las facturas quedan en "Doc. pendiente"). ${r.vinculadas.length ? `${r.vinculadas.length} notas de crédito se vincularon con lo que había avisado la sucursal. ` : ''}${r.repetidas} ya estaban cargados y ${r.ignoradas} filas no eran de compañías de seguros o no se pudieron leer.${enPlanilla}`,
      })
    } catch (e) {
      setMensajeErp({ texto: e instanceof Error ? e.message : 'No se pudo leer el archivo.', error: true })
    }
    if (entradaErp.current) entradaErp.current.value = ''
  }

  const diasHasta = (desde: string, hasta: string | null) =>
    hasta ? <span className="block text-[11px] text-slate-400">{diffDias(desde, hasta)} {diffDias(desde, hasta) === 1 ? 'día' : 'días'}</span> : null

  const columnas: Columna<Fila>[] = [
    {
      clave: 'novedad',
      titulo: 'Novedad',
      oculta: true,
      filtro: (x) => novedad(x.c),
      celda: (x) => {
        const n = novedad(x.c)
        return n ? <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold ${n.startsWith('Nueva') ? 'bg-marca/10 text-marca' : 'bg-amber-100 text-amber-900'}`}>{n}</span> : null
      },
    },
    {
      clave: 'mes',
      titulo: 'Fecha',
      orden: (x) => x.c.fecha,
      filtro: (x) => mesDeFecha(x.c.fecha),
      celda: (x) => <span className="whitespace-nowrap">{formatoFecha(x.c.fecha)}</span>,
    },
    { clave: 'ref', titulo: 'Ref.', oculta: true, orden: (x) => x.c.ref, celda: (x) => <span className="text-slate-500">{x.c.ref}</span> },
    { clave: 'sucursal', titulo: 'Sucursal', filtro: (x) => x.c.sucursal, celda: (x) => <span className="whitespace-nowrap">{x.c.sucursal}</span> },
    {
      clave: 'comprobante', movil: 'titulo',
      titulo: 'Comprobante',
      filtro: (x) => (x.c.tipo === 'NC' ? 'Nota de crédito' : 'Factura'),
      celda: (x) => <span className="whitespace-nowrap font-medium">{formatoComprobante(x.c)}</span>,
    },
    {
      // Compañía arriba y siniestro abajo: una columna menos para que la tabla entre a lo ancho
      clave: 'compania',
      titulo: 'Compañía / siniestro',
      filtro: (x) => nombreCompania[x.c.aseguradoraId] ?? x.c.aseguradoraId,
      celda: (x) => {
        const n = porSiniestro.get(claveSiniestro(x.c)) ?? 0
        return (
          <div className="whitespace-nowrap">
            {nombreCompania[x.c.aseguradoraId]}
            {x.c.siniestro && (
              <div className="text-[11px] text-slate-500">
                {x.c.siniestro}
                {n > 1 && <span className="ml-1 rounded bg-slate-100 px-1 font-semibold text-slate-600" title="Facturas del mismo siniestro (facturación parcial)">{n} facturas</span>}
              </div>
            )}
          </div>
        )
      },
    },
    { clave: 'patente', titulo: 'Patente', oculta: true, celda: (x) => <span className="whitespace-nowrap text-slate-600">{x.c.patente}</span> },
    {
      clave: 'total',
      titulo: 'Total',
      derecha: true,
      orden: (x) => x.c.total,
      celda: (x) => <span className={`whitespace-nowrap font-semibold tabular-nums ${x.c.total < 0 ? 'text-sem-rojo' : ''}`}>{formatoPesos(x.c.total)}</span>,
    },
    {
      clave: 'subida', movil: 'no',
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
      clave: 'aprobada', movil: 'no',
      titulo: 'Doc. aprobada',
      orden: (x) => x.c.fechaAprobacion ?? null,
      celda: (x) => (
        <span className="whitespace-nowrap">
          {formatoFecha(x.c.fechaAprobacion ?? null)}
          {diasHasta(x.c.fecha, x.c.fechaAprobacion ?? null)}
        </span>
      ),
    },
    {
      clave: 'presentacion', movil: 'no',
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
      clave: 'estado', movil: 'accion',
      titulo: 'Estado',
      filtro: (x) => nombreEtapa(x.s.etapa),
      // en el orden en que avanza una factura (también para las opciones del filtro)
      orden: (x) => ORDEN_ETAPAS.indexOf(x.s.etapa),
      celda: (x) => (
        <div title={x.s.detalle.join(' · ')}>
          <BadgeEtapa etapa={x.s.etapa} />
          {x.c.reclamos.length > 0 && <div className="mt-0.5 text-[11px] text-slate-500">{x.c.reclamos.length} reclamo(s)</div>}
        </div>
      ),
    },
    {
      clave: 'nc', movil: 'no',
      titulo: 'Aviso de NC',
      filtro: (x) => avisoNc(x.c),
      celda: (x) =>
        avisoNc(x.c) ? (
          <span className={`whitespace-nowrap text-xs ${avisoNc(x.c) === 'Sin aviso' ? 'font-semibold text-sem-rojo' : 'text-slate-600'}`}>{avisoNc(x.c)}</span>
        ) : null,
    },
    { clave: 'obs', titulo: 'Observaciones', oculta: true, celda: (x) => <span className="block max-w-56 truncate text-xs text-slate-600">{x.c.observaciones}</span> },
  ]

  function exportar(lista: Fila[]) {
    descargarExcel(
      `control-diario-${hoy}`,
      ['Fecha', 'Ref.', 'Sucursal', 'CTE.', 'Número', 'Compañía', 'Siniestro', 'Patente', 'Total', 'Subida', 'Doc. aprobada', 'Días', 'Presentación', 'Días', 'Vto.', 'Fecha de cobro', 'Estado', 'Le toca a', 'Aviso de NC', 'Reclamos', 'Último reclamo', 'Observaciones'],
      lista.map(({ c, s }) => [
        fechaExcel(c.fecha),
        c.ref,
        c.sucursal,
        `${c.tipo} E`,
        `${c.puntoVenta} - ${c.numero}`,
        nombreCompania[c.aseguradoraId],
        c.siniestro || null,
        c.patente || null,
        c.total,
        fechaExcel(c.fechaDrive),
        fechaExcel(c.fechaAprobacion ?? null),
        c.fechaAprobacion ? diffDias(c.fecha, c.fechaAprobacion) : null,
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
        titulo={soloConsulta ? 'Detalle de facturas' : 'Control diario'}
        subtitulo={
          soloConsulta
            ? 'Todas las facturas y notas de crédito. Búsqueda por número, siniestro o patente; cada fila abre el detalle.'
            : 'Todas las facturas y notas de crédito, como la hoja "Diario" de la planilla'
        }
        sucursal={!soloConsulta}
        acciones={
          <>
            {!soloConsulta && (
              <>
                <input ref={entradaErp} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => cargarErp(e.target.files?.[0])} />
                <button
                  type="button"
                  onClick={() => entradaErp.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-noche hover:bg-fondo"
                  title="Excel de facturas exportado del ERP (.xlsx o CSV)"
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
            {!mensajeErp.error && fuente.tipo !== 'google' && (
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

      {!soloConsulta && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">Novedades:</span>
          {(['Nueva (último ERP)', 'Con cambios desde ayer'] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setParams(params.get('novedad') === n ? {} : { novedad: n })}
              className={`rounded-full border px-3 py-1 font-semibold ${params.get('novedad') === n ? 'border-marca bg-marca text-white' : 'border-slate-200 bg-white hover:bg-fondo'}`}
            >
              {n === 'Nueva (último ERP)' ? `Nuevas del último ERP${ultimaCarga ? ` (${formatoFecha(ultimaCarga)})` : ''}` : 'Con cambios desde ayer'}: {cuentaNovedad(n)}
            </button>
          ))}
        </div>
      )}

      {grupo && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">Mostrando:</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-marca/10 px-3 py-1 font-semibold text-marca">
            {GRUPOS_SALDO[grupo]}
            <button type="button" onClick={quitarGrupo} aria-label="Ver todas las facturas" className="hover:text-noche">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
          <span className="text-xs text-slate-500">Se pueden sumar los filtros de cada columna (estado, compañía, mes…).</span>
        </div>
      )}

      <Tabla
        id={soloConsulta ? 'detalle' : 'control-diario'}
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
