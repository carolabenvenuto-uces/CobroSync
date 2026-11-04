import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Info, Mail, Megaphone } from 'lucide-react'
import { claseSelect } from '../components/ui/Estados'
import { listaParaMail, TextoMail } from '../components/TextoMail'
import { EncabezadoPagina, Indicador } from '../components/ui/Card'
import { Tabla, type Columna } from '../components/ui/Tabla'
import { useApp, useComprobantes } from '../context/AppContext'
import {
  cambiosPorRespuesta,
  estadoReclamo,
  NOMBRE_ESTADO_RECLAMO,
  NOMBRE_RESPUESTA,
  RECLAMOS_PARA_ESCALAR,
  ultimoReclamo,
  type EstadoReclamo,
} from '../domain/reclamos'
import type { Comprobante, Reclamo, RespuestaReclamo } from '../domain/tipos'
import { diffDias } from '../lib/fechas'
import { plazosActuales } from '../domain/plazos'
import { descargarExcel, fechaExcel } from '../lib/exportar'
import { formatoComprobante, formatoFecha, formatoPesos } from '../lib/formato'

const ESTILO: Record<EstadoReclamo, string> = {
  sin_reclamar: 'bg-red-800/10 text-red-900',
  reclamada: 'bg-slate-100 text-slate-700',
  volver: 'bg-sem-rojo/10 text-red-800',
  escalar: 'bg-sem-amarillo/20 text-amber-900',
  tolerancia: 'bg-slate-100 text-slate-600',
  en_pagos: 'bg-etapa-compania/10 text-blue-800',
  reenviar: 'bg-sem-rojo/10 text-red-800',
  refacturar: 'bg-sem-amarillo/20 text-amber-900',
}

/**
 * Facturas vencidas y su seguimiento con cada compañía: si se reclamó, cuántas veces,
 * cuándo fue el último reclamo y cuáles hay que escalar a gerencia.
 */
export default function Reclamos() {
  const { datos, hoy, rol, usuario, abrirLegajo, actualizarComprobante, registrarEvento } = useApp()
  // Reclamos en lote: Auditoría elige varias vencidas, arma el mail y registra el reclamo en todas
  const [elegidas, setElegidas] = useState<Set<string>>(new Set())
  const [medio, setMedio] = useState<Reclamo['medio']>('mail')
  const [nota, setNota] = useState('')
  const [mail, setMail] = useState<{ asunto: string; texto: string; para?: string } | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [respuesta, setRespuesta] = useState<RespuestaReclamo>('pagos')
  const comprobantes = useComprobantes()
  const { aseguradoras } = datos!
  const [params, setParams] = useSearchParams()
  const nombreCompania = (id: string) => aseguradoras.find((a) => a.id === id)?.nombre ?? id

  type Fila = { c: Comprobante; estado: EstadoReclamo; dias: number }
  const vencidas = useMemo(
    () =>
      comprobantes
        .map((c) => ({ c, estado: estadoReclamo(c, hoy) }))
        .filter((x): x is { c: Comprobante; estado: EstadoReclamo } => x.estado !== null)
        .map((x): Fila => ({ ...x, dias: diffDias(x.c.vencimiento as string, hoy) })),
    [comprobantes, hoy],
  )
  const resumen = (e: EstadoReclamo) => {
    const lista = vencidas.filter((x) => x.estado === e)
    return { cantidad: lista.length, total: lista.reduce((s, x) => s + x.c.total, 0) }
  }
  const total = vencidas.reduce((s, x) => s + x.c.total, 0)

  // Desde Saldos llega ?compania=<id>; el filtro de la columna usa el nombre
  const filtrosIniciales = Object.fromEntries(
    [...params.entries()].map(([k, v]) => (k === 'compania' ? [k, nombreCompania(v)] : [k, v])),
  )
  const estadoActivo = params.get('estado')

  const seleccion = vencidas.filter((x) => elegidas.has(x.c.id))
  const companiasElegidas = [...new Set(seleccion.map((x) => x.c.aseguradoraId))]

  // Lo que respondió la compañía, para todas las elegidas que ya tienen un reclamo
  function registrarRespuesta() {
    let n = 0
    for (const x of seleccion) {
      const r = cambiosPorRespuesta(x.c, respuesta, nota, hoy, usuario || 'Auditoría')
      if (!r) continue
      actualizarComprobante(x.c.id, r.campos)
      registrarEvento(x.c.id, 'reclamo', r.evento)
      n++
    }
    setMensaje(n ? `Listo: respuesta registrada en ${n} ${n === 1 ? 'factura' : 'facturas'}.` : 'Las elegidas todavía no tienen un reclamo registrado.')
    setElegidas(new Set())
  }

  function registrarReclamos() {
    for (const { c } of seleccion) {
      const nuevo: Reclamo = { fecha: hoy, medio, autor: usuario, nota }
      actualizarComprobante(c.id, { reclamos: [...c.reclamos, nuevo] })
      registrarEvento(c.id, 'reclamo', `Reclamo ${c.reclamos.length + 1} a ${nombreCompania(c.aseguradoraId)} por ${medio}${nota ? `: ${nota}` : ''} (en lote)`)
    }
    setMensaje(`Listo: se registró el reclamo en ${seleccion.length} facturas. Quedan esperando respuesta ${plazosActuales().respuestaReclamo} días.`)
    setElegidas(new Set())
    setNota('')
  }

  function armarMail() {
    const partes = companiasElegidas.map((id) => {
      const lista = seleccion.filter((x) => x.c.aseguradoraId === id)
      return `${companiasElegidas.length > 1 ? `${nombreCompania(id)}\n` : ''}${listaParaMail(
        lista.map(({ c, dias }) => ({
          numero: formatoComprobante(c),
          siniestro: c.siniestro,
          total: c.total,
          extra: `venció el ${formatoFecha(c.vencimiento)} (${dias} días)${c.reclamos.length ? ` · ${c.reclamos.length + 1}.º reclamo` : ''}`,
        })),
        formatoPesos,
      )}`
    })
    const una = companiasElegidas.length === 1 ? aseguradoras.find((a) => a.id === companiasElegidas[0]) : undefined
    setMail({
      asunto: `Reclamo de pago de facturas vencidas${una ? ` · ${una.razonSocial ?? una.nombre}` : ''}`,
      texto: `Buenos días:\n\nLes escribimos por las siguientes facturas presentadas, que ya vencieron y figuran sin pago:\n\n${partes.join('\n\n')}\n\nLes pedimos que nos informen la fecha de pago o, si hay algún inconveniente, qué documentación necesitan.\nSaludos,\nAuditoría`,
      para: una?.emailReclamos || una?.email || undefined,
    })
  }

  const columnas: Columna<Fila>[] = [
    { clave: 'compania', titulo: 'Compañía', filtro: (x) => nombreCompania(x.c.aseguradoraId), celda: (x) => <span className="whitespace-nowrap">{nombreCompania(x.c.aseguradoraId)}</span> },
    { clave: 'comprobante', movil: 'titulo', titulo: 'Comprobante', celda: (x) => <span className="whitespace-nowrap font-medium">{formatoComprobante(x.c)}</span> },
    { clave: 'sucursal', titulo: 'Sucursal', filtro: (x) => x.c.sucursal, celda: (x) => <span className="whitespace-nowrap">{x.c.sucursal}</span> },
    { clave: 'siniestro', titulo: 'Siniestro', celda: (x) => <span className="whitespace-nowrap text-slate-600">{x.c.siniestro}</span> },
    { clave: 'total', titulo: 'Total', derecha: true, orden: (x) => x.c.total, celda: (x) => <span className="whitespace-nowrap tabular-nums">{formatoPesos(x.c.total)}</span> },
    { clave: 'vto', titulo: 'Vencimiento', orden: (x) => x.c.vencimiento, celda: (x) => <span className="whitespace-nowrap">{formatoFecha(x.c.vencimiento)}</span> },
    { clave: 'dias', titulo: 'Días vencida', derecha: true, orden: (x) => x.dias, celda: (x) => <span className="font-semibold tabular-nums text-red-800">{x.dias}</span> },
    { clave: 'reclamos', titulo: 'Reclamos', derecha: true, orden: (x) => x.c.reclamos.length, celda: (x) => <span className="tabular-nums">{x.c.reclamos.length || '—'}</span> },
    { clave: 'ultimo', titulo: 'Último reclamo', orden: (x) => ultimoReclamo(x.c), celda: (x) => <span className="whitespace-nowrap">{formatoFecha(ultimoReclamo(x.c))}</span> },
    {
      clave: 'estado', movil: 'accion',
      titulo: 'Estado',
      filtro: (x) => NOMBRE_ESTADO_RECLAMO[x.estado],
      celda: (x) => <span className={`whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ${ESTILO[x.estado]}`}>{NOMBRE_ESTADO_RECLAMO[x.estado]}</span>,
    },
  ]

  function exportar(lista: Fila[]) {
    descargarExcel(
      `vencidas-y-reclamos-${hoy}`,
      ['Compañía', 'Comprobante', 'Sucursal', 'Siniestro', 'Total', 'Presentación', 'Vencimiento', 'Días vencida', 'Reclamos', 'Último reclamo', 'Estado'],
      lista.map(({ c, estado, dias }) => [
        nombreCompania(c.aseguradoraId),
        formatoComprobante(c),
        c.sucursal,
        c.siniestro,
        c.total,
        fechaExcel(c.fechaPresentacion),
        fechaExcel(c.vencimiento),
        dias,
        c.reclamos.length,
        fechaExcel(ultimoReclamo(c)),
        NOMBRE_ESTADO_RECLAMO[estado],
      ]),
    )
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Vencidas y reclamos"
        subtitulo="Facturas presentadas, vencidas y sin cobrar"
        sucursal
      />

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-marca/20 bg-marca/5 px-4 py-3 text-sm text-indigo-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Después de cada reclamo se espera la respuesta {plazosActuales().respuestaReclamo} días; si no llega, hay que volver a reclamar.
          Con {RECLAMOS_PARA_ESCALAR} reclamos sin respuesta, Auditoría pide apoyo a gerencia. Cada reclamo se registra en la factura con
          fecha, medio y nota{rol === 'auditoria' ? ': cada fila permite registrarlo.' : '.'}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-5">
        <button type="button" className={`rounded-xl text-left ${!estadoActivo ? 'ring-2 ring-marca' : ''}`} onClick={() => setParams({}, { replace: true })}>
          <Indicador titulo="Vencido total" valor={formatoPesos(total)} ayuda={`${vencidas.length} facturas`} tono="rojo" />
        </button>
        {(['sin_reclamar', 'reclamada', 'volver', 'escalar'] as EstadoReclamo[]).map((e) => (
          <button
            key={e}
            type="button"
            className={`rounded-xl text-left ${estadoActivo === NOMBRE_ESTADO_RECLAMO[e] ? 'ring-2 ring-marca' : ''}`}
            onClick={() => setParams({ estado: NOMBRE_ESTADO_RECLAMO[e] }, { replace: true })}
          >
            <Indicador titulo={NOMBRE_ESTADO_RECLAMO[e]} valor={formatoPesos(resumen(e).total)} ayuda={`${resumen(e).cantidad} facturas`} />
          </button>
        ))}
      </div>

      {/* Lo que ya respondió la compañía, o lo que todavía no se reclama por tolerancia */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        {(['reenviar', 'refacturar', 'en_pagos', 'tolerancia'] as EstadoReclamo[])
          .filter((e) => resumen(e).cantidad > 0)
          .map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setParams({ estado: NOMBRE_ESTADO_RECLAMO[e] }, { replace: true })}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${ESTILO[e]} ${estadoActivo === NOMBRE_ESTADO_RECLAMO[e] ? 'ring-2 ring-marca' : ''}`}
            >
              {NOMBRE_ESTADO_RECLAMO[e]} · {resumen(e).cantidad}
            </button>
          ))}
      </div>

      {rol === 'auditoria' && (
        <div className={`mb-4 flex flex-wrap items-center gap-3 rounded-xl border p-3 ${seleccion.length ? 'border-marca/40 bg-marca/5' : 'border-slate-200 bg-white'}`}>
          <span className="text-sm">
            {seleccion.length ? (
              <>
                <strong>{seleccion.length}</strong> elegidas · <strong>{formatoPesos(seleccion.reduce((t, x) => t + x.c.total, 0))}</strong>
                {companiasElegidas.length > 1 && <span className="text-slate-500"> · {companiasElegidas.length} compañías</span>}
              </>
            ) : (
              <span className="text-slate-500">Para reclamar varias juntas: filtrar por compañía y marcar las casillas.</span>
            )}
          </span>
          {mensaje && <span className="text-sm text-teal-800">{mensaje}</span>}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button type="button" disabled={!seleccion.length} onClick={armarMail} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50">
              <Mail className="h-4 w-4 text-marca" /> Armar el mail
            </button>
            <select value={medio} onChange={(e) => setMedio(e.target.value as Reclamo['medio'])} className={claseSelect} aria-label="Medio del reclamo">
              <option value="mail">Por mail</option>
              <option value="portal">Por el portal</option>
              <option value="telefono">Por teléfono</option>
            </select>
            <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (opcional)" className={`${claseSelect} w-40`} />
            <button
              type="button"
              disabled={!seleccion.length}
              onClick={registrarReclamos}
              className="inline-flex items-center gap-2 rounded-lg bg-marca px-3 py-2 text-sm font-semibold text-white hover:bg-marca-oscuro disabled:opacity-50"
            >
              <Megaphone className="h-4 w-4" /> Registrar el reclamo
            </button>
            <span className="mx-1 h-6 w-px bg-slate-200" aria-hidden="true" />
            <select value={respuesta} onChange={(e) => setRespuesta(e.target.value as RespuestaReclamo)} className={claseSelect} aria-label="Respuesta de la compañía">
              {(Object.keys(NOMBRE_RESPUESTA) as RespuestaReclamo[]).map((k) => (
                <option key={k} value={k}>
                  {NOMBRE_RESPUESTA[k]}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!seleccion.length}
              onClick={registrarRespuesta}
              className="inline-flex items-center gap-2 rounded-lg border border-marca/40 bg-white px-3 py-2 text-sm font-semibold text-marca hover:bg-marca/5 disabled:opacity-50"
            >
              Registrar la respuesta
            </button>
          </div>
        </div>
      )}

      <Tabla
        id="reclamos"
        key={params.toString()}
        filas={vencidas}
        columnas={columnas}
        clave={(x) => x.c.id}
        onFila={(x) => abrirLegajo(x.c.id)}
        buscar={(x) => [formatoComprobante(x.c), x.c.siniestro, x.c.patente, x.c.ref].join(' ')}
        textoBusqueda="Buscar por número de factura, siniestro o patente"
        filtrosIniciales={filtrosIniciales}
        ordenInicial={{ clave: 'dias', dir: 'desc' }}
        exportar={exportar}
        seleccion={rol === 'auditoria' ? { elegidas, alCambiar: setElegidas } : undefined}
        resumen={(l) => (
          <>
            <strong>{l.length.toLocaleString('es-AR')}</strong> facturas · <strong>{formatoPesos(l.reduce((s, x) => s + x.c.total, 0))}</strong>
          </>
        )}
        vacio="No hay facturas vencidas con estos filtros."
      />
      {mail && <TextoMail titulo="Mail de reclamo" {...mail} onCerrar={() => setMail(null)} />}
    </>
  )
}
