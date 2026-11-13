import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Mail, Megaphone } from 'lucide-react'
import { claseSelect } from '../components/ui/Estados'
import { listaParaMail, TextoMail } from '../components/TextoMail'
import { EncabezadoPagina } from '../components/ui/Card'
import { AvisoFiltroTarjeta, TarjetaFiltro, type TonoTarjeta } from '../components/ui/TarjetaFiltro'
import { Tabla, type Columna } from '../components/ui/Tabla'
import { useApp, useComprobantes } from '../context/AppContext'
import {
  cambiosPorErrorCorregido,
  cambiosPorRespuesta,
  estadoReclamo,
  NOMBRE_ESTADO_RECLAMO,
  NOMBRE_RESPUESTA,
  ultimoReclamo,
  type EstadoReclamo,
} from '../domain/reclamos'
import type { Comprobante, Reclamo, RespuestaReclamo } from '../domain/tipos'
import { diffDias } from '../lib/fechas'
import { plazosActuales } from '../domain/plazos'
import { descargarExcel, fechaExcel } from '../lib/exportar'
import { formatoComprobante, formatoFecha, formatoPesos } from '../lib/formato'

/** Las tarjetas de arriba: qué hay que hacer con cada vencida (el título es el filtro "Acción") */
const ACCIONES: { titulo: string; ayuda: string; tono: TonoTarjeta; estados: EstadoReclamo[] }[] = [
  { titulo: 'Reclamar', tono: 'rojo', ayuda: 'Nunca reclamadas o sin respuesta en el plazo', estados: ['sin_reclamar', 'volver'] },
  { titulo: 'Corregir', tono: 'ambar', ayuda: 'La compañía informó un error o pide reenviar documentación', estados: ['con_error', 'reenviar'] },
  { titulo: 'Pedir apoyo', tono: 'indigo', ayuda: 'Sin respuesta a 3 reclamos: se le pide a gerencia', estados: ['escalar'] },
  { titulo: 'Esperando', tono: 'gris', ayuda: 'Reclamadas, en pagos, en tolerancia o por refacturar', estados: ['reclamada', 'en_pagos', 'tolerancia', 'refacturar'] },
]
const accionDe = (e: EstadoReclamo) => ACCIONES.find((a) => a.estados.includes(e))?.titulo ?? ''

const ESTILO: Record<EstadoReclamo, string> = {
  sin_reclamar: 'bg-red-800/10 text-red-900',
  reclamada: 'bg-slate-100 text-slate-700',
  volver: 'bg-sem-rojo/10 text-red-800',
  escalar: 'bg-sem-amarillo/20 text-amber-900',
  tolerancia: 'bg-slate-100 text-slate-600',
  en_pagos: 'bg-etapa-compania/10 text-blue-800',
  reenviar: 'bg-sem-rojo/10 text-red-800',
  refacturar: 'bg-sem-amarillo/20 text-amber-900',
  con_error: 'bg-red-100 text-red-900',
}

/**
 * Facturas vencidas y su seguimiento con cada compañía: si se reclamó, cuántas veces,
 * cuándo fue el último reclamo y cuáles hay que escalar a gerencia.
 */
export default function Reclamos() {
  const { datos, hoy, rol, usuario, abrirLegajo, actualizarComprobante, registrarEvento } = useApp()
  // Reclamos en lote: Cobranzas elige varias vencidas, arma el mail y registra el reclamo en todas
  const [elegidas, setElegidas] = useState<Set<string>>(new Set())
  const [medio, setMedio] = useState<Reclamo['medio']>('mail')
  const [nota, setNota] = useState('')
  const [mail, setMail] = useState<{ asunto: string; texto: string; para?: string } | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [respuesta, setRespuesta] = useState<RespuestaReclamo | ''>('')
  // Con varias elegidas: qué se va a registrar (cada acción abre solo sus campos)
  const [registrando, setRegistrando] = useState<'reclamo' | 'respuesta' | null>(null)
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

  // Desde Saldos llega ?compania=<id>; el filtro de la columna usa el nombre
  const filtrosIniciales = Object.fromEntries(
    [...params.entries()].map(([k, v]) => (k === 'compania' ? [k, nombreCompania(v)] : [k, v])),
  )

  const seleccion = vencidas.filter((x) => elegidas.has(x.c.id))
  const companiasElegidas = [...new Set(seleccion.map((x) => x.c.aseguradoraId))]

  // Errores que informó la compañía y que Cobranzas ya corrigió: vuelven a "Volver a reclamar"
  const conError = seleccion.filter((x) => x.estado === 'con_error')
  function corregirErrores() {
    let n = 0
    for (const x of conError) {
      const r = cambiosPorErrorCorregido(x.c, nota, hoy)
      if (!r) continue
      actualizarComprobante(x.c.id, r.campos)
      registrarEvento(x.c.id, 'reclamo', r.evento)
      n++
    }
    setMensaje(`Listo: ${n} ${n === 1 ? 'error corregido' : 'errores corregidos'}. Ya se puede volver a reclamar el pago.`)
    setElegidas(new Set())
    setNota('')
  }

  // Lo que respondió la compañía, para todas las elegidas que ya tienen un reclamo
  function registrarRespuesta() {
    if (!respuesta) return
    let n = 0
    for (const x of seleccion) {
      const r = cambiosPorRespuesta(x.c, respuesta, nota, hoy, usuario || 'Cobranzas')
      if (!r) continue
      actualizarComprobante(x.c.id, r.campos)
      registrarEvento(x.c.id, 'reclamo', r.evento)
      n++
    }
    setRegistrando(null)
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
    setRegistrando(null)
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
      texto: `Buenos días:\n\nLes escribimos por las siguientes facturas presentadas, que ya vencieron y figuran sin pago:\n\n${partes.join('\n\n')}\n\nLes pedimos que nos informen la fecha de pago o, si hay algún inconveniente, qué documentación necesitan.\nSaludos,\nCobranzas`,
      para: una?.emailReclamos || una?.email || undefined,
    })
  }

  const columnas: Columna<Fila>[] = [
    {
      clave: 'comprobante', movil: 'titulo',
      titulo: 'Factura',
      celda: (x) => (
        <div className="whitespace-nowrap">
          <div className="font-medium">{formatoComprobante(x.c)}</div>
          {x.c.siniestro && <div className="text-[11px] text-slate-500">{x.c.siniestro}</div>}
        </div>
      ),
    },
    { clave: 'compania', titulo: 'Compañía', filtro: (x) => nombreCompania(x.c.aseguradoraId), celda: (x) => <span className="whitespace-nowrap">{nombreCompania(x.c.aseguradoraId)}</span> },
    { clave: 'sucursal', titulo: 'Sucursal', filtro: (x) => x.c.sucursal, celda: (x) => <span className="whitespace-nowrap">{x.c.sucursal}</span> },
    { clave: 'total', titulo: 'Total', derecha: true, orden: (x) => x.c.total, celda: (x) => <span className="whitespace-nowrap font-semibold tabular-nums">{formatoPesos(x.c.total)}</span> },
    {
      clave: 'dias',
      titulo: 'Vencida',
      orden: (x) => x.dias,
      celda: (x) => (
        <div className="whitespace-nowrap">
          <span className="font-bold tabular-nums text-red-800">{x.dias} días</span>
          <div className="text-[11px] text-slate-500">desde {formatoFecha(x.c.vencimiento)}</div>
        </div>
      ),
    },
    {
      clave: 'reclamos',
      titulo: 'Reclamos',
      orden: (x) => x.c.reclamos.length,
      celda: (x) =>
        x.c.reclamos.length ? (
          <div className="whitespace-nowrap">
            <span className="font-semibold tabular-nums">{x.c.reclamos.length}</span>
            <div className="text-[11px] text-slate-500">último {formatoFecha(ultimoReclamo(x.c))}</div>
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      clave: 'estado', movil: 'accion',
      titulo: 'Estado',
      filtro: (x) => NOMBRE_ESTADO_RECLAMO[x.estado],
      celda: (x) => <span className={`whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ${ESTILO[x.estado]}`}>{NOMBRE_ESTADO_RECLAMO[x.estado]}</span>,
    },
    { clave: 'accion', titulo: 'Acción', oculta: true, filtro: (x) => accionDe(x.estado), celda: (x) => <span className="text-xs">{accionDe(x.estado)}</span> },
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
      <EncabezadoPagina titulo="Vencidas y reclamos" sucursal />

      {/* Arriba, qué hay que hacer: cada tarjeta filtra la tabla */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ACCIONES.map((ac) => {
          const lista = vencidas.filter((x) => ac.estados.includes(x.estado))
          const activa = params.get('accion') === ac.titulo
          return (
            <TarjetaFiltro
              key={ac.titulo}
              titulo={ac.titulo}
              cantidad={lista.length}
              tono={ac.tono}
              activa={activa}
              otraActiva={!activa && ACCIONES.some((o) => params.get('accion') === o.titulo)}
              onClick={() => {
                const nuevos = new URLSearchParams(params)
                nuevos.delete('estado')
                if (activa) nuevos.delete('accion')
                else nuevos.set('accion', ac.titulo)
                setParams(nuevos, { replace: true })
              }}
            >
              <div className="text-xs text-slate-500">
                {formatoPesos(lista.reduce((t, x) => t + x.c.total, 0))} · {ac.ayuda}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ac.estados.map((e) => {
                  const n = lista.filter((x) => x.estado === e).length
                  return n ? (
                    <span key={e} className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${ESTILO[e]}`}>
                      {NOMBRE_ESTADO_RECLAMO[e]} · {n}
                    </span>
                  ) : null
                })}
                {lista.length === 0 && <span className="text-xs text-slate-400">Nada por ahora</span>}
              </div>
            </TarjetaFiltro>
          )
        })}
      </div>
      <AvisoFiltroTarjeta
        texto={ACCIONES.find((a) => params.get('accion') === a.titulo) ? `las facturas para "${params.get('accion')}"` : null}
        onQuitar={() => {
          const nuevos = new URLSearchParams(params)
          nuevos.delete('accion')
          setParams(nuevos, { replace: true })
        }}
      />

      {mensaje && !seleccion.length && <p className="mb-3 text-sm text-teal-800">{mensaje}</p>}
      {rol === 'auditoria' && seleccion.length > 0 && (
        <div className="sticky top-16 z-20 lg:top-0 mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-marca/40 bg-white p-3 shadow-sm">
          <span className="text-sm">
            <strong>{seleccion.length}</strong> elegidas · <strong>{formatoPesos(seleccion.reduce((t, x) => t + x.c.total, 0))}</strong>
            {companiasElegidas.length > 1 && <span className="text-slate-500"> · {companiasElegidas.length} compañías</span>}
          </span>
          {mensaje && <span className="text-sm text-teal-800">{mensaje}</span>}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button type="button" onClick={armarMail} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold">
              <Mail className="h-4 w-4 text-marca" /> Armar el mail
            </button>
            <button
              type="button"
              onClick={() => setRegistrando(registrando === 'reclamo' ? null : 'reclamo')}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${registrando === 'reclamo' ? 'bg-marca text-white' : 'border border-marca/40 bg-white text-marca hover:bg-marca/5'}`}
            >
              <Megaphone className="h-4 w-4" /> Registrar reclamo
            </button>
            <button
              type="button"
              onClick={() => setRegistrando(registrando === 'respuesta' ? null : 'respuesta')}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${registrando === 'respuesta' ? 'bg-marca text-white' : 'border border-marca/40 bg-white text-marca hover:bg-marca/5'}`}
            >
              Registrar respuesta
            </button>
            {conError.length > 0 && (
              <button
                type="button"
                onClick={corregirErrores}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900 hover:bg-red-100"
              >
                Error corregido ({conError.length})
              </button>
            )}
          </div>
          {registrando && (
            <div className="flex w-full flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              {registrando === 'reclamo' ? (
                <select value={medio} onChange={(e) => setMedio(e.target.value as Reclamo['medio'])} className={claseSelect} aria-label="Medio del reclamo">
                  <option value="mail">Por mail</option>
                  <option value="portal">Por el portal</option>
                  <option value="telefono">Por teléfono</option>
                </select>
              ) : (
                <select value={respuesta} onChange={(e) => setRespuesta(e.target.value as RespuestaReclamo)} className={claseSelect} aria-label="Respuesta de la compañía">
                  <option value="" disabled>
                    Seleccionar respuesta
                  </option>
                  {(Object.keys(NOMBRE_RESPUESTA) as RespuestaReclamo[]).map((k) => (
                    <option key={k} value={k}>
                      {NOMBRE_RESPUESTA[k]}
                    </option>
                  ))}
                </select>
              )}
              <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder={registrando === 'respuesta' && respuesta === 'error' ? 'Qué error informó (obligatorio)' : 'Nota (opcional)'} className={`${claseSelect} min-w-48 flex-1`} />
              <button
                type="button"
                onClick={registrando === 'reclamo' ? registrarReclamos : registrarRespuesta}
                disabled={registrando === 'respuesta' && (!respuesta || (respuesta === 'error' && !nota.trim()))}
                className="rounded-lg bg-marca px-4 py-2 text-sm font-semibold text-white hover:bg-marca-oscuro disabled:opacity-50"
              >
                Confirmar en {seleccion.length} {seleccion.length === 1 ? 'factura' : 'facturas'}
              </button>
            </div>
          )}
        </div>
      )}

      <Tabla
        id="reclamos-v2"
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
