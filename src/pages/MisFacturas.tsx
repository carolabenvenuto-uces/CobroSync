import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { EnEsperaSucursal } from '../components/EnEspera'
import { FileUp, Info, Receipt, X } from 'lucide-react'
import { NotaCreditoModal } from '../components/NotaCreditoModal'
import { archivosSoltados, CargaMasiva } from '../components/CargaMasiva'
import { BadgeEtapa, Chip, EtiquetaMipyme, nombreEtapa } from '../components/ui/Badges'
import { Tabla, type Columna } from '../components/ui/Tabla'
import { useApp, useComprobantes } from '../context/AppContext'
import { calcularSemaforo } from '../domain/semaforo'
import { esMipyme, plazosActuales, plazoSucursal } from '../domain/plazos'
import { diasDeEspera } from '../domain/sucursales'
import { claveSiniestro, contarPorSiniestro } from '../domain/siniestros'
import { paraResolver } from '../domain/resolver'
import { NOMBRE_PEDIDO, pedidosParaSucursal } from '../domain/pedidos'
import type { Comprobante, Etapa } from '../domain/tipos'
import { formatoComprobante, formatoFecha, formatoPesos } from '../lib/formato'

/** Las etiquetas de "Qué hay que hacer": qué documento falta, cuál se observó y cuál ya está. */
const NOMBRE_DOC = { factura: 'Factura', orden: 'Orden firmada' } as const
const ESTADO_DOC = {
  faltante: { texto: 'falta subirlo' },
  observado: { texto: 'observada' },
  en_revision: { texto: 'en revisión' },
  ok: { texto: 'aprobada' },
} as const

/**
 * Qué le falta a la factura, en una línea de texto sin recuadros: "Faltante", "Falta orden",
 * "Orden firmada observada", "Factura aprobada · Orden firmada en revisión". Lo subido abre el PDF.
 */
function QueFalta({ c }: { c: Comprobante }) {
  const docs = (['factura', 'orden'] as const).map((tipo) => ({ tipo, d: c.documentos.find((doc) => doc.tipo === tipo) }))
  const faltan = docs.filter((x) => (x.d?.estado ?? 'faltante') === 'faltante')
  const resto = docs.filter((x) => (x.d?.estado ?? 'faltante') !== 'faltante')
  const partes: ReactNode[] = []
  if (faltan.length === 2) partes.push(<span key="faltan" className="font-semibold text-amber-900">Faltante</span>)
  else if (faltan.length === 1) partes.push(<span key="faltan" className="font-semibold text-amber-900">Falta {faltan[0].tipo === 'factura' ? 'factura' : 'orden'}</span>)
  for (const { tipo, d } of resto) {
    const estado = d!.estado as Exclude<keyof typeof ESTADO_DOC, 'faltante'>
    const texto = `${NOMBRE_DOC[tipo]} ${ESTADO_DOC[estado].texto}`
    const clase = estado === 'observado' ? 'font-semibold text-orange-700' : 'text-slate-500'
    const ayuda = estado === 'observado' && d!.motivo ? `${NOMBRE_DOC[tipo]}: ${d!.motivo}` : estado === 'ok' && !d!.url && !d!.archivo ? `Guardado en Drive de ${c.sucursal} · gestión anterior` : undefined
    const url = d!.url ?? d!.adjuntos?.find((a) => a.url)?.url
    partes.push(
      url ? (
        <a key={tipo} href={url} target="_blank" rel="noreferrer" title={ayuda ? `${ayuda} · ver el PDF` : 'Ver el PDF'} onClick={(ev) => ev.stopPropagation()} className={`${clase} hover:underline`}>
          {texto}
        </a>
      ) : (
        <span key={tipo} title={ayuda} className={clase}>
          {texto}
        </span>
      ),
    )
  }
  return (
    <span className="whitespace-nowrap">
      {partes.map((p, i) => (
        <span key={i}>
          {i > 0 && <span className="text-slate-300"> · </span>}
          {p}
        </span>
      ))}
    </span>
  )
}

/** Celda vacía: se aclara en vez de dejarla en blanco. */
const SinDato = () => <span className="text-xs text-slate-400">Sin dato</span>

const CLAVE_AVISO = 'cobrosync-aviso-plazos'

/** Las solapas de Mis facturas, en el orden en que se ven. El color es el de cada estado. */
type Lista = 'rechazos' | 'vencer' | 'subir' | 'revision' | 'todas'

const LISTAS: { clave: Lista; titulo: string; punto: string; vacio: string }[] = [
  { clave: 'vencer', titulo: 'Vencidas o por vencer', punto: 'bg-sem-rojo', vacio: 'Nada vencido ni por vencer.' },
  { clave: 'subir', titulo: 'En plazo', punto: 'bg-sem-amarillo', vacio: 'Nada pendiente en plazo.' },
  { clave: 'rechazos', titulo: 'Rechazos y pedidos', punto: 'bg-orange-500', vacio: 'Sin rechazos ni pedidos.' },
  { clave: 'revision', titulo: 'En revisión', punto: 'bg-sky-400', vacio: 'Sin facturas en revisión.' },
  { clave: 'todas', titulo: 'Todas', punto: 'bg-slate-400', vacio: 'Sin facturas.' },
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
  const [abierta, setAbierta] = useState<Lista>('vencer')
  const [soltados, setSoltados] = useState<File[]>([])
  const [arrastrando, setArrastrando] = useState(false)
  const [modalNc, setModalNc] = useState(false)
  const [cargaMasiva, setCargaMasiva] = useState(false)
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

  // Un PDF soltado en cualquier lugar de Mis facturas abre "Subir varios PDF" con ese archivo
  useEffect(() => {
    if (cargaMasiva || modalNc) return
    const encima = (e: globalThis.DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setArrastrando(true)
    }
    const sale = (e: globalThis.DragEvent) => {
      if (!e.relatedTarget) setArrastrando(false)
    }
    const suelta = (e: globalThis.DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return
      e.preventDefault()
      setArrastrando(false)
      const archivos = archivosSoltados(e.dataTransfer)
      if (!archivos.length) return
      setSoltados(archivos)
      setCargaMasiva(true)
    }
    window.addEventListener('dragover', encima)
    window.addEventListener('dragleave', sale)
    window.addEventListener('drop', suelta)
    return () => {
      window.removeEventListener('dragover', encima)
      window.removeEventListener('dragleave', sale)
      window.removeEventListener('drop', suelta)
    }
  }, [cargaMasiva, modalNc])

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

  const todas = useMemo(() => comprobantes.filter((c) => c.tipo === 'FC').map((c) => ({ c, s: calcularSemaforo(c, hoy) })), [comprobantes, hoy])

  const listaDe = (l: Lista) => {
    if (l === 'todas') return todas
    if (l === 'rechazos') {
      const rechazos = urgentes.filter((u) => u.p.tema === 'rechazo').map((u) => u.x)
      const ya = new Set(rechazos.map((x) => x.c.id))
      const conPedido = [...pedidoDe.values()].filter((p) => !ya.has(p.c.id)).map((p) => ({ c: p.c, s: calcularSemaforo(p.c, hoy) }))
      return [...rechazos, ...conPedido]
    }
    if (l === 'vencer') return urgentes.filter((u) => u.p.tema === 'documentacion').map((u) => u.x)
    if (l === 'subir') {
      // En plazo: les falta documentación y no están en "Vencidas o por vencer" (ninguna factura en dos solapas)
      const urgentesIds = new Set(urgentes.filter((u) => u.p.tema === 'documentacion').map((u) => u.x.c.id))
      return filas.filter((x) => ETAPAS.subir.includes(x.s.etapa) && !urgentesIds.has(x.c.id))
    }
    return filas.filter((x) => ETAPAS[l].includes(x.s.etapa))
  }

  type Fila = (typeof filas)[number]
  const columnas: Columna<Fila>[] = [
    {
      clave: 'dias',
      titulo: 'Plazo',
      // días que quedan para subir la documentación (negativo: vencida)
      orden: (x) => plazoSucursal(x.c) - diasDeEspera(x.c, hoy),
      celda: (x) => {
        if (x.s.etapa === 'en_revision') return <span className="text-xs text-slate-500">Enviada</span>
        const quedan = plazoSucursal(x.c) - diasDeEspera(x.c, hoy)
        if (quedan < 0) return <span className="whitespace-nowrap text-sm font-bold text-sem-rojo">Vencida hace {-quedan} {-quedan === 1 ? 'día' : 'días'}</span>
        if (quedan === 0) return <span className="whitespace-nowrap text-sm font-bold text-sem-rojo">Vence hoy</span>
        return <span className={`whitespace-nowrap text-sm ${quedan <= 2 ? 'font-bold text-sem-rojo' : 'text-slate-700'}`}>Quedan {quedan} {quedan === 1 ? 'día' : 'días'}</span>
      },
    },
    { clave: 'ref', titulo: 'Ref.', orden: (x) => x.c.ref, celda: (x) => <span className="whitespace-nowrap">{x.c.ref || <SinDato />}</span> },
    {
      clave: 'factura',
      titulo: 'Factura',
      movil: 'titulo',
      orden: (x) => x.c.fecha,
      // el tipo (MiPyME o común) se filtra desde el título de Factura
      filtro: (x) => (esMipyme(x.c) ? 'MiPyME' : 'Común'),
      celda: (x) => (
        <div className="whitespace-nowrap">
          <div className="flex items-center gap-1.5 font-medium">
            {formatoComprobante(x.c)}
            {esMipyme(x.c) && <EtiquetaMipyme texto={`MiPyME · ${plazoSucursal(x.c)} d`} chica />}
          </div>
          <div className="text-xs text-slate-500">{formatoFecha(x.c.fecha)}</div>
        </div>
      ),
    },
    { clave: 'patente', titulo: 'Patente', orden: (x) => x.c.patente, celda: (x) => <span className="whitespace-nowrap">{x.c.patente || <SinDato />}</span> },
    {
      clave: 'siniestro',
      titulo: 'Siniestro',
      celda: (x) => {
        const n = porSiniestro.get(claveSiniestro(x.c)) ?? 0
        return (
          <span className="whitespace-nowrap">
            {x.c.siniestro || <SinDato />}
            {n > 1 && <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600" title="Facturas del mismo siniestro (facturación parcial)">{n} facturas</span>}
          </span>
        )
      },
    },
    { clave: 'total', titulo: 'Total', derecha: true, orden: (x) => x.c.total, celda: (x) => <span className="whitespace-nowrap">{formatoPesos(x.c.total)}</span> },
    {
      clave: 'que',
      titulo: 'Documentación',
      movil: 'ancha',
      // se lleva el espacio que sobra, así las demás columnas quedan juntas y el botón a la derecha
      clase: 'w-full',
      celda: (x) => (
        <div className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
          {x.c.tipo === 'NC' && <span className="text-slate-600">Nota de crédito: falta responder el pedido</span>}
          {x.c.tipo === 'FC' && <QueFalta c={x.c} />}
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
        !pedidoDe.has(x.c.id) && !['doc_pendiente', 'doc_atrasada', 'doc_observada'].includes(x.s.etapa) ? (
          x.s.etapa === 'en_revision' ? <Chip tono="celeste">En revisión</Chip> : null
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
            {p && <span className="text-xs font-semibold text-orange-700">{p.motivo}</span>}
            {pedido && (
              <span className="text-xs font-semibold text-orange-700">
                {NOMBRE_PEDIDO[pedido.pedido.tipo]}: {pedido.pedido.detalle}
              </span>
            )}
          </span>
        )
      },
    },
    ...columnas,
  ]
  const columnasTodas: Columna<Fila>[] = [
    ...columnas.filter((c) => c.clave !== 'que' && c.clave !== 'dias'),
    {
      clave: 'estado',
      titulo: 'Estado',
      movil: 'accion',
      filtro: (x) => nombreEtapa(x.s.etapa),
      orden: (x) => nombreEtapa(x.s.etapa),
      celda: (x) => <BadgeEtapa etapa={x.s.etapa} />,
    },
    ...columnas.filter((c) => c.clave === 'que'),
  ]

  const p = plazosActuales()
  const actual = LISTAS.find((l) => l.clave === abierta)!
  const conPrioridad = abierta === 'rechazos' || abierta === 'vencer'
  const cantidades = Object.fromEntries(LISTAS.map((l) => [l.clave, listaDe(l.clave).length])) as Record<Lista, number>

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

      {/* Las dos acciones de la sucursal, del mismo tamaño */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            setSoltados([])
            setCargaMasiva(true)
          }}
          className={`flex items-center gap-4 rounded-xl border-2 border-dashed px-5 py-4 text-left transition ${
            arrastrando ? 'border-marca bg-marca/10' : 'border-marca/50 bg-white hover:border-marca hover:bg-marca/5'
          }`}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-marca text-white">
            <FileUp className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-bold text-marca">Subir varios PDF de una vez</span>
            <span className="block text-xs text-slate-600">Soltalos acá, todos juntos</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setModalNc(true)}
          className="flex items-center gap-4 rounded-xl border-2 border-marca/30 bg-white px-5 py-4 text-left transition hover:border-marca hover:bg-marca/5"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-marca/10 text-marca">
            <Receipt className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-bold text-marca">Informar una nota de crédito</span>
            <span className="block text-xs text-slate-600">Para una factura que se anula, toda o una parte</span>
          </span>
        </button>
      </div>

      {/* PDF de facturas de hoy, hasta que Cobranzas cargue el ERP */}
      <div className="mb-3">
        <EnEsperaSucursal />
      </div>

      {/* Solapas: cada una cambia la lista de abajo */}
      <div className="mb-3 max-w-full overflow-x-auto">
        <div className="inline-flex gap-0.5 rounded-xl bg-slate-200/70 p-1" role="tablist" aria-label="Facturas">
          {LISTAS.map((l) => {
            const elegida = l.clave === abierta
            return (
              <button
                key={l.clave}
                type="button"
                role="tab"
                aria-selected={elegida}
                onClick={() => setAbierta(l.clave)}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                  elegida ? 'bg-white text-noche shadow-sm' : 'text-slate-500 hover:text-noche'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${l.punto}`} aria-hidden="true" />
                {l.titulo}
                <span className="tabular-nums text-slate-500">{cantidades[l.clave].toLocaleString('es-AR')}</span>
              </button>
            )
          })}
        </div>
      </div>

      {(abierta === 'vencer' || abierta === 'subir') && (
        <p className="mb-2 text-xs text-slate-500">
          Falta la factura o la orden firmada.{abierta === 'vencer' ? ' Primero las MiPyME, después lo más atrasado.' : ''}
        </p>
      )}
      {abierta === 'rechazos' && <p className="mb-2 text-xs text-slate-500">Primero las MiPyME, después lo más atrasado.</p>}
      <Tabla
        id={conPrioridad ? 'mis-facturas-prioridad' : abierta === 'todas' ? 'mis-facturas-todas' : 'mis-facturas-lista'}
        key={abierta}
        filas={listaDe(abierta)}
        columnas={abierta === 'rechazos' ? columnasResolver : abierta === 'todas' ? columnasTodas : columnas}
        clave={(x) => x.c.id}
        onFila={(x) => abrirLegajo(x.c.id)}
        buscar={(x) => [formatoComprobante(x.c), x.c.ref, x.c.siniestro, x.c.patente].join(' ')}
        textoBusqueda="Buscar por número, ref., siniestro o patente"
        ordenInicial={conPrioridad ? undefined : abierta === 'todas' ? { clave: 'factura', dir: 'desc' } : { clave: 'dias', dir: 'asc' }}
        porPagina={25}
        resumen={() => null}
        vacio={actual.vacio}
      />

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
      {cargaMasiva && <CargaMasiva iniciales={soltados} onCerrar={() => setCargaMasiva(false)} />}
    </>
  )
}
