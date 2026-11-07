import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarClock } from 'lucide-react'
import { Chip, nombreEtapa } from '../components/ui/Badges'
import { EncabezadoPagina } from '../components/ui/Card'
import { FiltroRapido } from '../components/ui/FiltroRapido'
import { PestanasSucursales } from '../components/PestanasSucursales'
import { Tabla, type Columna } from '../components/ui/Tabla'
import { useApp, useComprobantes } from '../context/AppContext'
import { calcularSemaforo } from '../domain/semaforo'
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
 * Los atajos de arriba y los filtros de las columnas filtran la misma tabla.
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
            nivel: nivelEscaneo(c, dias),
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
  // Atajos arriba de la tabla: usan los mismos filtros de las columnas
  const atajos: { clave: string; titulo: string; filtro: Record<string, string>; alerta?: boolean; r: { cantidad: number; monto: number } }[] = [
    { clave: 'todas', titulo: 'Todas', filtro: {}, r: resumen(() => true) },
    { clave: 'plazo', titulo: 'En plazo', filtro: { estado: 'En plazo' }, r: resumen((x) => x.nivel === 'en_plazo') },
    { clave: 'atrasada', titulo: 'Atrasadas', filtro: { estado: 'Atrasada' }, alerta: true, r: resumen((x) => x.nivel === 'atrasado') },
    { clave: 'critica', titulo: 'Críticas', filtro: { estado: 'Crítica' }, alerta: true, r: resumen((x) => x.nivel === 'critico') },
    { clave: 'compromiso', titulo: 'Compromiso vencido', filtro: { situacion: 'Compromiso vencido' }, alerta: true, r: resumen((x) => x.situacion === 'Compromiso vencido') },
  ]
  const atajoActivo =
    atajos.slice(1).find((a) => Object.entries(a.filtro).every(([k, v]) => params.get(k) === v))?.clave ?? 'todas'
  const filtrosIniciales = Object.fromEntries(params.entries())

  const columnas: Columna<Fila>[] = [
    {
      // Días de espera y si está en plazo, en una sola celda; a quién se escaló, al pasar el mouse
      clave: 'estado',
      titulo: 'Espera',
      orden: (x) => x.dias,
      filtro: (x) => NOMBRE_ESTADO[x.nivel],
      celda: (x) => (
        <div className="flex items-center gap-2 whitespace-nowrap" title={x.nivel === 'en_plazo' ? undefined : `Escalado a ${avisoA(x.nivel, x.sucursal)}`}>
          <span className="w-7 text-right text-base font-extrabold tabular-nums">{x.dias}</span>
          <Chip tono={TONO[x.nivel]}>{NOMBRE_ESTADO[x.nivel]}</Chip>
        </div>
      ),
    },
    { clave: 'sucursal', titulo: 'Sucursal', filtro: (x) => x.c.sucursal, orden: (x) => x.c.sucursal, celda: (x) => <span className="whitespace-nowrap">{x.c.sucursal}</span> },
    {
      clave: 'factura', movil: 'titulo',
      titulo: 'Factura',
      orden: (x) => x.c.fecha,
      celda: (x) => (
        <div className="whitespace-nowrap">
          <div className="font-medium">{formatoComprobante(x.c)}</div>
          <div className="text-xs text-slate-500">{formatoFecha(x.c.fecha)}</div>
        </div>
      ),
    },
    {
      clave: 'compania',
      titulo: 'Compañía / siniestro',
      filtro: (x) => nombreCompania(x.c.aseguradoraId),
      celda: (x) => (
        <div className="whitespace-nowrap">
          {nombreCompania(x.c.aseguradoraId)}
          {x.c.siniestro && <div className="text-[11px] text-slate-500">{x.c.siniestro}</div>}
        </div>
      ),
    },
    { clave: 'patente', titulo: 'Patente', oculta: true, celda: (x) => <span className="whitespace-nowrap">{x.c.patente}</span> },
    { clave: 'total', titulo: 'Total', derecha: true, orden: (x) => x.c.total, celda: (x) => <span className="whitespace-nowrap font-semibold">{formatoPesos(x.c.total)}</span> },
    {
      clave: 'falta', movil: 'ancha',
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
      clave: 'situacion', movil: 'ancha',
      titulo: 'Respuesta de la sucursal',
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
    { clave: 'aviso', titulo: 'Escalado a', oculta: true, filtro: (x) => avisoA(x.nivel, x.sucursal), celda: (x) => <span className="whitespace-nowrap text-xs">{avisoA(x.nivel, x.sucursal)}</span> },
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
      <EncabezadoPagina titulo="Pendientes de sucursales" sucursal />
      <PestanasSucursales />
      <FiltroRapido
        opciones={atajos.map((a) => ({ clave: a.clave, titulo: a.titulo, cantidad: a.r.cantidad, monto: a.r.monto, alerta: a.alerta }))}
        activa={atajoActivo}
        onElegir={(clave) => {
          // conserva el filtro de sucursal que venga de un aviso
          const nuevos = new URLSearchParams(params)
          nuevos.delete('estado')
          nuevos.delete('situacion')
          Object.entries(atajos.find((a) => a.clave === clave)?.filtro ?? {}).forEach(([k, v]) => nuevos.set(k, v))
          setParams(nuevos, { replace: true })
        }}
      />

      <Tabla
        id="pendientes-v2"
        key={params.toString()}
        filas={filas}
        columnas={columnas}
        clave={(x) => x.c.id}
        onFila={(x) => abrirLegajo(x.c.id)}
        buscar={(x) => [formatoComprobante(x.c), x.c.siniestro, x.c.patente, x.c.ref, x.c.sucursal].join(' ')}
        textoBusqueda="Buscar por número de factura, siniestro, patente o referencia"
        filtrosIniciales={filtrosIniciales}
        ordenInicial={{ clave: 'estado', dir: 'desc' }}
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
