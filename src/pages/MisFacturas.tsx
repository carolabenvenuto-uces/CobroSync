import { useMemo, useState, type ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import { EncabezadoPagina } from '../components/ui/Card'
import { ChevronDown, ChevronRight, CircleCheck, FileUp, Info, PencilLine, Receipt, Search, Upload, X } from 'lucide-react'
import { NotaCreditoModal } from '../components/NotaCreditoModal'
import { CargaMasiva } from '../components/CargaMasiva'
import { Chip } from '../components/ui/Badges'
import { Tabla, type Columna } from '../components/ui/Tabla'
import { useApp, useComprobantes } from '../context/AppContext'
import { calcularSemaforo } from '../domain/semaforo'
import { esMipyme, plazosActuales, plazoSucursal } from '../domain/plazos'
import { diasDeEspera } from '../domain/sucursales'
import { claveSiniestro, contarPorSiniestro } from '../domain/siniestros'
import { paraResolver } from '../domain/resolver'
import type { Etapa } from '../domain/tipos'
import { formatoComprobante, formatoFecha, formatoPesos } from '../lib/formato'

/** Las tres etiquetas de "Qué hay que hacer": qué documento falta, cuál se observó y cuál ya está. */
const NOMBRE_DOC = { factura: 'Factura', orden: 'Orden firmada' } as const
const ESTADO_DOC = {
  faltante: { marca: '+', texto: 'falta subirlo', clase: 'border-amber-300 bg-amber-50 text-amber-900' },
  observado: { marca: '!', texto: 'observada', clase: 'border-red-300 bg-red-50 text-red-800' },
  en_revision: { marca: '…', texto: 'en revisión', clase: 'border-sky-200 bg-sky-50 text-sky-800' },
  ok: { marca: '✓', texto: 'aprobada', clase: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
} as const

const CLAVE_AVISO = 'cobrosync-aviso-plazos'

type Grupo = 'subir' | 'corregir' | 'revision'

const GRUPOS: { clave: Grupo; titulo: string; ayuda: string; etapas: Etapa[]; icono: ComponentType<{ className?: string }>; color: string }[] = [
  {
    clave: 'subir',
    titulo: 'Para subir',
    ayuda: 'Falta la factura o la orden firmada',
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
    ayuda: 'Ya subió todo: Auditoría lo está revisando. No tiene que hacer nada',
    etapas: ['en_revision'],
    icono: CircleCheck,
    color: 'border-sky-400 bg-sky-50',
  },
]

/**
 * Inicio de la sucursal: qué tiene que hacer hoy, en tres grupos, con un buscador grande.
 * Cada factura tiene un botón "Subir documentación" que abre su legajo.
 */
export default function MisFacturas({ vista = 'subir' }: { vista?: 'subir' | 'resolver' }) {
  const { sucursal, hoy, abrirLegajo, misNotificaciones } = useApp()
  const navigate = useNavigate()
  const comprobantes = useComprobantes()
  const porSiniestro = useMemo(() => contarPorSiniestro(comprobantes), [comprobantes])
  // Mis facturas: la lista aparece recién al tocar una tarjeta (para subir o en revisión)
  const [grupo, setGrupo] = useState<Grupo | null>(null)
  // El aviso de plazos se muestra grande la primera vez; después queda en el botón "Plazos"
  const [avisoPlazos, setAvisoPlazos] = useState(() => {
    try {
      return localStorage.getItem(CLAVE_AVISO) !== 'visto'
    } catch {
      return false
    }
  })
  const cerrarAviso = () => {
    setAvisoPlazos(false)
    try {
      localStorage.setItem(CLAVE_AVISO, 'visto')
    } catch {
      /* se vuelve a mostrar la próxima vez, nada grave */
    }
  }
  // Para resolver: un tema a la vez y, si se quiere, solo las MiPyME
  const [tema, setTema] = useState<'rechazo' | 'documentacion' | null>(null)
  const [soloMipyme, setSoloMipyme] = useState(false)
  const [modalNc, setModalNc] = useState(false)
  const [cargaMasiva, setCargaMasiva] = useState(false)
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
  // Para resolver: observadas, fuera de plazo o por vencer (ver domain/resolver.ts)
  const urgentes = useMemo(() => {
    const porId = new Map(filas.map((x) => [x.c.id, x]))
    return paraResolver(comprobantes, hoy)
      .map((p) => ({ x: porId.get(p.c.id)!, p }))
      .filter((u) => u.x)
  }, [comprobantes, filas, hoy])

  // "Mis facturas" es para subir: lo observado y lo atrasado está en "Para resolver"
  const gruposDeLaVista = GRUPOS.filter((g) => g.clave !== 'corregir')

  const cuenta = (g: Grupo) => filas.filter((x) => GRUPOS.find((gr) => gr.clave === g)!.etapas.includes(x.s.etapa)).length
  const etapasDeLaVista = gruposDeLaVista.flatMap((g) => g.etapas)
  const visibles = grupo
    ? filas.filter((x) => GRUPOS.find((g) => g.clave === grupo)!.etapas.includes(x.s.etapa))
    : filas.filter((x) => etapasDeLaVista.includes(x.s.etapa))
  const motivo = new Map(urgentes.map((u) => [u.x.c.id, u.p]))

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
              <div className="mt-0.5 inline-block whitespace-nowrap rounded bg-noche px-1.5 py-0.5 text-[11px] font-bold text-white" title={`Factura MiPyME: plazo de ${plazoSucursal(x.c)} días`}>
                ! MiPyME · {plazoSucursal(x.c)} d
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
          {(['factura', 'orden'] as const).map((tipo) => {
            const d = x.c.documentos.find((doc) => doc.tipo === tipo)
            const estado = d?.estado ?? 'faltante'
            const e = ESTADO_DOC[estado]
            return (
              <span
                key={tipo}
                title={estado === 'observado' && d?.motivo ? `${NOMBRE_DOC[tipo]}: ${d.motivo}` : `${NOMBRE_DOC[tipo]}: ${e.texto}`}
                className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold ${e.clase}`}
              >
                {/* Se lee sola, sin leyenda: "Falta la orden firmada", "Factura aprobada" */}
                {estado === 'faltante' ? `+ Falta ${tipo === 'factura' ? 'la factura' : 'la orden firmada'}` : `${e.marca} ${NOMBRE_DOC[tipo]} ${e.texto}`}
              </span>
            )
          })}
          {x.c.compromiso && (
            x.c.compromiso.fecha >= hoy ? (
              <span className="w-full text-[11px] text-slate-500">Fecha estimada que avisó: {formatoFecha(x.c.compromiso.fecha)}</span>
            ) : (
              <span className="w-full text-[11px] font-semibold text-sem-rojo">La fecha estimada que avisó ({formatoFecha(x.c.compromiso.fecha)}) ya pasó</span>
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
        x.s.etapa === 'en_revision' ? (
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

  if (vista === 'resolver') {
    const columnasResolver: Columna<Fila>[] = [
      {
        clave: 'prioridad',
        titulo: 'Prioridad',
        filtro: (x) => (esMipyme(x.c) ? 'MiPyME' : 'Común'),
        orden: (x) => (esMipyme(x.c) ? 1 : 0),
        celda: (x) =>
          esMipyme(x.c) ? (
            <span className="whitespace-nowrap rounded-md bg-noche px-2 py-1 text-xs font-bold text-white">! MiPyME · {plazoSucursal(x.c)} días</span>
          ) : (
            <span className="text-xs text-slate-500">Común</span>
          ),
      },
      {
        clave: 'motivo',
        movil: 'ancha',
        titulo: 'Por qué',
        orden: (x) => motivo.get(x.c.id)?.orden ?? 0,
        celda: (x) => {
          const p = motivo.get(x.c.id)
          return p ? <span className={`text-xs font-semibold ${p.orden >= 2 ? 'text-sem-rojo' : 'text-amber-800'}`}>{p.motivo}</span> : null
        },
      },
      ...columnas,
    ]
    const delTema = (t: 'rechazo' | 'documentacion') => urgentes.filter((u) => u.p.tema === t)
    const temaActivo = tema
    const listaTema = (temaActivo ? delTema(temaActivo) : []).filter((u) => !soloMipyme || u.p.mipyme)
    const TEMAS = [
      {
        clave: 'rechazo' as const,
        titulo: 'Rechazos y observaciones',
        ayuda: 'Un documento que Auditoría o la compañía no aceptó: hay que reemplazarlo',
        icono: PencilLine,
        color: 'border-sem-rojo bg-sem-rojo/5',
      },
      {
        clave: 'documentacion' as const,
        titulo: 'Documentación por vencer o vencida',
        ayuda: 'Facturas que pasaron el plazo o a las que les quedan 2 días o menos',
        icono: Upload,
        color: 'border-sem-amarillo bg-sem-amarillo/10',
      },
    ]
    return (
      <>
        <EncabezadoPagina
          titulo={`Para resolver · ${sucursal}`}
          subtitulo="Lo que necesita su atención: documentos rechazados u observados y facturas fuera de plazo o por vencer"
        />


        {/* Dos temas por separado, para no tener una sola lista larga */}
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {TEMAS.map((t) => {
            const Icono = t.icono
            const lista = delTema(t.clave)
            const mipymes = lista.filter((u) => u.p.mipyme).length
            return (
              <button
                key={t.clave}
                type="button"
                onClick={() => setTema(temaActivo === t.clave ? null : t.clave)}
                aria-expanded={temaActivo === t.clave}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${t.color} ${temaActivo === t.clave ? 'ring-2 ring-marca' : ''}`}
              >
                <Icono className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-2xl font-extrabold">{lista.length}</span>
                    <span className="font-bold">{t.titulo}</span>
                    {mipymes > 0 && <span className="rounded bg-noche px-1.5 py-0.5 text-[11px] font-bold text-white">! {mipymes} MiPyME</span>}
                  </div>
                  <p className="text-xs text-slate-600">{t.ayuda}</p>
                </div>
                {temaActivo === t.clave ? <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-slate-500" /> : <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-500" />}
              </button>
            )
          })}
        </div>

        {!temaActivo ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            Toque una de las dos tarjetas para ver las facturas (y otra vez para cerrarla).
          </p>
        ) : (
        <>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-slate-600">Ordenadas por prioridad: primero las MiPyME, después lo más atrasado.</span>
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" checked={soloMipyme} onChange={(e) => setSoloMipyme(e.target.checked)} />
            Ver solo las MiPyME
          </label>
        </div>

        <Tabla
          id="para-resolver"
          key={`${temaActivo}-${soloMipyme}`}
          filas={listaTema.map((u) => u.x)}
          columnas={columnasResolver}
          clave={(x) => x.c.id}
          onFila={(x) => abrirLegajo(x.c.id)}
          porPagina={15}
          resumen={(l) => `${l.length} ${l.length === 1 ? 'factura' : 'facturas'} · ${TEMAS.find((t) => t.clave === temaActivo)!.titulo.toLowerCase()}`}
          vacio={temaActivo === 'rechazo' ? 'No tiene rechazos ni observaciones. ¡Bien!' : 'No tiene documentación por vencer ni vencida. ¡Bien!'}
        />
        </>
        )}
      </>
    )
  }

  const p = plazosActuales()
  const tarjeta = (g: (typeof GRUPOS)[number]) => {
    const Icono = g.icono
    const activo = grupo === g.clave
    return (
      <button
        type="button"
        onClick={() => setGrupo(activo ? null : g.clave)}
        aria-expanded={activo}
        className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${g.color} ${activo ? 'ring-2 ring-marca' : ''}`}
      >
        <Icono className="h-5 w-5 shrink-0" />
        <span className="text-2xl font-extrabold">{cuenta(g.clave)}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">{g.titulo}</span>
          <span className="block text-xs text-slate-600">{g.ayuda}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-600">
          {activo ? 'Cerrar' : 'Ver'}
          {activo ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>
    )
  }
  const subir = GRUPOS.find((g) => g.clave === 'subir')!
  const enRevision = cuenta('revision')

  return (
    <>
      {/* Encabezado: título, accesos y las dos acciones, en botones finos */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight">Mis facturas · {sucursal}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {urgentes.length > 0 && (
              <button type="button" onClick={() => navigate('/app/resolver')} className="mr-3 font-semibold text-marca hover:underline">
                Tiene {urgentes.length} para resolver →
              </button>
            )}
            {sinLeer > 0 && (
              <button type="button" onClick={() => navigate('/app/notificaciones')} className="font-semibold text-marca hover:underline">
                {sinLeer} {sinLeer === 1 ? 'mensaje sin leer' : 'mensajes sin leer'} →
              </button>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAvisoPlazos(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-sem-amarillo/60 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
          title="Volver a leer los plazos"
        >
          <Info className="h-3.5 w-3.5" /> Plazos
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCargaMasiva(true)}
          title="Suelte todos los PDF juntos: cada uno va a su factura por el número del nombre (35-11032 orden.pdf)"
          className="inline-flex items-center gap-2 rounded-lg bg-marca px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-marca-oscuro"
        >
          <FileUp className="h-4 w-4" /> Subir varios PDF de una vez
        </button>
        <button
          type="button"
          onClick={() => setModalNc(true)}
          title="Si una factura se anula, toda o una parte"
          className="inline-flex items-center gap-2 rounded-lg border border-marca/40 bg-white px-4 py-2 text-sm font-semibold text-marca shadow-sm hover:bg-marca/5"
        >
          <Receipt className="h-4 w-4" /> Informar una nota de crédito
        </button>
      </div>

      {/* Lo que hay que hacer: una sola tarjeta; lo que está en revisión, en una línea */}
      <div className="mb-2">{tarjeta(subir)}</div>
      {enRevision > 0 && (
        <p className="mb-4 px-1 text-xs text-slate-600">
          Además, <strong>{enRevision}</strong> {enRevision === 1 ? 'factura está' : 'facturas están'} en revisión: Auditoría las está revisando, no
          tiene que hacer nada.{' '}
          <button type="button" onClick={() => setGrupo(grupo === 'revision' ? null : 'revision')} className="font-semibold text-marca hover:underline">
            {grupo === 'revision' ? 'Ocultarlas' : 'Verlas'}
          </button>
        </p>
      )}

      {/* El buscador va pegado a la lista: lo que encuentra aparece justo abajo */}
      <div className="relative mb-3 mt-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Busque cualquier factura por número, siniestro o patente"
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/20"
        />
      </div>
      {busqueda.trim().length >= 3 && (
        <ul className="mb-4 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {encontradas.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">No hay facturas con ese número, siniestro o patente.</li>}
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

      {grupo && (
        <Tabla
          id="mis-facturas"
          key={grupo}
          filas={visibles}
          columnas={columnas}
          clave={(x) => x.c.id}
          onFila={(x) => abrirLegajo(x.c.id)}
          ordenInicial={{ clave: 'dias', dir: 'desc' }}
          resumen={(l) => `${l.length} facturas · ${GRUPOS.find((g) => g.clave === grupo)!.titulo.toLowerCase()}`}
          vacio={grupo === 'subir' ? 'No le falta subir nada. ¡Todo al día!' : 'No tiene nada en revisión.'}
        />
      )}

      {/* Aviso de plazos: grande la primera vez, después desde el botón "Plazos" */}
      {avisoPlazos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-noche/50 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-plazos">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <span className="rounded-md bg-sem-amarillo px-2 py-1 text-xs font-extrabold uppercase tracking-wide text-noche">Importante</span>
              <button type="button" onClick={cerrarAviso} aria-label="Cerrar" className="rounded-lg p-1 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <h2 id="titulo-plazos" className="text-lg font-extrabold">Los plazos para subir la documentación</h2>
            <p className="mt-3 text-sm text-slate-700">
              Tiene <strong>{p.comun} días</strong> desde la fecha de la factura para subir la <strong>factura</strong> y la <strong>orden firmada</strong>.
            </p>
            <p className="mt-2 text-sm text-slate-700">
              Si es <strong className="rounded bg-noche px-1 text-white">! MiPyME</strong>, solo <strong>{p.mipyme} días</strong>: súbalas primero.
            </p>
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
              ¿No llega? Ingrese a la factura y toque <strong>"Avisar fecha estimada de entrega"</strong>: elige el motivo y el día en que va a tener la
              documentación. Auditoría sabe cuándo esperarla y la factura no le aparece en Para resolver hasta ese día.
            </p>
            <button type="button" onClick={cerrarAviso} className="mt-5 w-full rounded-lg bg-marca px-4 py-2.5 text-sm font-semibold text-white hover:bg-marca-oscuro">
              Entendido
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-500">Lo puede volver a leer cuando quiera con el botón "Plazos", arriba a la derecha.</p>
          </div>
        </div>
      )}

      {modalNc && <NotaCreditoModal onCerrar={() => setModalNc(false)} />}
      {cargaMasiva && <CargaMasiva onCerrar={() => setCargaMasiva(false)} />}
    </>
  )
}
