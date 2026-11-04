import { useMemo, type ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { BellRing, CalendarX2, FileCheck, FileClock, Megaphone, MessageSquareWarning, Receipt, Siren, TriangleAlert } from 'lucide-react'
import { EncabezadoPagina } from '../components/ui/Card'
import { useApp, useComprobantes } from '../context/AppContext'
import { estadoReclamo, NOMBRE_ESTADO_RECLAMO } from '../domain/reclamos'
import { calcularSemaforo } from '../domain/semaforo'
import { compromisoVencido, diasDeEspera, esperaALaSucursal, nivelEscaneo } from '../domain/sucursales'
import type { Comprobante } from '../domain/tipos'
import { formatoPesos } from '../lib/formato'

export interface Aviso {
  clave: string
  titulo: string
  descripcion: string
  icono: ComponentType<{ className?: string }>
  facturas: Comprobante[]
  /** a dónde lleva, ya filtrado */
  ruta: string
}

export interface SectorAvisos {
  sector: string
  explicacion: string
  color: string
  avisos: Aviso[]
}

/** La última intervención de una persona fue una observación o un rechazo que la sucursal no respondió. */
export function observadaSinRespuesta(c: Comprobante): boolean {
  const ultimo = c.eventos.filter((e) => e.area !== 'sistema').at(-1)
  return ultimo?.tipo === 'rechazo'
}

/** Todos los avisos, agrupados por quién tiene que actuar. También alimenta el contador del menú. */
export function calcularAvisos(comprobantes: Comprobante[], hoy: string): SectorAvisos[] {
  const deSucursal = comprobantes.filter((c) => esperaALaSucursal(c, hoy))
  const etapa = (c: Comprobante) => calcularSemaforo(c, hoy).etapa
  return [
    {
      sector: 'Sucursales',
      explicacion: 'Lo que las sucursales tienen que subir, corregir o informar',
      color: 'border-sem-amarillo',
      avisos: [
        {
          clave: 'criticas',
          titulo: 'Documentación crítica',
          descripcion: 'Más de 21 días sin la documentación completa (avisado a gerencia general)',
          icono: Siren,
          facturas: deSucursal.filter((c) => nivelEscaneo(c, diasDeEspera(c, hoy)) === 'critico'),
          ruta: '/app/pendientes?estado=Crítica',
        },
        {
          clave: 'atrasadas',
          titulo: 'Documentación atrasada',
          descripcion: 'Entre 8 y 21 días (avisado al gerente de la sucursal)',
          icono: TriangleAlert,
          facturas: deSucursal.filter((c) => nivelEscaneo(c, diasDeEspera(c, hoy)) === 'atrasado'),
          ruta: '/app/pendientes?estado=Atrasada',
        },
        {
          clave: 'compromisos',
          titulo: 'Compromisos vencidos',
          descripcion: 'La sucursal prometió una fecha para subirlo y ya pasó',
          icono: CalendarX2,
          facturas: comprobantes.filter((c) => compromisoVencido(c, hoy)),
          ruta: '/app/pendientes?situacion=Compromiso vencido',
        },
        {
          clave: 'observadas',
          titulo: 'Observadas sin respuesta',
          descripcion: 'Se le devolvió a la sucursal y todavía no respondió',
          icono: MessageSquareWarning,
          facturas: deSucursal.filter(observadaSinRespuesta),
          ruta: '/app/pendientes?situacion=Observada sin respuesta',
        },
        {
          clave: 'nc',
          titulo: 'Notas de crédito sin aviso',
          descripcion: 'Aparecieron en el ERP y la sucursal no las informó',
          icono: Receipt,
          facturas: comprobantes.filter((c) => c.tipo === 'NC' && c.ncInformada === false),
          ruta: '/app/control-diario?nc=Sin aviso',
        },
      ],
    },
    {
      sector: 'Auditoría',
      explicacion: 'Lo que nos toca a nosotras',
      color: 'border-marca',
      avisos: [
        {
          clave: 'revisar',
          titulo: 'Para revisar y tildar',
          descripcion: 'La sucursal subió la factura, la orden y la firma',
          icono: FileCheck,
          facturas: comprobantes.filter((c) => etapa(c) === 'en_revision'),
          ruta: '/app/control-diario?estado=En revisión',
        },
        {
          clave: 'presentar',
          titulo: 'Para presentar',
          descripcion: 'Documentación aprobada, falta presentarla a la compañía',
          icono: FileClock,
          facturas: comprobantes.filter((c) => etapa(c) === 'pres_pendiente'),
          ruta: '/app/control-diario?estado=Pres. pendiente',
        },
        {
          clave: 'anulaciones',
          titulo: 'Notas de crédito avisadas',
          descripcion: 'La sucursal avisó una nota de crédito (total o parcial) que todavía no llegó del ERP',
          icono: Receipt,
          facturas: comprobantes.filter((c) => c.tipo === 'FC' && c.anulacionInformada && c.estado !== 'anulada'),
          ruta: '/app/control-diario?nc=Anulación informada',
        },
      ],
    },
    {
      sector: 'Compañías',
      explicacion: 'Facturas presentadas que vencieron sin cobrarse',
      color: 'border-etapa-compania',
      avisos: [
        {
          clave: 'sin-reclamar',
          titulo: 'Vencidas sin reclamar',
          descripcion: 'Todavía no se hizo ningún reclamo',
          icono: BellRing,
          facturas: comprobantes.filter((c) => estadoReclamo(c, hoy) === 'sin_reclamar'),
          ruta: '/app/reclamos?estado=Sin reclamar',
        },
        {
          clave: 'escalar',
          titulo: 'Sin respuesta: pedir apoyo a gerencia',
          descripcion: 'La compañía no respondió a 3 reclamos',
          icono: Megaphone,
          facturas: comprobantes.filter((c) => estadoReclamo(c, hoy) === 'escalar'),
          ruta: `/app/reclamos?estado=${encodeURIComponent(NOMBRE_ESTADO_RECLAMO.escalar)}`,
        },
      ],
    },
  ]
}

export default function Avisos() {
  const { hoy } = useApp()
  const comprobantes = useComprobantes()
  const sectores = useMemo(() => calcularAvisos(comprobantes, hoy), [comprobantes, hoy])

  return (
    <>
      <EncabezadoPagina
        titulo="Avisos"
        subtitulo="Lo que necesita atención, separado por quién tiene que actuar. Tocá un aviso para ver las facturas."
        sucursal
      />

      <div className="space-y-6">
        {sectores.map((s) => (
          <section key={s.sector} className={`rounded-2xl border-l-4 bg-white p-5 shadow-sm ${s.color}`}>
            <div className="mb-4">
              <h2 className="text-lg font-extrabold">{s.sector}</h2>
              <p className="text-sm text-slate-500">{s.explicacion}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {s.avisos.map((a) => {
                const Icono = a.icono
                const monto = a.facturas.reduce((t, c) => t + Math.abs(c.total), 0)
                const vacio = a.facturas.length === 0
                return (
                  <Link
                    key={a.clave}
                    to={a.ruta}
                    className={`group flex items-start gap-4 rounded-xl border p-4 transition ${
                      vacio ? 'border-slate-100 opacity-60' : 'border-slate-200 hover:border-marca/50 hover:shadow'
                    }`}
                  >
                    <div className={`rounded-lg p-2.5 ${vacio ? 'bg-slate-100 text-slate-400' : 'bg-fondo text-noche'}`}>
                      <Icono className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="font-bold">{a.titulo}</h3>
                        <span className="text-3xl font-extrabold tabular-nums">{a.facturas.length}</span>
                      </div>
                      <p className="text-xs text-slate-500">{a.descripcion}</p>
                      {!vacio && <p className="mt-2 text-sm font-semibold tabular-nums">{formatoPesos(monto)}</p>}
                      {!vacio && <p className="mt-1 text-xs font-semibold text-marca group-hover:underline">Ver facturas →</p>}
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}
