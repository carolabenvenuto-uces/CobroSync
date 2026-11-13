import { useMemo, useRef, useState } from 'react'
import { ExternalLink, Info, Mail, MonitorUp, Pause, Play, Plus, Upload, X } from 'lucide-react'
import { EncabezadoPagina } from '../components/ui/Card'
import { Tabla, type Columna } from '../components/ui/Tabla'
import { useApp } from '../context/AppContext'
import { nombreCanal, prefijos } from '../domain/canal'
import type { Aseguradora } from '../domain/tipos'
import { descargarExcel } from '../lib/exportar'
import { completarEnlace, separarLista, unirLista } from '../lib/listas'
import { importarCompanias } from '../services/companias'
import { guardarAseguradorasEnGoogle } from '../services/google'
import { leerArchivo } from '../services/planilla'

/** "30500037217" → "30-50003721-7" */
export function formatoCuit(cuit: string | undefined): string {
  const d = (cuit ?? '').replace(/\D/g, '')
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : d
}

/**
 * Datos de cada compañía, como las pestañas "CP" e "Info. Compañías" de la planilla:
 * razón social, CUIT, plazo de pago y a qué correos se presenta y se reclama.
 */
export default function Companias() {
  const { datos, fuente, hoy, actualizarAseguradoras } = useApp()
  const { aseguradoras, comprobantes } = datos!
  const entrada = useRef<HTMLInputElement>(null)
  const [mensaje, setMensaje] = useState<{ texto: string; error?: boolean } | null>(null)

  // Facturas del año en curso: el período se aclara en el título de la columna y en la ficha
  const anio = hoy.slice(0, 4)
  const facturas = useMemo(() => {
    const r: Record<string, number> = {}
    for (const c of comprobantes) if (c.tipo === 'FC' && c.fecha.startsWith(anio)) r[c.aseguradoraId] = (r[c.aseguradoraId] ?? 0) + 1
    return r
  }, [comprobantes, anio])

  async function cargar(archivo: File | undefined) {
    if (!archivo) return
    try {
      const r = importarCompanias(await leerArchivo(archivo, /^cp$|compa/i), aseguradoras)
      actualizarAseguradoras(r.aseguradoras)
      // Con Google, los datos quedan guardados para todos
      if (fuente.tipo === 'google') await guardarAseguradorasEnGoogle(r.aseguradoras, true)
      setMensaje({ texto: `Se completaron ${r.actualizadas} compañías. ${r.sinCoincidencia ? `${r.sinCoincidencia} filas no coincidieron con ninguna compañía de las facturas.` : ''}` })
    } catch (e) {
      setMensaje({ texto: e instanceof Error ? e.message : 'No se pudo leer el archivo.', error: true })
    }
    if (entrada.current) entrada.current.value = ''
  }

  // Canal de presentación y tolerancia para reclamar: se cambian acá mismo y se guardan para todo el sector
  async function cambiar(a: Aseguradora, cambios: Partial<Aseguradora>) {
    const lista = aseguradoras.map((x) => (x.id === a.id ? { ...x, ...cambios } : x))
    actualizarAseguradoras(lista)
    try {
      if (fuente.tipo === 'google') await guardarAseguradorasEnGoogle([{ id: a.id, ...cambios } as Aseguradora], true, true)
    } catch (e) {
      setMensaje({ texto: e instanceof Error ? e.message : 'No se pudo guardar el cambio.', error: true })
    }
  }

  // Lo que hace falta para presentar y reclamar sin buscar el dato a mano
  const faltan = (a: Aseguradora) =>
    [
      !a.cuit && 'CUIT',
      (a.canal === 'portal' || a.canal === 'ambas') && !a.portalUrl && 'enlace a la plataforma',
      a.canal !== 'portal' && !a.email && 'mail',
      !(a.emailReclamos || a.email) && 'mail de reclamos',
    ].filter((x): x is string => !!x)

  const correo = (texto: string | undefined) =>
    texto ? (
      <span className="block max-w-72 truncate text-xs text-slate-700" title={texto}>
        {texto}
      </span>
    ) : (
      <span className="text-xs text-slate-400">—</span>
    )

  const [abierta, setAbierta] = useState<string | null>(null)
  const ficha = aseguradoras.find((a) => a.id === abierta) ?? null
  const [verPausadas, setVerPausadas] = useState(false)
  const [nueva, setNueva] = useState(false)
  const pausadas = aseguradoras.filter((a) => a.pausada).length
  const visibles = aseguradoras.filter((a) => !!a.pausada === verPausadas)

  // Alta de una compañía: con el nombre alcanza; el resto se completa en su ficha
  async function darDeAlta(datosNuevos: Pick<Aseguradora, 'nombre' | 'razonSocial' | 'cuit' | 'plazoPagoDias'>) {
    const base = datosNuevos.nombre
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    let id = base || 'compania'
    for (let n = 2; aseguradoras.some((a) => a.id === id); n++) id = `${base}-${n}`
    const a: Aseguradora = { id, email: '', canal: 'portal', ...datosNuevos }
    actualizarAseguradoras([...aseguradoras, a])
    setNueva(false)
    setVerPausadas(false)
    setAbierta(id)
    try {
      if (fuente.tipo === 'google') await guardarAseguradorasEnGoogle([a])
      setMensaje({ texto: `Se dio de alta ${a.nombre}. Falta completar cómo se presenta y los contactos.` })
    } catch (e) {
      setMensaje({ texto: e instanceof Error ? e.message : 'No se pudo dar de alta.', error: true })
    }
  }

  // En la tabla, lo que se mira de un vistazo; el resto (CUIT, correos, plataforma) en la ficha de cada una
  const columnas: Columna<Aseguradora>[] = [
    {
      clave: 'nombre', movil: 'titulo',
      titulo: 'Compañía',
      orden: (a) => a.nombre,
      filtro: (a) => a.nombre,
      celda: (a) => (
        <div>
          <div className="whitespace-nowrap font-semibold">{a.nombre}</div>
          {a.razonSocial && <div className="text-[11px] text-slate-500">{a.razonSocial}</div>}
        </div>
      ),
    },
    {
      clave: 'canal',
      titulo: 'Se presenta por',
      filtro: (a) => nombreCanal(a),
      celda: (a) =>
        a.canal === 'ambas' ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">
            <Mail className="h-3.5 w-3.5" />
            <MonitorUp className="h-3.5 w-3.5" /> Mail y plataforma
          </span>
        ) : a.canal === 'portal' ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-800">
            <MonitorUp className="h-3.5 w-3.5" /> Plataforma
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-800">
            <Mail className="h-3.5 w-3.5" /> Mail
          </span>
        ),
    },
    {
      clave: 'plazo',
      titulo: 'Plazo de pago',
      orden: (a) => a.plazoPagoDias,
      filtro: (a) => `${a.plazoPagoDias} días`,
      celda: (a) => <span className="whitespace-nowrap">{a.plazoPagoDias} días</span>,
    },
    {
      clave: 'tolerancia',
      titulo: 'Tolerancia para reclamar',
      orden: (a) => a.toleranciaReclamo ?? 0,
      celda: (a) => <span className={`whitespace-nowrap ${a.toleranciaReclamo ? '' : 'text-slate-400'}`}>{a.toleranciaReclamo ? `${a.toleranciaReclamo} días` : 'Sin tolerancia'}</span>,
    },
    {
      clave: 'datos', movil: 'no',
      titulo: 'Datos',
      filtro: (a) => (faltan(a).length ? 'Incompletos' : 'Completos'),
      celda: (a) =>
        faltan(a).length ? (
          <span className="text-xs font-semibold text-amber-700" title={`Falta: ${faltan(a).join(', ')}`}>
            Falta {faltan(a).join(', ')}
          </span>
        ) : (
          <span className="text-xs text-teal-700">Completos</span>
        ),
    },
    { clave: 'facturas', titulo: `Facturas ${anio}`, derecha: true, orden: (a) => facturas[a.id] ?? 0, celda: (a) => (facturas[a.id] ?? 0).toLocaleString('es-AR') },
    { clave: 'cuit', titulo: 'CUIT', oculta: true, celda: (a) => <span className="whitespace-nowrap tabular-nums">{formatoCuit(a.cuit) || '—'}</span> },
    { clave: 'email', titulo: 'Mail para presentar', oculta: true, celda: (a) => correo(a.email) },
    { clave: 'reclamos', titulo: 'Mail para reclamar', oculta: true, celda: (a) => correo(a.emailReclamos) },
  ]

  function exportar(lista: Aseguradora[]) {
    descargarExcel(
      'companias',
      ['Compañía', 'Razón social', 'CUIT', 'Plazo de pago (días)', 'Mail para presentar', 'Mail para reclamar'],
      lista.map((a) => [a.nombre, a.razonSocial ?? null, formatoCuit(a.cuit) || null, a.plazoPagoDias, a.email || null, a.emailReclamos ?? null]),
    )
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Compañías"
        subtitulo="Cómo se presenta y cuándo paga cada compañía. Tocar una para ver y cambiar sus datos."
        acciones={
          <>
            <input ref={entrada} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => cargar(e.target.files?.[0])} />
            <button
              type="button"
              onClick={() => setNueva(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-marca px-3 py-2 text-sm font-semibold text-white hover:bg-marca-oscuro"
            >
              <Plus className="h-4 w-4" /> Nueva compañía
            </button>
            <button
              type="button"
              onClick={() => entrada.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-noche hover:bg-fondo"
              title='El Excel de la planilla (se toma la pestaña CP) o un CSV de "CP" o "Info. Compañías"'
            >
              <Upload className="h-4 w-4" /> Cargar desde la planilla
            </button>
          </>
        }
      />

      {fuente.tipo !== 'google' && (
        <p className="mb-3 flex items-center gap-1.5 text-xs text-slate-500">
          <Info className="h-3.5 w-3.5" /> Lo que se cargue de la planilla se lee solo en este navegador y no se guarda.
        </p>
      )}

      {mensaje && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${mensaje.error ? 'border-sem-rojo/30 bg-sem-rojo/5 text-red-900' : 'border-esmeralda/30 bg-esmeralda/5 text-teal-900'}`}
        >
          {mensaje.texto}
        </div>
      )}

      {(pausadas > 0 || verPausadas) && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => setVerPausadas(false)}
            className={`rounded-full px-3 py-1 font-semibold ${!verPausadas ? 'bg-noche text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
          >
            Activas ({aseguradoras.length - pausadas})
          </button>
          <button
            type="button"
            onClick={() => setVerPausadas(true)}
            className={`rounded-full px-3 py-1 font-semibold ${verPausadas ? 'bg-noche text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
          >
            Pausadas ({pausadas})
          </button>
          {verPausadas && <span className="text-xs text-slate-500">Ya no se usan; se pueden reactivar desde su ficha.</span>}
        </div>
      )}

      <Tabla
        id="companias-v2"
        key={verPausadas ? 'pausadas' : 'activas'}
        filas={visibles}
        columnas={columnas}
        clave={(a) => a.id}
        onFila={(a) => setAbierta(a.id)}
        buscar={(a) => [a.nombre, a.razonSocial ?? '', a.cuit ?? '', a.email, a.emailReclamos ?? ''].join(' ')}
        textoBusqueda="Buscar por nombre, razón social, CUIT o correo"
        ordenInicial={{ clave: 'facturas', dir: 'desc' }}
        exportar={exportar}
        resumen={(l) => (
          <>
            <strong>{l.length}</strong> compañías
          </>
        )}
      />
      {nueva && <AltaCompania onCrear={darDeAlta} onCerrar={() => setNueva(false)} existentes={aseguradoras.map((a) => a.nombre.toLowerCase())} />}
      {ficha && <FichaCompania a={ficha} facturas={facturas[ficha.id] ?? 0} anio={anio} onCambiar={(c) => cambiar(ficha, c)} onCerrar={() => setAbierta(null)} />}
    </>
  )
}

/** Ficha de una compañía: todos sus datos, y lo que Cobranzas cambia seguido (canal, plataforma, mails, tolerancia). */
function FichaCompania({
  a,
  facturas,
  anio,
  onCambiar,
  onCerrar,
}: {
  a: Aseguradora
  facturas: number
  anio: string
  onCambiar: (c: Partial<Aseguradora>) => void
  onCerrar: () => void
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-noche/30" role="dialog" aria-modal="true" aria-labelledby="titulo-ficha" onClick={onCerrar}>
      <div className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="titulo-ficha" className="text-lg font-extrabold">
              {a.nombre}
            </h2>
            {a.pausada && <span className="mb-1 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700">Pausada</span>}
            <p className="text-xs text-slate-500">
              {a.razonSocial ?? 'Sin razón social'} · CUIT {formatoCuit(a.cuit) || 'sin cargar'} · {facturas.toLocaleString('es-AR')} facturas en {anio}
            </p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-400 hover:bg-fondo">
            <X className="h-5 w-5" />
          </button>
        </div>

        <section className="mt-5 space-y-3 rounded-xl border border-slate-200 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Presentación</h3>
          <div className="inline-flex flex-wrap rounded-lg border border-slate-200 bg-fondo p-0.5 text-sm font-semibold" role="group" aria-label="Cómo se presenta">
            {(
              [
                ['mail', 'Por mail'],
                ['portal', 'Por plataforma'],
                ['ambas', 'Por las dos'],
              ] as const
            ).map(([canal, titulo]) => {
              const activo = (a.canal ?? 'mail') === canal
              return (
                <button
                  key={canal}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => !activo && onCambiar({ canal })}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 ${activo ? 'bg-white text-noche shadow-sm' : 'text-slate-500 hover:text-noche'}`}
                >
                  {canal !== 'portal' && <Mail className="h-4 w-4" />}
                  {canal !== 'mail' && <MonitorUp className="h-4 w-4" />} {titulo}
                </button>
              )
            })}
          </div>
          {a.canal === 'ambas' && (
            <div className="space-y-2 rounded-lg bg-fondo p-3">
              <p className="text-xs text-slate-600">
                Si se sabe por el siniestro, Presentar separa solas las facturas. Poné cómo empieza el número (si son varios, separalos con coma). Las que no coincidan aparecen con las dos opciones.
              </p>
              <ComienzoSiniestro key={`${a.id}-mail`} titulo="Van por mail los siniestros que empiezan con" valor={a.siniestrosPorMail} onCambiar={(v) => onCambiar({ siniestrosPorMail: v })} />
              <ComienzoSiniestro key={`${a.id}-portal`} titulo="Van por plataforma los que empiezan con" valor={a.siniestrosPorPlataforma} onCambiar={(v) => onCambiar({ siniestrosPorPlataforma: v })} />
            </div>
          )}
          <ListaEditable
            titulo="Enlaces a la plataforma"
            valor={a.portalUrl}
            tipo="enlace"
            ejemplo="https://portal.compania.com"
            onCambiar={(v) => onCambiar({ portalUrl: v })}
          />
          <ListaEditable titulo="Mails para presentar" valor={a.email} tipo="mail" ejemplo="facturacion@compania.com" onCambiar={(v) => onCambiar({ email: v })} />
          <p className="text-xs text-slate-500">Paga a los {a.plazoPagoDias} días de presentada.</p>
        </section>

        <section className="mt-4 space-y-3 rounded-xl border border-slate-200 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Reclamos</h3>
          <ListaEditable
            titulo="Mails para reclamar"
            valor={a.emailReclamos}
            tipo="mail"
            ejemplo="cobranzas@compania.com"
            ayuda="Si no hay ninguno, el reclamo va a los de presentar."
            onCambiar={(v) => onCambiar({ emailReclamos: v })}
          />
          <label className="block text-xs font-semibold text-slate-600">
            Tolerancia antes de reclamar
            <span className="mt-1 flex items-center gap-2">
              <input
                key={`${a.id}-tolerancia`}
                type="number"
                min={0}
                max={120}
                defaultValue={a.toleranciaReclamo ?? 0}
                onBlur={(e) => Number(e.target.value) !== (a.toleranciaReclamo ?? 0) && onCambiar({ toleranciaReclamo: Math.max(0, Number(e.target.value) || 0) })}
                className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-right text-sm tabular-nums"
              />
              <span className="font-normal text-slate-500">días después del vencimiento (para las que suelen pagar)</span>
            </span>
          </label>
        </section>
        <section className="mt-4 rounded-xl border border-slate-200 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{a.pausada ? 'Compañía pausada' : 'Dejar de usar'}</h3>
          <p className="mt-1 text-xs text-slate-600">
            {a.pausada
              ? 'No aparece entre las activas. Al reactivarla vuelve con todos sus datos.'
              : 'Si ya no se trabaja con esta compañía, se pausa: no se borra nada y se puede reactivar cuando haga falta.'}
          </p>
          <button
            type="button"
            onClick={() => onCambiar({ pausada: !a.pausada })}
            className={`mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${a.pausada ? 'bg-marca text-white hover:bg-marca-oscuro' : 'border border-slate-300 bg-white text-slate-700 hover:bg-fondo'}`}
          >
            {a.pausada ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />} {a.pausada ? 'Reactivar' : 'Pausar compañía'}
          </button>
        </section>
        <p className="mt-3 text-[11px] text-slate-500">Los cambios se guardan solos y valen para todo el sector.</p>
      </div>
    </div>
  )
}

/**
 * Varios mails o enlaces de una compañía: cada uno en su renglón, con una cruz para quitarlo y
 * un campo para agregar otro. Se guardan juntos, separados por coma.
 */
function ListaEditable({
  titulo,
  valor,
  tipo,
  ejemplo,
  ayuda,
  onCambiar,
}: {
  titulo: string
  valor: string | undefined
  tipo: 'mail' | 'enlace'
  ejemplo: string
  ayuda?: string
  onCambiar: (v: string) => void
}) {
  const lista = separarLista(valor)
  const [nuevo, setNuevo] = useState('')
  const [error, setError] = useState('')
  const agregar = () => {
    const v = tipo === 'enlace' ? completarEnlace(nuevo) : nuevo.trim()
    if (!v) return
    if (tipo === 'mail' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return setError('Revisar el mail: falta la @ o el dominio.')
    if (tipo === 'enlace' && !/^https?:\/\/[^\s.]+\.[^\s]+$/.test(v)) return setError('Revisar el enlace.')
    if (lista.some((x) => x.toLowerCase() === v.toLowerCase())) return setError('Ya está en la lista.')
    onCambiar(unirLista([...lista, v]))
    setNuevo('')
    setError('')
  }
  return (
    <div className="text-xs font-semibold text-slate-600">
      {titulo}
      {lista.length > 0 ? (
        <ul className="mt-1 space-y-1">
          {lista.map((x) => (
            <li key={x} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-fondo px-2.5 py-1.5 text-sm font-normal text-noche">
              {tipo === 'enlace' ? (
                <a href={completarEnlace(x)} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-1 text-marca hover:underline">
                  <span className="truncate">{x.replace(/^https?:\/\//, '')}</span> <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </a>
              ) : (
                <span className="min-w-0 flex-1 truncate">{x}</span>
              )}
              <button
                type="button"
                onClick={() => onCambiar(unirLista(lista.filter((y) => y !== x)))}
                aria-label={`Quitar ${x}`}
                className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-white hover:text-sem-rojo"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs font-normal text-slate-400">Sin cargar</p>
      )}
      <div className="mt-1.5 flex gap-2">
        <input
          value={nuevo}
          onChange={(e) => {
            setNuevo(e.target.value)
            setError('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              agregar()
            }
          }}
          type={tipo === 'mail' ? 'email' : 'url'}
          placeholder={ejemplo}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-noche focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/20"
        />
        <button type="button" onClick={agregar} disabled={!nuevo.trim()} className="shrink-0 rounded-lg border border-marca/40 px-3 text-sm font-semibold text-marca hover:bg-marca/5 disabled:opacity-40">
          Agregar
        </button>
      </div>
      {error && <p className="mt-1 text-xs font-semibold text-sem-rojo">{error}</p>}
      {ayuda && !error && <p className="mt-1 text-[11px] font-normal text-slate-500">{ayuda}</p>}
    </div>
  )
}

/** Alta de una compañía nueva: nombre obligatorio; razón social, CUIT y plazo si se tienen a mano. */
function AltaCompania({
  onCrear,
  onCerrar,
  existentes,
}: {
  onCrear: (a: Pick<Aseguradora, 'nombre' | 'razonSocial' | 'cuit' | 'plazoPagoDias'>) => void
  onCerrar: () => void
  existentes: string[]
}) {
  const [nombre, setNombre] = useState('')
  const [razonSocial, setRazonSocial] = useState('')
  const [cuit, setCuit] = useState('')
  const [plazo, setPlazo] = useState(30)
  const repetida = existentes.includes(nombre.trim().toLowerCase())
  const cuitMal = cuit.replace(/\D/g, '').length > 0 && cuit.replace(/\D/g, '').length !== 11
  const campo = 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-noche focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/20'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-noche/40 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-alta" onClick={onCerrar}>
      <form
        className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (!nombre.trim() || repetida || cuitMal) return
          onCrear({ nombre: nombre.trim(), razonSocial: razonSocial.trim() || undefined, cuit: cuit.replace(/\D/g, '') || undefined, plazoPagoDias: plazo })
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="titulo-alta" className="text-lg font-extrabold">
            Nueva compañía
          </h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-400 hover:bg-fondo">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">Después de darla de alta se abre su ficha, para cargar cómo se presenta, los mails y los enlaces.</p>
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-semibold text-slate-600">
            Nombre (como figura en el ERP)
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus required placeholder="Por ejemplo: Seguros del Sur" className={campo} />
            {repetida && <span className="mt-1 block font-semibold text-sem-rojo">Ya hay una compañía con ese nombre (puede estar pausada).</span>}
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Razón social
            <input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} className={campo} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-600">
              CUIT
              <input value={cuit} onChange={(e) => setCuit(e.target.value)} inputMode="numeric" placeholder="30-00000000-0" className={campo} />
              {cuitMal && <span className="mt-1 block font-semibold text-sem-rojo">El CUIT tiene 11 números.</span>}
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Plazo de pago
              <select value={plazo} onChange={(e) => setPlazo(Number(e.target.value))} className={campo}>
                <option value={7}>7 días</option>
                <option value={30}>30 días</option>
              </select>
            </label>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCerrar} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-fondo">
            Cancelar
          </button>
          <button type="submit" disabled={!nombre.trim() || repetida || cuitMal} className="rounded-lg bg-marca px-4 py-2 text-sm font-semibold text-white hover:bg-marca-oscuro disabled:opacity-50">
            Dar de alta
          </button>
        </div>
      </form>
    </div>
  )
}

/** Cómo empiezan los siniestros de una vía (se guarda al salir del campo). */
function ComienzoSiniestro({ titulo, valor, onCambiar }: { titulo: string; valor: string | undefined; onCambiar: (v: string) => void }) {
  const [texto, setTexto] = useState(valor ?? '')
  const guardar = () => {
    const limpio = prefijos(texto).join(', ')
    setTexto(limpio)
    if (limpio !== (valor ?? '')) onCambiar(limpio)
  }
  return (
    <label className="block text-xs font-semibold text-slate-600">
      {titulo}
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={guardar}
        onKeyDown={(e) => e.key === 'Enter' && guardar()}
        placeholder="Ej.: 2"
        inputMode="numeric"
        className="mt-1 block w-40 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm font-normal"
      />
    </label>
  )
}
