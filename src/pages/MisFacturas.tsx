import { useMemo, useState, type ComponentType } from 'react'
import { CircleCheck, FileUp, PencilLine, Receipt, Search, Upload } from 'lucide-react'
import { NotaCreditoModal } from '../components/NotaCreditoModal'
import { Chip } from '../components/ui/Badges'
import { Tabla, type Columna } from '../components/ui/Tabla'
import { useApp, useComprobantes } from '../context/AppContext'
import { calcularSemaforo, PLAZO_ESCANEO_DIAS } from '../domain/semaforo'
import { diasDeEspera } from '../domain/sucursales'
import type { Etapa } from '../domain/tipos'
import { formatoComprobante, formatoFecha, formatoPesos } from '../lib/formato'

type Grupo = 'subir' | 'corregir' | 'revision'

const GRUPOS: { clave: Grupo; titulo: string; ayuda: string; etapas: Etapa[]; icono: ComponentType<{ className?: string }>; color: string }[] = [
  {
    clave: 'subir',
    titulo: 'Para subir',
    ayuda: 'Falta la factura, la orden o la firma',
    etapas: ['doc_pendiente', 'doc_atrasada'],
    icono: Upload,
    color: 'border-sem-amarillo bg-sem-amarillo/10',
  },
  {
    clave: 'corregir',
    titulo: 'Para corregir',
    ayuda: 'Auditoría observó un documento: hay que reemplazarlo',
    etapas: ['doc_observada'],
    icono: PencilLine,
    color: 'border-sem-rojo bg-sem-rojo/5',
  },
  {
    clave: 'revision',
    titulo: 'En revisión',
    ayuda: 'Ya subiste todo: Auditoría lo está revisando. No tenés que hacer nada',
    etapas: ['en_revision'],
    icono: CircleCheck,
    color: 'border-sky-400 bg-sky-50',
  },
]

/**
 * Inicio de la sucursal: qué tiene que hacer hoy, en tres grupos, con un buscador grande.
 * Cada factura tiene un botón "Subir documentación" que abre su legajo.
 */
export default function MisFacturas() {
  const { sucursal, hoy, abrirLegajo, misNotificaciones } = useApp()
  const comprobantes = useComprobantes()
  const [grupo, setGrupo] = useState<Grupo | 'todas'>('todas')
  const [modalNc, setModalNc] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const sinLeer = misNotificaciones.filter((n) => !n.leida).length

  const filas = useMemo(
    () =>
      comprobantes
        .filter((c) => c.tipo === 'FC')
        .map((c) => ({ c, s: calcularSemaforo(c, hoy) }))
        .filter((x) => GRUPOS.some((g) => g.etapas.includes(x.s.etapa))),
    [comprobantes, hoy],
  )
  const cuenta = (g: Grupo) => filas.filter((x) => GRUPOS.find((gr) => gr.clave === g)!.etapas.includes(x.s.etapa)).length
  const visibles = grupo === 'todas' ? filas : filas.filter((x) => GRUPOS.find((g) => g.clave === grupo)!.etapas.includes(x.s.etapa))

  // El buscador grande busca en todas las facturas de la sucursal, no solo en las pendientes
  const encontradas = useMemo(() => {
    const t = busqueda.trim().toLowerCase()
    if (t.length < 3) return []
    return comprobantes
      .filter((c) => [formatoComprobante(c), c.siniestro, c.patente, c.ref].join(' ').toLowerCase().includes(t))
      .slice(0, 8)
  }, [busqueda, comprobantes])

  type Fila = (typeof filas)[number]
  const columnas: Columna<Fila>[] = [
    {
      clave: 'dias',
      titulo: 'Días',
      orden: (x) => diasDeEspera(x.c, hoy),
      celda: (x) => {
        const d = diasDeEspera(x.c, hoy)
        return <span className={`text-lg font-extrabold ${d > PLAZO_ESCANEO_DIAS && x.s.etapa !== 'en_revision' ? 'text-sem-rojo' : ''}`}>{d}</span>
      },
    },
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
    { clave: 'siniestro', titulo: 'Siniestro', celda: (x) => <span className="whitespace-nowrap">{x.c.siniestro}</span> },
    { clave: 'patente', titulo: 'Patente', celda: (x) => <span className="whitespace-nowrap">{x.c.patente}</span> },
    { clave: 'total', titulo: 'Total', derecha: true, orden: (x) => x.c.total, celda: (x) => <span className="whitespace-nowrap">{formatoPesos(x.c.total)}</span> },
    {
      clave: 'que',
      titulo: 'Qué hay que hacer',
      celda: (x) => (
        <div className="text-xs">
          {(x.s.detalle.length > 1 ? x.s.detalle.slice(1) : x.s.detalle).map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
      ),
    },
    {
      clave: 'accion',
      titulo: '',
      celda: (x) =>
        x.s.etapa === 'en_revision' ? (
          <Chip tono="azul">En revisión</Chip>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              abrirLegajo(x.c.id)
            }}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-marca px-3 py-2 text-sm font-semibold text-white hover:bg-marca-oscuro"
          >
            <FileUp className="h-4 w-4" />
            {x.s.etapa === 'doc_observada' ? (
              'Corregir'
            ) : (
              <>
                <span className="xl:hidden">Subir</span>
                <span className="hidden xl:inline">Subir documentación</span>
              </>
            )}
          </button>
        ),
    },
  ]

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Mis facturas · {sucursal}</h1>
          <p className="mt-1 text-sm text-slate-600">
            <strong>¿Qué tengo que hacer hoy?</strong> Subir lo que falta, corregir lo observado y mirar las notificaciones
            {sinLeer > 0 && <strong className="text-marca"> ({sinLeer} sin leer, en el menú de la izquierda)</strong>}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalNc(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold shadow-sm hover:bg-fondo"
        >
          <Receipt className="h-4 w-4" /> Informar nota de crédito
        </button>
      </div>

      {/* Buscador grande */}
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscá cualquier factura por número, siniestro o patente"
          className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-base shadow-sm focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/20"
        />
        {encontradas.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            {encontradas.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    abrirLegajo(c.id)
                    setBusqueda('')
                  }}
                  className="flex w-full justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-fondo"
                >
                  <span className="font-medium">{formatoComprobante(c)}</span>
                  <span className="text-slate-500">
                    {c.siniestro} · {c.patente} · {formatoFecha(c.fecha)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Tres grupos grandes */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {GRUPOS.map((g) => {
          const Icono = g.icono
          const activo = grupo === g.clave
          return (
            <button
              key={g.clave}
              type="button"
              onClick={() => setGrupo(activo ? 'todas' : g.clave)}
              className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition ${g.color} ${activo ? 'ring-2 ring-marca' : ''}`}
            >
              <Icono className="mt-1 h-6 w-6 shrink-0" />
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold">{cuenta(g.clave)}</span>
                  <span className="font-bold">{g.titulo}</span>
                </div>
                <p className="text-xs text-slate-600">{g.ayuda}</p>
              </div>
            </button>
          )
        })}
      </div>

      <p className="mb-2 text-xs text-slate-500">
        Tenés {PLAZO_ESCANEO_DIAS} días desde la factura para subir la factura, la orden de reparación o repuestos y la firma del cliente. Si no
        podés, entrá a la factura y tocá "No lo puedo subir todavía".
      </p>

      <Tabla
        filas={visibles}
        columnas={columnas}
        clave={(x) => x.c.id}
        onFila={(x) => abrirLegajo(x.c.id)}
        ordenInicial={{ clave: 'dias', dir: 'desc' }}
        resumen={(l) => `${l.length} facturas ${grupo === 'todas' ? 'con algo pendiente' : `· ${GRUPOS.find((g) => g.clave === grupo)!.titulo.toLowerCase()}`}`}
        vacio="No tenés nada pendiente. ¡Todo al día!"
      />

      {modalNc && <NotaCreditoModal onCerrar={() => setModalNc(false)} />}
    </>
  )
}
