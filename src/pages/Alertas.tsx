import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BellRing, CalendarX2, FileClock, MessageSquareWarning, Receipt, Siren } from 'lucide-react'
import { LegajoPanel } from '../components/LegajoPanel'
import { Card, EncabezadoPagina } from '../components/ui/Card'
import { useApp, useComprobantes } from '../context/AppContext'
import { calcularSemaforo, estaVencido } from '../domain/semaforo'
import { compromisoVencido, diasDeEspera, esperaALaSucursal, nivelEscaneo } from '../domain/sucursales'
import type { Comprobante } from '../domain/tipos'
import { diffDias } from '../lib/fechas'
import { formatoComprobante, formatoFecha, formatoPesos } from '../lib/formato'

const MAXIMO_VISIBLE = 6

export interface GrupoAlertas {
  clave: string
  titulo: string
  descripcion: string
  quien: string
  icono: ReactNode
  tono: 'rojo' | 'amarillo' | 'azul' | 'violeta'
  items: { c: Comprobante; detalle: string }[]
  verTodos?: string
}

/** Calcula todas las alertas a partir de los comprobantes (también se usa para el contador del menú). */
export function calcularAlertas(comprobantes: Comprobante[], hoy: string, nombreCompania: (id: string) => string): GrupoAlertas[] {
  const pendientesSucursal = comprobantes.filter((c) => esperaALaSucursal(c, hoy))
  // Último movimiento de una persona (los avisos automáticos no cuentan como respuesta)
  const ultimoEvento = (c: Comprobante) => c.eventos.filter((e) => e.area !== 'sistema').at(-1)

  return [
    {
      clave: 'criticos',
      titulo: 'Escaneos críticos',
      descripcion: 'Más de 21 días sin legajo completo. Se avisó a la gerencia general.',
      quien: 'Sucursal',
      icono: <Siren className="h-5 w-5" />,
      tono: 'rojo',
      items: pendientesSucursal
        .filter((c) => nivelEscaneo(diasDeEspera(c, hoy)) === 'critico')
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .map((c) => ({ c, detalle: `${diasDeEspera(c, hoy)} días · ${c.sucursal}` })),
      verTodos: '/app/pendientes?nivel=critico',
    },
    {
      clave: 'compromisos',
      titulo: 'Compromisos vencidos',
      descripcion: 'La sucursal prometió una fecha para subir el legajo y ya pasó.',
      quien: 'Sucursal',
      icono: <CalendarX2 className="h-5 w-5" />,
      tono: 'rojo',
      items: comprobantes
        .filter((c) => compromisoVencido(c, hoy))
        .map((c) => ({
          c,
          detalle: `Prometido para el ${formatoFecha(c.compromiso!.fecha)} · ${c.sucursal}`,
        })),
    },
    {
      clave: 'rechazos',
      titulo: 'Rechazos sin respuesta',
      descripcion: 'Se devolvió el legajo a la sucursal y todavía no respondió.',
      quien: 'Sucursal',
      icono: <MessageSquareWarning className="h-5 w-5" />,
      tono: 'amarillo',
      items: pendientesSucursal
        .filter((c) => ultimoEvento(c)?.tipo === 'rechazo')
        .map((c) => ({ c, detalle: `Rechazado el ${formatoFecha(ultimoEvento(c)?.fecha ?? null)} · ${c.sucursal}` })),
    },
    {
      clave: 'nc',
      titulo: 'Notas de crédito sin aviso',
      descripcion: 'Aparecieron en el ERP pero la sucursal no las informó.',
      quien: 'Sucursal',
      icono: <Receipt className="h-5 w-5" />,
      tono: 'amarillo',
      items: comprobantes
        .filter((c) => c.tipo === 'NC' && c.ncInformada === false)
        .map((c) => ({ c, detalle: `${formatoPesos(c.total)} · ${c.sucursal}` })),
    },
    {
      clave: 'presentar',
      titulo: 'Listos para presentar hace más de 2 días',
      descripcion: 'El legajo está completo y todavía no se presentó a la compañía.',
      quien: 'Auditoría',
      icono: <FileClock className="h-5 w-5" />,
      tono: 'azul',
      items: comprobantes
        .filter(
          (c) =>
            calcularSemaforo(c, hoy).etapa === 'para_presentar' &&
            c.fechaDrive !== null &&
            diffDias(c.fechaDrive, hoy) > 2,
        )
        .map((c) => ({ c, detalle: `Completo desde el ${formatoFecha(c.fechaDrive)} · ${nombreCompania(c.aseguradoraId)}` })),
      verTodos: '/app/control-diario?etapa=para_presentar&periodo=anio',
    },
    {
      clave: 'vencidos',
      titulo: 'Vencidos sin cobrar',
      descripcion: 'Presentados, con el plazo de pago cumplido: hay que reclamar a la compañía.',
      quien: 'Compañía',
      icono: <BellRing className="h-5 w-5" />,
      tono: 'violeta',
      items: comprobantes
        .filter((c) => estaVencido(c, hoy))
        .sort((a, b) => (a.vencimiento ?? '').localeCompare(b.vencimiento ?? ''))
        .map((c) => ({
          c,
          detalle: `Venció el ${formatoFecha(c.vencimiento)} · ${nombreCompania(c.aseguradoraId)}`,
        })),
    },
  ]
}

const ESTILO_TONO = {
  rojo: 'bg-sem-rojo/10 text-sem-rojo',
  amarillo: 'bg-sem-amarillo/15 text-amber-700',
  azul: 'bg-etapa-auditoria/10 text-etapa-auditoria',
  violeta: 'bg-etapa-compania/10 text-etapa-compania',
}

export default function Alertas() {
  const { datos, rol, hoy, actualizarComprobante, registrarEvento } = useApp()
  const comprobantes = useComprobantes()
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null)
  const grupos = useMemo(
    () => calcularAlertas(comprobantes, hoy, (id) => datos!.aseguradoras.find((a) => a.id === id)?.nombre ?? id),
    [comprobantes, hoy, datos],
  )
  const seleccionado = comprobantes.find((c) => c.id === seleccionadoId) ?? null

  function marcarNcRevisada(c: Comprobante) {
    actualizarComprobante(c.id, { ncInformada: true })
    registrarEvento(c.id, 'mensaje', 'Auditoría revisó la nota de crédito')
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Alertas"
        subtitulo="Lo que necesita atención hoy, agrupado por quién tiene que actuar"
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {grupos.map((g) => (
          <Card key={g.clave}>
            <div className="flex items-start gap-3">
              <div className={`rounded-lg p-2 ${ESTILO_TONO[g.tono]}`}>{g.icono}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-bold">{g.titulo}</h2>
                  <span className="text-2xl font-extrabold">{g.items.length}</span>
                </div>
                <p className="text-xs text-slate-500">
                  {g.descripcion} <span className="font-semibold">Le toca a: {g.quien}.</span>
                </p>
              </div>
            </div>
            {g.items.length > 0 && (
              <ul className="mt-4 divide-y divide-slate-100 text-sm">
                {g.items.slice(0, MAXIMO_VISIBLE).map(({ c, detalle }) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                    <button
                      type="button"
                      onClick={() => setSeleccionadoId(c.id)}
                      className="min-w-0 text-left hover:text-marca"
                    >
                      <div className="font-medium">{formatoComprobante(c)}</div>
                      <div className="truncate text-xs text-slate-500">{detalle}</div>
                    </button>
                    {g.clave === 'nc' && rol === 'auditoria' ? (
                      <button
                        type="button"
                        onClick={() => marcarNcRevisada(c)}
                        className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold hover:bg-fondo"
                      >
                        Marcar revisada
                      </button>
                    ) : (
                      <span className="shrink-0 font-semibold">{formatoPesos(Math.abs(c.total))}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {g.items.length > MAXIMO_VISIBLE && (
              <div className="mt-2 text-xs text-slate-500">
                y {g.items.length - MAXIMO_VISIBLE} más
                {g.verTodos && (
                  <>
                    {' · '}
                    <Link to={g.verTodos} className="font-semibold text-marca hover:underline">
                      ver todos
                    </Link>
                  </>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
      {seleccionado && <LegajoPanel comprobante={seleccionado} onCerrar={() => setSeleccionadoId(null)} />}
    </>
  )
}
