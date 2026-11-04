import { useMemo, useState, type ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import { EncabezadoPagina } from '../components/ui/Card'
import { diffDias } from '../lib/fechas'
import { CircleCheck, FileUp, PencilLine, Receipt, Search, Upload } from 'lucide-react'
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
  observado: { marca: '!', texto: 'observado', clase: 'border-red-300 bg-red-50 text-red-800' },
  en_revision: { marca: '…', texto: 'en revisión', clase: 'border-sky-200 bg-sky-50 text-sky-800' },
  ok: { marca: '✓', texto: 'aprobado', clase: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
} as const

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
export default function MisFacturas({ vista = 'subir' }: { vista?: 'subir' | 'resolver' }) {
  const { sucursal, hoy, abrirLegajo, misNotificaciones, marcarLeida, marcarTodasLeidas } = useApp()
  const navigate = useNavigate()
  const comprobantes = useComprobantes()
  const porSiniestro = useMemo(() => contarPorSiniestro(comprobantes), [comprobantes])
  const [grupo, setGrupo] = useState<Grupo | 'todas'>('todas')
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
  const noLeidas = misNotificaciones.filter((n) => !n.leida).sort((a, b) => a.fecha.localeCompare(b.fecha))

  const cuenta = (g: Grupo) => filas.filter((x) => GRUPOS.find((gr) => gr.clave === g)!.etapas.includes(x.s.etapa)).length
  const etapasDeLaVista = gruposDeLaVista.flatMap((g) => g.etapas)
  const visibles =
    grupo === 'todas' ? filas.filter((x) => etapasDeLaVista.includes(x.s.etapa)) : filas.filter((x) => GRUPOS.find((g) => g.clave === grupo)!.etapas.includes(x.s.etapa))
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
      clave: 'dias',
      titulo: 'Días',
      orden: (x) => diasDeEspera(x.c, hoy),
      celda: (x) => {
        const d = diasDeEspera(x.c, hoy)
        return (
          <div>
            <span className={`text-lg font-extrabold ${d > plazoSucursal(x.c) && x.s.etapa !== 'en_revision' ? 'text-sem-rojo' : ''}`}>{d}</span>
            {esMipyme(x.c) && (
              <div className="whitespace-nowrap text-[11px] font-semibold text-marca" title={`Factura MiPyME: plazo de ${plazoSucursal(x.c)} días`}>
                MiPyME · {plazoSucursal(x.c)} d
              </div>
            )}
          </div>
        )
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
                {e.marca} {NOMBRE_DOC[tipo]}
              </span>
            )
          })}
          {x.c.compromiso && (
            <span className="w-full text-[11px] text-slate-500">Avisaste que lo subís el {formatoFecha(x.c.compromiso.fecha)}</span>
          )}
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

  if (vista === 'resolver') {
    const columnasResolver: Columna<Fila>[] = [
      {
        clave: 'motivo',
        titulo: 'Por qué',
        orden: (x) => motivo.get(x.c.id)?.orden ?? 0,
        celda: (x) => {
          const p = motivo.get(x.c.id)
          return p ? <span className={`text-xs font-semibold ${p.orden >= 2 ? 'text-sem-rojo' : 'text-amber-800'}`}>{p.motivo}</span> : null
        },
      },
      ...columnas,
    ]
    return (
      <>
        <EncabezadoPagina
          titulo={`Para resolver · ${sucursal}`}
          subtitulo="Lo que necesita tu atención: documentos observados, facturas fuera de plazo o por vencer, y los mensajes de Auditoría"
        />

        {/* Mensajes sin leer: para que no quede nada colgado aunque no se abra la campana */}
        {noLeidas.length > 0 && (
          <div className="mb-4 rounded-xl border border-marca/30 bg-white p-4 shadow-sm">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-bold">
                {noLeidas.length} {noLeidas.length === 1 ? 'mensaje sin leer' : 'mensajes sin leer'}
              </h2>
              <button type="button" onClick={marcarTodasLeidas} className="text-xs font-semibold text-marca hover:underline">
                Marcar todos como leídos
              </button>
            </div>
            <ul className="divide-y divide-slate-100 text-sm">
              {noLeidas.slice(0, 8).map((n) => {
                const dias = diffDias(n.fecha, hoy)
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        marcarLeida(n.id)
                        if (n.ruta) navigate(n.ruta)
                        else abrirLegajo(n.comprobanteId)
                      }}
                      className="flex w-full items-start justify-between gap-3 py-2 text-left hover:bg-fondo"
                    >
                      <span>{n.texto}</span>
                      <span className={`shrink-0 text-xs ${dias >= 2 ? 'font-semibold text-sem-rojo' : 'text-slate-500'}`}>
                        {dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            {noLeidas.length > 8 && <p className="mt-1 text-xs text-slate-500">Y {noLeidas.length - 8} más en Notificaciones.</p>}
          </div>
        )}

        <Tabla
          id="para-resolver"
          filas={urgentes.map((u) => u.x)}
          columnas={columnasResolver}
          clave={(x) => x.c.id}
          onFila={(x) => abrirLegajo(x.c.id)}
          ordenInicial={{ clave: 'motivo', dir: 'desc' }}
          resumen={(l) => `${l.length} ${l.length === 1 ? 'factura' : 'facturas'} para resolver (las MiPyME primero)`}
          vacio="No tenés nada para resolver. ¡Todo al día!"
        />
      </>
    )
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Mis facturas · {sucursal}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Para subir la documentación de cada factura e informar notas de crédito.
            {(urgentes.length > 0 || sinLeer > 0) && (
              <button type="button" onClick={() => navigate('/app/resolver')} className="ml-1 font-semibold text-marca hover:underline">
                Tenés {urgentes.length > 0 ? `${urgentes.length} para resolver` : ''}
                {urgentes.length > 0 && sinLeer > 0 ? ' y ' : ''}
                {sinLeer > 0 ? `${sinLeer} ${sinLeer === 1 ? 'mensaje' : 'mensajes'} sin leer` : ''} →
              </button>
            )}
          </p>
        </div>
      </div>

      {/* Las dos acciones de todos los días, grandes y a la vista */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setCargaMasiva(true)}
          className="flex items-center gap-4 rounded-xl border-2 border-marca/30 bg-white p-4 text-left shadow-sm transition hover:border-marca hover:bg-marca/5"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-marca/10">
            <FileUp className="h-6 w-6 text-marca" />
          </span>
          <span>
            <span className="block text-base font-bold">Subir varios archivos de una vez</span>
            <span className="block text-xs text-slate-600">
              Soltá todos los escaneos juntos: se asignan solos a cada factura por el número, el siniestro o la patente.
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setModalNc(true)}
          className="flex items-center gap-4 rounded-xl border-2 border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-marca hover:bg-marca/5"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sem-rojo/10">
            <Receipt className="h-6 w-6 text-sem-rojo" />
          </span>
          <span>
            <span className="block text-base font-bold">Informar una nota de crédito</span>
            <span className="block text-xs text-slate-600">Si una factura se anula, toda o una parte, avisalo acá para que Auditoría no la presente.</span>
          </span>
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

      {/* Dos grupos grandes: para subir y en revisión */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {gruposDeLaVista.map((g) => {
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
        Tenés {plazosActuales().comun} días desde la factura ({plazosActuales().mipyme} si es <strong>MiPyME</strong>, priorizalas) para subir la factura y la orden de reparación o repuestos firmada por el cliente. Si no
        podés, entrá a la factura y tocá "No lo puedo subir todavía".
        <span className="mt-1 block">
          En cada factura: <strong>+</strong> falta subirlo · <strong>!</strong> observado, hay que reemplazarlo · <strong>…</strong> en
          revisión · <strong>✓</strong> aprobado.
        </span>
      </p>

      <Tabla
        id="mis-facturas"
        filas={visibles}
        columnas={columnas}
        clave={(x) => x.c.id}
        onFila={(x) => abrirLegajo(x.c.id)}
        ordenInicial={{ clave: 'dias', dir: 'desc' }}
        resumen={(l) => `${l.length} facturas ${grupo === 'todas' ? 'para subir o en revisión' : `· ${GRUPOS.find((g) => g.clave === grupo)!.titulo.toLowerCase()}`}`}
        vacio="No tenés nada pendiente. ¡Todo al día!"
      />

      {modalNc && <NotaCreditoModal onCerrar={() => setModalNc(false)} />}
      {cargaMasiva && <CargaMasiva onCerrar={() => setCargaMasiva(false)} />}
    </>
  )
}
