import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarClock, Info } from 'lucide-react'
import { Chip, nombreEtapa } from '../components/ui/Badges'
import { EncabezadoPagina, Indicador } from '../components/ui/Card'
import { Tabla, type Columna } from '../components/ui/Tabla'
import { useApp, useComprobantes } from '../context/AppContext'
import { calcularSemaforo, DIAS_ESCALAR_GERENCIA_GENERAL, PLAZO_ESCANEO_DIAS } from '../domain/semaforo'
import { avisoA, compromisoVencido, diasDeEspera, esperaALaSucursal, nivelEscaneo, type NivelEscaneo } from '../domain/sucursales'
import type { Comprobante } from '../domain/tipos'
import { descargarExcel, fechaExcel } from '../lib/exportar'
import { formatoComprobante, formatoFecha, formatoPesos } from '../lib/formato'
import { observadaSinRespuesta } from './Avisos'

const NOMBRE_ESTADO: Record<NivelEscaneo, string> = { en_plazo: 'En plazo', atrasado: 'Atrasada', critico: 'Crítica' }
const TONO = { en_plazo: 'amarillo', atrasado: 'rojo', critico: 'rojo' } as const

/** En qué situación está el aviso de la sucursal (para filtrar y para los avisos). */
function situacion(c: Comprobante, hoy: string): string {
  if (compromisoVencido(c, hoy)) return 'Compromiso vencido'
  if (c.compromiso) return 'Con compromiso'
  if (observadaSinRespuesta(c)) return 'Observada sin respuesta'
  return 'Sin aviso de la sucursal'
}

/**
 * Pendientes de las sucursales: lo que cada sucursal todavía tiene que subir o corregir.
 * Las tarjetas de arriba y los filtros de las columnas filtran la misma tabla.
 */
export default function Pendientes() {
  const { datos, hoy, abrirLegajo } = useApp()
  const comprobantes = useComprobantes()
  const { aseguradoras, meta } = datos!
  const [params, setParams] = useSearchParams()
  const nombreCompania = (id: string) => aseguradoras.find((a) => a.id === id)?.nombre ?? id

  const filas = useMemo(
    () =>
      comprobantes
        .filter((c) => esperaALaSucursal(c, hoy))
        .map((c) => {
          const dias = diasDeEspera(c, hoy)
          return {
            c,
            dias,
            nivel: nivelEscaneo(dias),
            semaforo: calcularSemaforo(c, hoy),
            situacion: situacion(c, hoy),
            sucursal: meta.sucursales.find((s) => s.nombre === c.sucursal),
          }
        }),
    [comprobantes, hoy, meta.sucursales],
  )
  type Fila = (typeof filas)[number]

  const resumen = (f: (x: Fila) => boolean) => {
    const l = filas.filter(f)
    return { cantidad: l.length, monto: l.reduce((s, x) => s + x.c.total, 0) }
  }
  const tarjetas: { titulo: string; ayuda: string; tono: 'amarillo' | 'rojo' | 'neutro'; filtro: Record<string, string>; r: { cantidad: number; monto: number } }[] = [
    { titulo: 'En plazo', ayuda: `Hasta ${PLAZO_ESCANEO_DIAS} días`, tono: 'amarillo' as const, filtro: { estado: 'En plazo' }, r: resumen((x) => x.nivel === 'en_plazo') },
    { titulo: 'Atrasadas', ayuda: 'Aviso al gerente de sucursal', tono: 'rojo' as const, filtro: { estado: 'Atrasada' }, r: resumen((x) => x.nivel === 'atrasado') },
    { titulo: 'Críticas', ayuda: 'Aviso a gerencia general', tono: 'rojo' as const, filtro: { estado: 'Crítica' }, r: resumen((x) => x.nivel === 'critico') },
    {
      titulo: 'Compromisos vencidos',
      ayuda: 'Fecha prometida ya pasada',
      tono: 'neutro' as const,
      filtro: { situacion: 'Compromiso vencido' },
      r: resumen((x) => x.situacion === 'Compromiso vencido'),
    },
  ]
  const filtrosIniciales = Object.fromEntries(params.entries())

  const columnas: Columna<Fila>[] = [
    {
      clave: 'dias',
      titulo: 'Días',
      orden: (x) => x.dias,
      celda: (x) => <span className="text-base font-extrabold">{x.dias}</span>,
    },
    { clave: 'estado', titulo: 'Estado', filtro: (x) => NOMBRE_ESTADO[x.nivel], celda: (x) => <Chip tono={TONO[x.nivel]}>{NOMBRE_ESTADO[x.nivel]}</Chip> },
    { clave: 'sucursal', titulo: 'Sucursal', filtro: (x) => x.c.sucursal, orden: (x) => x.c.sucursal, celda: (x) => <span className="whitespace-nowrap">{x.c.sucursal}</span> },
    {
      clave: 'factura',
      titulo: 'Factura',
      orden: (x) => x.c.fecha,
      celda: (x) => (
        <div className="whitespace-nowrap">
          <div className="font-medium">{formatoComprobante(x.c)}</div>
          <div className="text-xs text-slate-500">{formatoFecha(x.c.fecha)}</div>
        </div>
      ),
    },
    { clave: 'compania', titulo: 'Compañía', filtro: (x) => nombreCompania(x.c.aseguradoraId), celda: (x) => <span className="whitespace-nowrap">{nombreCompania(x.c.aseguradoraId)}</span> },
    { clave: 'siniestro', titulo: 'Siniestro', celda: (x) => <span className="whitespace-nowrap">{x.c.siniestro}</span> },
    { clave: 'patente', titulo: 'Patente', celda: (x) => <span className="whitespace-nowrap">{x.c.patente}</span> },
    { clave: 'total', titulo: 'Total', derecha: true, orden: (x) => x.c.total, celda: (x) => <span className="whitespace-nowrap font-semibold">{formatoPesos(x.c.total)}</span> },
    {
      clave: 'falta',
      titulo: 'Qué falta',
      filtro: (x) => nombreEtapa(x.semaforo.etapa),
      celda: (x) => (
        <div className="text-xs text-slate-700">
          {(x.semaforo.detalle.length > 1 ? x.semaforo.detalle.slice(1) : x.semaforo.detalle).map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
      ),
    },
    {
      clave: 'situacion',
      titulo: 'Aviso de la sucursal',
      filtro: (x) => x.situacion,
      celda: (x) =>
        x.c.compromiso ? (
          <div className={`text-xs ${x.situacion === 'Compromiso vencido' ? 'font-semibold text-red-700' : 'text-slate-700'}`}>
            <div className="flex items-center gap-1 whitespace-nowrap">
              <CalendarClock className="h-3.5 w-3.5" />
              {formatoFecha(x.c.compromiso.fecha)}
              {x.situacion === 'Compromiso vencido' && ' · vencido'}
            </div>
            <div className="mt-0.5 text-slate-500">{x.c.compromiso.motivo}</div>
          </div>
        ) : (
          <span className="text-xs text-slate-500">{x.situacion}</span>
        ),
    },
    { clave: 'aviso', titulo: 'Escalado a', filtro: (x) => avisoA(x.nivel, x.sucursal), celda: (x) => <span className="whitespace-nowrap text-xs">{avisoA(x.nivel, x.sucursal)}</span> },
  ]

  function exportar(lista: Fila[]) {
    descargarExcel(
      `pendientes-sucursales-${hoy}`,
      ['Días', 'Estado', 'Sucursal', 'Fecha factura', 'Comprobante', 'Compañía', 'Siniestro', 'Patente', 'Total', 'Qué falta', 'Aviso de la sucursal', 'Compromiso', 'Escalado a'],
      lista.map((x) => [
        x.dias,
        NOMBRE_ESTADO[x.nivel],
        x.c.sucursal,
        fechaExcel(x.c.fecha),
        formatoComprobante(x.c),
        nombreCompania(x.c.aseguradoraId),
        x.c.siniestro,
        x.c.patente,
        x.c.total,
        x.semaforo.detalle.join(' / '),
        x.situacion,
        x.c.compromiso ? `${fechaExcel(x.c.compromiso.fecha)} · ${x.c.compromiso.motivo}` : null,
        avisoA(x.nivel, x.sucursal),
      ]),
    )
  }

  return (
    <>
      <EncabezadoPagina titulo="Pendientes de sucursales" subtitulo="Facturas que esperan documentación de las sucursales" sucursal />

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-marca/20 bg-marca/5 px-4 py-3 text-sm text-blue-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          La sucursal tiene <strong>{PLAZO_ESCANEO_DIAS} días</strong> desde la factura. Desde el día {PLAZO_ESCANEO_DIAS + 1} se avisa al
          gerente de la sucursal; desde el día {DIAS_ESCALAR_GERENCIA_GENERAL + 1}, también a la gerencia general.
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {tarjetas.map((t) => {
          const [clave, valor] = Object.entries(t.filtro)[0]
          const activa = params.get(clave) === valor
          return (
            <button
              key={t.titulo}
              type="button"
              onClick={() => setParams(activa ? {} : t.filtro, { replace: true })}
              className={`rounded-xl text-left transition ${activa ? 'ring-2 ring-marca' : 'hover:ring-2 hover:ring-slate-200'}`}
            >
              <Indicador titulo={t.titulo} valor={String(t.r.cantidad)} tono={t.tono} ayuda={`${formatoPesos(t.r.monto)} · ${t.ayuda}`} />
            </button>
          )
        })}
      </div>

      <Tabla
        key={params.toString()}
        filas={filas}
        columnas={columnas}
        clave={(x) => x.c.id}
        onFila={(x) => abrirLegajo(x.c.id)}
        buscar={(x) => [formatoComprobante(x.c), x.c.siniestro, x.c.patente, x.c.ref, x.c.sucursal].join(' ')}
        textoBusqueda="Buscar por número de factura, siniestro, patente o referencia"
        filtrosIniciales={filtrosIniciales}
        ordenInicial={{ clave: 'dias', dir: 'desc' }}
        exportar={exportar}
        resumen={(l) => (
          <>
            <strong>{l.length.toLocaleString('es-AR')}</strong> facturas · <strong>{formatoPesos(l.reduce((s, x) => s + x.c.total, 0))}</strong> retenidos
          </>
        )}
        vacio="No hay pendientes con estos filtros."
      />
    </>
  )
}
