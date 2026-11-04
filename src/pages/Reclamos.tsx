import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Info } from 'lucide-react'
import { EncabezadoPagina, Indicador } from '../components/ui/Card'
import { Tabla, type Columna } from '../components/ui/Tabla'
import { useApp, useComprobantes } from '../context/AppContext'
import {
  estadoReclamo,
  NOMBRE_ESTADO_RECLAMO,
  RECLAMOS_PARA_ESCALAR,
  ultimoReclamo,
  type EstadoReclamo,
} from '../domain/reclamos'
import type { Comprobante } from '../domain/tipos'
import { diffDias } from '../lib/fechas'
import { descargarExcel, fechaExcel } from '../lib/exportar'
import { formatoComprobante, formatoFecha, formatoPesos } from '../lib/formato'

const ESTILO: Record<EstadoReclamo, string> = {
  sin_reclamar: 'bg-red-800/10 text-red-900',
  reclamada: 'bg-slate-100 text-slate-700',
  escalar: 'bg-sem-amarillo/20 text-amber-900',
}

/**
 * Facturas vencidas y su seguimiento con cada compañía: si se reclamó, cuántas veces,
 * cuándo fue el último reclamo y cuáles hay que escalar a gerencia.
 */
export default function Reclamos() {
  const { datos, hoy, rol, abrirLegajo } = useApp()
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

  const columnas: Columna<Fila>[] = [
    { clave: 'compania', titulo: 'Compañía', filtro: (x) => nombreCompania(x.c.aseguradoraId), celda: (x) => <span className="whitespace-nowrap">{nombreCompania(x.c.aseguradoraId)}</span> },
    { clave: 'comprobante', titulo: 'Comprobante', celda: (x) => <span className="whitespace-nowrap font-medium">{formatoComprobante(x.c)}</span> },
    { clave: 'sucursal', titulo: 'Sucursal', filtro: (x) => x.c.sucursal, celda: (x) => <span className="whitespace-nowrap">{x.c.sucursal}</span> },
    { clave: 'siniestro', titulo: 'Siniestro', celda: (x) => <span className="whitespace-nowrap text-slate-600">{x.c.siniestro}</span> },
    { clave: 'total', titulo: 'Total', derecha: true, orden: (x) => x.c.total, celda: (x) => <span className="whitespace-nowrap tabular-nums">{formatoPesos(x.c.total)}</span> },
    { clave: 'vto', titulo: 'Vencimiento', orden: (x) => x.c.vencimiento, celda: (x) => <span className="whitespace-nowrap">{formatoFecha(x.c.vencimiento)}</span> },
    { clave: 'dias', titulo: 'Días vencida', derecha: true, orden: (x) => x.dias, celda: (x) => <span className="font-semibold tabular-nums text-red-800">{x.dias}</span> },
    { clave: 'reclamos', titulo: 'Reclamos', derecha: true, orden: (x) => x.c.reclamos.length, celda: (x) => <span className="tabular-nums">{x.c.reclamos.length || '—'}</span> },
    { clave: 'ultimo', titulo: 'Último reclamo', orden: (x) => ultimoReclamo(x.c), celda: (x) => <span className="whitespace-nowrap">{formatoFecha(ultimoReclamo(x.c))}</span> },
    {
      clave: 'estado',
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

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-marca/20 bg-marca/5 px-4 py-3 text-sm text-blue-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Se escala a gerencia cuando la compañía no respondió a {RECLAMOS_PARA_ESCALAR} reclamos. Cada reclamo se registra en la
          factura con fecha, medio y nota{rol === 'auditoria' ? ': tocá la fila para registrarlo.' : '.'}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <button type="button" className={`rounded-xl text-left ${!estadoActivo ? 'ring-2 ring-marca' : ''}`} onClick={() => setParams({}, { replace: true })}>
          <Indicador titulo="Vencido total" valor={formatoPesos(total)} ayuda={`${vencidas.length} facturas`} tono="rojo" />
        </button>
        {(['sin_reclamar', 'reclamada', 'escalar'] as EstadoReclamo[]).map((e) => (
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

      <Tabla
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
        resumen={(l) => (
          <>
            <strong>{l.length.toLocaleString('es-AR')}</strong> facturas · <strong>{formatoPesos(l.reduce((s, x) => s + x.c.total, 0))}</strong>
          </>
        )}
        vacio="No hay facturas vencidas con estos filtros."
      />
    </>
  )
}
