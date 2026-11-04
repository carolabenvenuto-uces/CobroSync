import { useMemo, useState } from 'react'
import { CalendarCheck, Mail } from 'lucide-react'
import { EncabezadoPagina } from '../components/ui/Card'
import { claseSelect } from '../components/ui/Estados'
import { Tabla, type Columna } from '../components/ui/Tabla'
import { listaParaMail, TextoMail } from '../components/TextoMail'
import { useApp, useComprobantes } from '../context/AppContext'
import { esMipyme } from '../domain/plazos'
import { calcularSemaforo } from '../domain/semaforo'
import type { Comprobante } from '../domain/tipos'
import { diffDias, sumarDias } from '../lib/fechas'
import { descargarExcel, fechaExcel } from '../lib/exportar'
import { formatoComprobante, formatoFecha, formatoPesos } from '../lib/formato'

/**
 * Presentar a las compañías en lote: las facturas con la documentación aprobada, para elegir
 * varias, armar el mail de presentación y marcarlas como presentadas de una vez.
 */
export default function Presentar() {
  const { datos, hoy, abrirLegajo, actualizarComprobante, registrarEvento } = useApp()
  const comprobantes = useComprobantes()
  const { aseguradoras } = datos!
  const compania = (id: string) => aseguradoras.find((a) => a.id === id)
  const [elegidas, setElegidas] = useState<Set<string>>(new Set())
  const [fecha, setFecha] = useState(hoy)
  const [mail, setMail] = useState<{ asunto: string; texto: string; para?: string } | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)

  const filas = useMemo(
    () => comprobantes.filter((c) => c.tipo === 'FC' && calcularSemaforo(c, hoy).etapa === 'pres_pendiente'),
    [comprobantes, hoy],
  )
  const seleccion = filas.filter((c) => elegidas.has(c.id))
  const companiasElegidas = [...new Set(seleccion.map((c) => c.aseguradoraId))]

  const columnas: Columna<Comprobante>[] = [
    { clave: 'compania', titulo: 'Compañía', filtro: (c) => compania(c.aseguradoraId)?.nombre ?? c.aseguradoraId, celda: (c) => <span className="whitespace-nowrap">{compania(c.aseguradoraId)?.nombre}</span> },
    {
      clave: 'comprobante',
      titulo: 'Comprobante',
      celda: (c) => (
        <span className="whitespace-nowrap font-medium">
          {formatoComprobante(c)}
          {esMipyme(c) && <span className="ml-1.5 rounded bg-marca/10 px-1 text-[11px] font-bold text-marca">MiPyME</span>}
        </span>
      ),
    },
    { clave: 'sucursal', titulo: 'Sucursal', filtro: (c) => c.sucursal, celda: (c) => <span className="whitespace-nowrap">{c.sucursal}</span> },
    { clave: 'siniestro', titulo: 'Siniestro', celda: (c) => <span className="whitespace-nowrap text-slate-600">{c.siniestro}</span> },
    { clave: 'total', titulo: 'Total', derecha: true, orden: (c) => c.total, celda: (c) => <span className="whitespace-nowrap tabular-nums">{formatoPesos(c.total)}</span> },
    { clave: 'aprobada', titulo: 'Doc. aprobada', orden: (c) => c.fechaAprobacion ?? null, celda: (c) => <span className="whitespace-nowrap">{formatoFecha(c.fechaAprobacion ?? null)}</span> },
    { clave: 'dias', titulo: 'Días desde la factura', derecha: true, orden: (c) => diffDias(c.fecha, hoy), celda: (c) => <span className="tabular-nums">{diffDias(c.fecha, hoy)}</span> },
  ]

  function marcarPresentadas() {
    for (const c of seleccion) {
      const a = compania(c.aseguradoraId)
      actualizarComprobante(c.id, { fechaPresentacion: fecha, vencimiento: sumarDias(fecha, a?.plazoPagoDias ?? 30), estado: 'presentada' })
      registrarEvento(c.id, 'presentacion', `Presentado a ${a?.nombre ?? 'la compañía'} (en lote, con ${seleccion.length} facturas)`)
    }
    setMensaje(`Listo: ${seleccion.length} facturas quedaron presentadas el ${formatoFecha(fecha)}. Ya corre su vencimiento.`)
    setElegidas(new Set())
  }

  function armarMail() {
    const partes = companiasElegidas.map((id) => {
      const lista = seleccion.filter((c) => c.aseguradoraId === id)
      return `${companiasElegidas.length > 1 ? `${compania(id)?.nombre}\n` : ''}${listaParaMail(
        lista.map((c) => ({ numero: formatoComprobante(c), siniestro: c.siniestro, total: c.total })),
        formatoPesos,
      )}`
    })
    const una = companiasElegidas.length === 1 ? compania(companiasElegidas[0]) : undefined
    setMail({
      asunto: `Presentación de facturas${una ? ` · ${una.razonSocial ?? una.nombre}` : ''}`,
      texto: `Buenos días:\n\nLes enviamos para su liquidación las siguientes facturas, con la orden de reparación o repuestos firmada por el cliente:\n\n${partes.join('\n\n')}\n\nQuedamos a disposición por cualquier consulta.\nSaludos,\nAuditoría`,
      para: una?.email || undefined,
    })
  }

  function exportar(lista: Comprobante[]) {
    descargarExcel(
      `para-presentar-${hoy}`,
      ['Compañía', 'Comprobante', 'Sucursal', 'Siniestro', 'Patente', 'Total', 'Doc. aprobada'],
      lista.map((c) => [compania(c.aseguradoraId)?.nombre ?? '', formatoComprobante(c), c.sucursal, c.siniestro, c.patente, c.total, fechaExcel(c.fechaAprobacion ?? null)]),
    )
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Presentar a las compañías"
        subtitulo="Facturas con la documentación aprobada. Elegí varias, armá el mail y marcalas como presentadas de una vez."
        sucursal
      />

      {mensaje && <div className="mb-4 rounded-lg border border-esmeralda/30 bg-esmeralda/5 px-4 py-3 text-sm text-emerald-900">{mensaje}</div>}

      {/* Acciones sobre las elegidas */}
      <div className={`mb-4 flex flex-wrap items-center gap-3 rounded-xl border p-3 ${seleccion.length ? 'border-marca/40 bg-marca/5' : 'border-slate-200 bg-white'}`}>
        <span className="text-sm">
          {seleccion.length ? (
            <>
              <strong>{seleccion.length}</strong> elegidas · <strong>{formatoPesos(seleccion.reduce((t, c) => t + c.total, 0))}</strong>
              {companiasElegidas.length > 1 && <span className="text-slate-500"> · {companiasElegidas.length} compañías</span>}
            </>
          ) : (
            <span className="text-slate-500">Elegí las facturas con la casilla (o todas las filtradas con la de arriba).</span>
          )}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!seleccion.length}
            onClick={armarMail}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            <Mail className="h-4 w-4 text-marca" /> Armar el mail
          </button>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            Presentadas el
            <input type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value || hoy)} className={claseSelect} />
          </label>
          <button
            type="button"
            disabled={!seleccion.length}
            onClick={marcarPresentadas}
            className="inline-flex items-center gap-2 rounded-lg bg-marca px-3 py-2 text-sm font-semibold text-white hover:bg-marca-oscuro disabled:opacity-50"
          >
            <CalendarCheck className="h-4 w-4" /> Marcar como presentadas
          </button>
        </div>
      </div>

      <Tabla
        id="presentar"
        filas={filas}
        columnas={columnas}
        clave={(c) => c.id}
        onFila={(c) => abrirLegajo(c.id)}
        buscar={(c) => [formatoComprobante(c), c.siniestro, c.patente, c.ref].join(' ')}
        textoBusqueda="Buscar por número, siniestro o patente"
        ordenInicial={{ clave: 'dias', dir: 'desc' }}
        exportar={exportar}
        seleccion={{ elegidas, alCambiar: setElegidas }}
        resumen={(l) => (
          <>
            <strong>{l.length}</strong> para presentar · <strong>{formatoPesos(l.reduce((t, c) => t + c.total, 0))}</strong>
          </>
        )}
        vacio="No hay facturas para presentar: todo lo aprobado ya se presentó."
      />

      {mail && <TextoMail titulo="Mail de presentación" {...mail} onCerrar={() => setMail(null)} />}
    </>
  )
}
