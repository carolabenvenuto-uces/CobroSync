import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import { EnEsperaSucursal } from '../components/EnEspera'
import { ArrowLeft, ChevronRight, CircleCheck, Clock, FileUp, Info, PencilLine, Receipt, Search, Upload, X, ExternalLink } from 'lucide-react'
import { NotaCreditoModal } from '../components/NotaCreditoModal'
import { CargaMasiva } from '../components/CargaMasiva'
import { Chip, EtiquetaMipyme } from '../components/ui/Badges'
import { Tabla, type Columna } from '../components/ui/Tabla'
import { useApp, useComprobantes } from '../context/AppContext'
import { calcularSemaforo } from '../domain/semaforo'
import { esMipyme, plazosActuales, plazoSucursal } from '../domain/plazos'
import { diasDeEspera } from '../domain/sucursales'
import { claveSiniestro, contarPorSiniestro } from '../domain/siniestros'
import { paraResolver } from '../domain/resolver'
import { NOMBRE_PEDIDO, pedidosParaSucursal } from '../domain/pedidos'
import type { Etapa } from '../domain/tipos'
import { formatoComprobante, formatoFecha, formatoPesos } from '../lib/formato'

/** Las etiquetas de "Qué hay que hacer": qué documento falta, cuál se observó y cuál ya está. */
const NOMBRE_DOC = { factura: 'Factura', orden: 'Orden firmada' } as const
const ESTADO_DOC = {
  faltante: { marca: '+', texto: 'falta subirlo', clase: 'border-amber-300 bg-amber-50 text-amber-900' },
  observado: { marca: '!', texto: 'observada', clase: 'border-red-300 bg-red-50 text-red-800' },
  en_revision: { marca: '…', texto: 'en revisión', clase: 'border-sky-200 bg-sky-50 text-sky-800' },
  ok: { marca: '✓', texto: 'aprobada', clase: 'border-teal-200 bg-teal-50 text-teal-800' },
} as const

const CLAVE_AVISO = 'cobrosync-aviso-plazos'

/** Los cuatro estados de las facturas de la sucursal, en el orden en que se ven (de arriba hacia abajo). */
type Lista = 'rechazos' | 'vencer' | 'subir' | 'revision'

const LISTAS: { clave: Lista; titulo: string; ayuda: string; icono: ComponentType<{ className?: string }>; color: string; acento: string }[] = [
  {
    clave: 'subir',
    titulo: 'Para subir',
    ayuda: 'Falta la factura o la orden firmada',
    icono: Upload,
    color: 'border-sem-amarillo bg-white',
    acento: 'text-amber-900',
  },
  {
    clave: 'revision',
    titulo: 'En revisión',
    ayuda: 'Documentación enviada: sin tareas pendientes',
    icono: CircleCheck,
    color: 'border-sky-400 bg-white',
    acento: 'text-sky-800',
  },
  {
    clave: 'vencer',
    titulo: 'Por vencer o vencidas',
    ayuda: 'Pasaron el plazo o vencen en 2 días o menos',
    icono: Clock,
    color: 'border-orange-500/70 bg-orange-50',
    acento: 'text-orange-900',
  },
  {
    clave: 'rechazos',
    titulo: 'Rechazos y pedidos de Cobranzas',
    ayuda: 'Documentos no aceptados, errores de factura, refacturaciones y notas de crédito sin avisar',
    icono: PencilLine,
    color: 'border-sem-rojo/60 bg-sem-rojo/5',
    acento: 'text-red-800',
  },
]

const ETAPAS: Record<'subir' | 'revision', Etapa[]> = { subir: ['doc_pendiente', 'doc_atrasada'], revision: ['en_revision'] }

/**
 * Inicio de la sucursal: los cuatro estados de sus facturas en tarjetas. Cada tarjeta abre su
 * listado en una pantalla encima, que se cierra para volver acá.
 */
export default function MisFacturas() {
  const { sucursal, hoy, abrirLegajo, misNotificaciones } = useApp()
  const navigate = useNavigate()
  const comprobantes = useComprobantes()
  const porSiniestro = useMemo(() => contarPorSiniestro(comprobantes), [comprobantes])
  const [abierta, setAbierta] = useState<Lista | null>(null)
  const [soloMipyme, setSoloMipyme] = useState(false)
  const [modalNc, setModalNc] = useState(false)
  const [cargaMasiva, setCargaMasiva] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const sinLeer = misNotificaciones.filter((n) => !n.leida).length

  // Aviso de plazos: grande la primera vez; al cerrarlo "vuela" hasta el botón Plazos, para que se vea dónde queda
  const [avisoPlazos, setAvisoPlazos] = useState(() => {
    try {
      return localStorage.getItem(CLAVE_AVISO) !== 'visto'
    } catch {
      return false
    }
  })
  const [saliendo, setSaliendo] = useState<{ x: number; y: number } | null>(null)
  const [resaltar, setResaltar] = useState(false)
  const botonPlazos = useRef<HTMLButtonElement>(null)
  const cartel = useRef<HTMLDivElement>(null)
  const cerrarAviso = () => {
    try {
      localStorage.setItem(CLAVE_AVISO, 'visto')
    } catch {
      /* se vuelve a mostrar la próxima vez */
    }
    const b = botonPlazos.current?.getBoundingClientRect()
    const c = cartel.current?.getBoundingClientRect()
    if (!b || !c || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setAvisoPlazos(false)
      return
    }
    setSaliendo({ x: b.left + b.width / 2 - (c.left + c.width / 2), y: b.top + b.height / 2 - (c.top + c.height / 2) })
    window.setTimeout(() => {
      setAvisoPlazos(false)
      setSaliendo(null)
      setResaltar(true)
      window.setTimeout(() => setResaltar(false), 1600)
    }, 550)
  }

  // Al abrirlo, el cartel sale del botón Plazos y se agranda (el mismo movimiento que al cerrarlo, al revés).
  // La primera vez, que se abre solo, aparece con un leve acercamiento.
  useLayoutEffect(() => {
    const el = cartel.current
    if (!avisoPlazos || !el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const b = botonPlazos.current?.getBoundingClientRect()
    const c = el.getBoundingClientRect()
    const desde = b && b.width > 0 ? `translate(${b.left + b.width / 2 - (c.left + c.width / 2)}px, ${b.top + b.height / 2 - (c.top + c.height / 2)}px) scale(0.06)` : 'scale(0.92)'
    el.style.transition = 'none'
    el.style.transform = desde
    el.style.opacity = '0.2'
    void el.offsetWidth // aplica el punto de partida antes de animar
    el.style.transition = ''
    el.style.transform = ''
    el.style.opacity = ''
  }, [avisoPlazos])

  // La pantalla del listado se cierra también con Escape
  useEffect(() => {
    if (!abierta) return
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && setAbierta(null)
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [abierta])

  const filas = useMemo(
    () =>
      comprobantes
        .filter((c) => c.tipo === 'FC')
        .map((c) => ({ c, s: calcularSemaforo(c, hoy) }))
        .filter((x) => ['doc_pendiente', 'doc_atrasada', 'doc_observada', 'en_revision'].includes(x.s.etapa)),
    [comprobantes, hoy],
  )
  // Rechazos y por vencer, con su motivo y en orden de prioridad (MiPyME primero; ver domain/resolver.ts)
  const urgentes = useMemo(() => {
    const porId = new Map(filas.map((x) => [x.c.id, x]))
    return paraResolver(comprobantes, hoy)
      .map((p) => ({ x: porId.get(p.c.id)!, p }))
      .filter((u) => u.x)
  }, [comprobantes, filas, hoy])
  const motivo = new Map(urgentes.map((u) => [u.x.c.id, u.p]))
  // Pedidos de Cobranzas sin responder (también los de notas de crédito que entraron sin aviso)
  const pedidos = useMemo(() => pedidosParaSucursal(comprobantes, hoy), [comprobantes, hoy])
  const pedidoDe = new Map(pedidos.map((p) => [p.c.id, p]))

  const listaDe = (l: Lista) => {
    if (l === 'rechazos') {
      const rechazos = urgentes.filter((u) => u.p.tema === 'rechazo').map((u) => u.x)
      const ya = new Set(rechazos.map((x) => x.c.id))
      const conPedido = [...pedidoDe.values()].filter((p) => !ya.has(p.c.id)).map((p) => ({ c: p.c, s: calcularSemaforo(p.c, hoy) }))
      return [...rechazos, ...conPedido]
    }
    if (l === 'vencer') return urgentes.filter((u) => u.p.tema === 'documentacion').map((u) => u.x)
    return filas.filter((x) => ETAPAS[l].includes(x.s.etapa))
  }

  // El buscador busca en todas las facturas de la sucursal, no solo en las pendientes
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
      clave: 'factura',
      titulo: 'Factura',
      movil: 'titulo',
      orden: (x) => x.c.fecha,
      celda: (x) => (
        <div className="whitespace-nowrap">
          <div className="font-medium">{formatoComprobante(x.c)}</div>
          <div className="text-xs text-slate-500">{formatoFecha(x.c.fecha)}</div>
        </div>
      ),
    },
    {
      clave: 'dias',
      titulo: 'Días',
      orden: (x) => diasDeEspera(x.c, hoy),
      celda: (x) => {
        const d = diasDeEspera(x.c, hoy)
        return (
          <div>
            <span className={`text-lg font-extrabold ${d > plazoSucursal(x.c) && x.s.etapa !== 'en_revision' ? 'text-sem-rojo' : ''}`}>{d}</span>
            {esMipyme(x.c) && (
              <div className="mt-0.5">
                <EtiquetaMipyme texto={`MiPyME · ${plazoSucursal(x.c)} d`} />
              </div>
            )}
          </div>
        )
      },
    },
    {
      clave: 'siniestro',
      titulo: 'Siniestro',
      celda: (x) => {
        const n = porSiniestro.get(claveSiniestro(x.c)) ?? 0
        return (
          <span className="whitespace-nowrap">
            {x.c.siniestro}
            {n > 1 && <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600" title="Facturas del mismo siniestro (facturación parcial)">{n} facturas</span>}
          </span>
        )
      },
    },
    { clave: 'patente', titulo: 'Patente', oculta: true, celda: (x) => <span className="whitespace-nowrap">{x.c.patente}</span> },
    { clave: 'total', titulo: 'Total', derecha: true, orden: (x) => x.c.total, celda: (x) => <span className="whitespace-nowrap">{formatoPesos(x.c.total)}</span> },
    {
      clave: 'que',
      titulo: 'Qué hay que hacer',
      movil: 'ancha',
      celda: (x) => (
        <div className="flex flex-wrap gap-1.5">
          {x.c.tipo === 'NC' && <span className="text-xs text-slate-600">Nota de crédito: falta responder el pedido</span>}
          {x.c.tipo === 'FC' && (['factura', 'orden'] as const).map((tipo) => {
            const d = x.c.documentos.find((doc) => doc.tipo === tipo)
            const estado = d?.estado ?? 'faltante'
            const e = ESTADO_DOC[estado]
            const texto = estado === 'faltante' ? `+ Falta ${tipo === 'factura' ? 'la factura' : 'la orden firmada'}` : `${e.marca} ${NOMBRE_DOC[tipo]} ${e.texto}`
            const enDriveAnterior = estado === 'ok' && !!d && !d.url && !d.archivo
            const ayuda =
              estado === 'observado' && d?.motivo
                ? `${NOMBRE_DOC[tipo]}: ${d.motivo}`
                : enDriveAnterior
                  ? `${NOMBRE_DOC[tipo]}: guardado en Drive de ${x.c.sucursal} · gestión anterior`
                  : `${NOMBRE_DOC[tipo]}: ${e.texto}`
            const clase = `inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold ${e.clase}`
            // Si el documento ya está subido, se abre el PDF desde acá (sin abrir toda la factura)
            const url = d && estado !== 'faltante' ? (d.url ?? d.adjuntos?.find((x) => x.url)?.url) : undefined
            return url ? (
              <a key={tipo} href={url} target="_blank" rel="noreferrer" title={`${ayuda} · tocar para ver el PDF`} onClick={(ev) => ev.stopPropagation()} className={`${clase} hover:underline`}>
                {texto} <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span key={tipo} title={ayuda} className={clase}>
                {/* Se lee sola, sin leyenda: "Falta la orden firmada", "Factura aprobada" */}
                {texto}
              </span>
            )
          })}
          {x.c.compromiso && (
            x.c.compromiso.fecha >= hoy ? (
              <span className="w-full text-[11px] text-slate-500">Fecha estimada de entrega: {formatoFecha(x.c.compromiso.fecha)}</span>
            ) : (
              <span className="w-full text-[11px] font-semibold text-sem-rojo">La fecha estimada de entrega ({formatoFecha(x.c.compromiso.fecha)}) ya pasó</span>
            )
          )}
        </div>
      ),
    },
    {
      clave: 'accion',
      titulo: '',
      movil: 'accion',
      celda: (x) =>
        x.s.etapa === 'en_revision' && !pedidoDe.has(x.c.id) ? (
          <Chip tono="celeste">En revisión</Chip>
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
            {pedidoDe.has(x.c.id) ? (
              'Responder'
            ) : x.s.etapa === 'doc_observada' ? (
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

  const columnasResolver: Columna<Fila>[] = [
    {
      clave: 'motivo',
      movil: 'ancha',
      titulo: 'Por qué',
      orden: (x) => motivo.get(x.c.id)?.orden ?? 0,
      celda: (x) => {
        const p = motivo.get(x.c.id)
        const pedido = pedidoDe.get(x.c.id)
        return (
          <span className="flex min-w-[14rem] flex-col gap-0.5">
            {p && <span className={`text-xs font-semibold ${p.orden >= 2 ? 'text-sem-rojo' : 'text-amber-800'}`}>{p.motivo}</span>}
            {pedido && (
              <span className="text-xs font-semibold text-red-800">
                {NOMBRE_PEDIDO[pedido.pedido.tipo]}: {pedido.pedido.detalle}
              </span>
            )}
          </span>
        )
      },
    },
    ...columnas,
  ]

  const p = plazosActuales()
  const actual = abierta ? LISTAS.find((l) => l.clave === abierta)! : null
  const conPrioridad = abierta === 'rechazos' || abierta === 'vencer'
  const filasAbiertas = abierta ? listaDe(abierta).filter((x) => !soloMipyme || esMipyme(x.c)) : []

  return (
    <>
      {/* Encabezado: título, mensajes y el acceso a los plazos */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight">Mis facturas · {sucursal}</h1>
          {sinLeer > 0 && (
            <button type="button" onClick={() => navigate('/app/notificaciones')} className="mt-1 text-sm font-semibold text-marca hover:underline">
              {sinLeer} {sinLeer === 1 ? 'mensaje sin leer' : 'mensajes sin leer'} →
            </button>
          )}
        </div>
        <button
          ref={botonPlazos}
          type="button"
          onClick={() => setAvisoPlazos(true)}
          className={`inline-flex items-center gap-1.5 rounded-full border border-sem-amarillo/60 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 ${resaltar ? 'scale-110 ring-4 ring-sem-amarillo/50' : ''}`}
          title="Volver a leer los plazos"
        >
          <Info className="h-3.5 w-3.5" /> Plazos
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCargaMasiva(true)}
          title="Todos los PDF juntos: cada uno va a su factura por el número del nombre (35-11032 siniestro 22365.pdf)"
          className="inline-flex items-center gap-2 rounded-lg bg-marca px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-marca-oscuro"
        >
          <FileUp className="h-4 w-4" /> Subir varios PDF de una vez
        </button>
        <button
          type="button"
          onClick={() => setModalNc(true)}
          title="Para una factura que se anula, toda o una parte"
          className="inline-flex items-center gap-2 rounded-lg border border-marca/40 bg-white px-4 py-2 text-sm font-semibold text-marca shadow-sm hover:bg-marca/5"
        >
          <Receipt className="h-4 w-4" /> Informar una nota de crédito
        </button>
      </div>

      {/* Los cuatro estados, uno debajo del otro y a lo ancho; cada uno abre su listado */}
      <div className="mb-5 space-y-2">
        {LISTAS.map((l) => {
          const lista = listaDe(l.clave)
          const mipymes = l.clave === 'revision' ? 0 : lista.filter((x) => esMipyme(x.c)).length
          const Icono = l.icono
          return (
            <button
              key={l.clave}
              type="button"
              onClick={() => {
                setSoloMipyme(false)
                setAbierta(l.clave)
              }}
              className={`group flex w-full items-center gap-3 rounded-xl border border-l-[6px] px-4 py-3 text-left shadow-sm transition hover:shadow-md ${l.color}`}
            >
              <Icono className={`h-5 w-5 shrink-0 ${l.acento}`} />
              <span className="w-12 shrink-0 text-2xl font-extrabold tabular-nums">{lista.length}</span>
              <span className="min-w-0 flex-1">
                <span className={`flex flex-wrap items-center gap-2 font-bold ${l.acento}`}>
                  {l.titulo}
                  {mipymes > 0 && <EtiquetaMipyme texto={`${mipymes} MiPyME`} />}
                </span>
                <span className="block text-xs text-slate-600">{l.ayuda}</span>
              </span>
              <span className="hidden shrink-0 items-center gap-1 text-xs font-semibold text-marca group-hover:underline sm:inline-flex">
                Ver listado <ChevronRight className="h-4 w-4" />
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-marca sm:hidden" />
            </button>
          )
        })}
      </div>

      {/* PDF de facturas de hoy, hasta que Cobranzas cargue el ERP */}
      <div className="-mt-1 mb-3">
        <EnEsperaSucursal />
      </div>

      {/* Buscador, con el resultado justo abajo */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar cualquier factura por número, siniestro o patente"
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/20"
        />
      </div>
      {busqueda.trim().length >= 3 && (
        <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {encontradas.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">Sin facturas con ese número, siniestro o patente.</li>}
          {encontradas.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  abrirLegajo(c.id)
                  setBusqueda('')
                }}
                className="flex w-full flex-wrap justify-between gap-x-3 px-4 py-2.5 text-left text-sm hover:bg-fondo"
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

      {/* Listado de una tarjeta: pantalla encima, se cierra para volver a Mis facturas */}
      {actual && (
        <div className="fixed inset-0 z-40 flex items-stretch justify-center bg-noche/40 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="titulo-listado">
          <div className="flex w-full max-w-6xl flex-col overflow-hidden bg-fondo shadow-2xl sm:rounded-2xl">
            <div className={`flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3 sm:px-6 ${actual.color}`}>
              <button type="button" onClick={() => setAbierta(null)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-marca hover:bg-white/70">
                <ArrowLeft className="h-4 w-4" /> Mis facturas
              </button>
              <div className="min-w-0 flex-1">
                <h2 id="titulo-listado" className={`font-extrabold ${actual.acento}`}>
                  {actual.titulo} · {listaDe(actual.clave).length}
                </h2>
                <p className="text-xs text-slate-600">{actual.ayuda}</p>
              </div>
              {conPrioridad && (
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" checked={soloMipyme} onChange={(e) => setSoloMipyme(e.target.checked)} />
                  Solo MiPyME
                </label>
              )}
              <button type="button" onClick={() => setAbierta(null)} aria-label="Cerrar" className="rounded-lg p-1.5 hover:bg-white/70">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 sm:p-6">
              {conPrioridad && <p className="mb-2 text-xs text-slate-500">Orden de prioridad: primero las MiPyME, después lo más atrasado.</p>}
              <Tabla
                id={conPrioridad ? 'para-resolver' : 'mis-facturas'}
                key={`${abierta}-${soloMipyme}`}
                filas={filasAbiertas}
                columnas={conPrioridad ? columnasResolver : columnas}
                clave={(x) => x.c.id}
                onFila={(x) => abrirLegajo(x.c.id)}
                ordenInicial={conPrioridad ? undefined : { clave: 'dias', dir: 'desc' }}
                porPagina={20}
                resumen={(l) => `${l.length} ${l.length === 1 ? 'factura' : 'facturas'}`}
                vacio={abierta === 'revision' ? 'Sin facturas en revisión.' : 'Sin facturas en esta lista. Todo al día.'}
              />
            </div>
          </div>
        </div>
      )}

      {/* Aviso de plazos: grande la primera vez, después desde el botón "Plazos" */}
      {avisoPlazos && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-colors duration-500 ${saliendo ? 'bg-transparent' : 'bg-noche/50'}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-plazos"
        >
          <div
            ref={cartel}
            className={`w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl transition-all duration-500 ${saliendo ? 'ease-in' : 'ease-out'}`}
            style={saliendo ? { transform: `translate(${saliendo.x}px, ${saliendo.y}px) scale(0.06)`, opacity: 0.2 } : undefined}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <span className="rounded-md bg-sem-amarillo px-2 py-1 text-xs font-extrabold uppercase tracking-wide text-noche">Importante</span>
              <button type="button" onClick={cerrarAviso} aria-label="Cerrar" className="rounded-lg p-1 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <h2 id="titulo-plazos" className="text-lg font-extrabold">Plazos para subir la documentación</h2>
            <p className="mt-3 text-sm text-slate-700">
              <strong>{p.comun} días</strong> desde la fecha de la factura para subir la <strong>factura</strong> y la <strong>orden firmada</strong>.
            </p>
            <p className="mt-2 text-sm text-slate-700">
              Facturas <EtiquetaMipyme />: <strong>{p.mipyme} días</strong>. Conviene subirlas primero.
            </p>
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Si no es posible a tiempo: dentro de la factura, el botón <strong>"Avisar fecha estimada de entrega"</strong> permite indicar el motivo y
              el día previsto. Así Cobranzas sabe cuándo esperarla y la factura no figura como atrasada hasta esa fecha.
            </p>
            <button type="button" onClick={cerrarAviso} className="mt-5 w-full rounded-lg bg-marca px-4 py-2.5 text-sm font-semibold text-white hover:bg-marca-oscuro">
              Entendido
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-500">Este aviso queda en el botón "Plazos", arriba a la derecha.</p>
          </div>
        </div>
      )}

      {modalNc && <NotaCreditoModal onCerrar={() => setModalNc(false)} />}
      {cargaMasiva && <CargaMasiva onCerrar={() => setCargaMasiva(false)} />}
    </>
  )
}
