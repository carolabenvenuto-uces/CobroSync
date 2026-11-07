import { useMemo, useRef, useState } from 'react'
import { Info, Mail, MonitorUp, Upload, X } from 'lucide-react'
import { EncabezadoPagina } from '../components/ui/Card'
import { Tabla, type Columna } from '../components/ui/Tabla'
import { useApp } from '../context/AppContext'
import type { Aseguradora } from '../domain/tipos'
import { descargarExcel } from '../lib/exportar'
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
  const { datos, fuente, actualizarAseguradoras } = useApp()
  const { aseguradoras, comprobantes } = datos!
  const entrada = useRef<HTMLInputElement>(null)
  const [mensaje, setMensaje] = useState<{ texto: string; error?: boolean } | null>(null)

  const facturas = useMemo(() => {
    const r: Record<string, number> = {}
    for (const c of comprobantes) if (c.tipo === 'FC') r[c.aseguradoraId] = (r[c.aseguradoraId] ?? 0) + 1
    return r
  }, [comprobantes])

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
      if (fuente.tipo === 'google') await guardarAseguradorasEnGoogle(lista.filter((x) => x.id === a.id), true)
    } catch (e) {
      setMensaje({ texto: e instanceof Error ? e.message : 'No se pudo guardar el cambio.', error: true })
    }
  }

  // Lo que hace falta para presentar y reclamar sin buscar el dato a mano
  const faltan = (a: Aseguradora) =>
    [
      !a.cuit && 'CUIT',
      a.canal === 'portal' ? !a.portalUrl && 'plataforma' : !a.email && 'mail',
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
      filtro: (a) => (a.canal === 'portal' ? 'Plataforma' : 'Mail'),
      celda: (a) =>
        a.canal === 'portal' ? (
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
    { clave: 'facturas', titulo: 'Facturas', derecha: true, orden: (a) => facturas[a.id] ?? 0, celda: (a) => (facturas[a.id] ?? 0).toLocaleString('es-AR') },
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
              onClick={() => entrada.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-noche hover:bg-fondo"
              title='El Excel de la planilla (se toma la pestaña CP) o un CSV de "CP" o "Info. Compañías"'
            >
              <Upload className="h-4 w-4" /> Cargar pestaña CP / Info. Compañías
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

      <Tabla
        id="companias-v2"
        filas={aseguradoras}
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
      {ficha && <FichaCompania a={ficha} facturas={facturas[ficha.id] ?? 0} onCambiar={(c) => cambiar(ficha, c)} onCerrar={() => setAbierta(null)} />}
    </>
  )
}

/** Ficha de una compañía: todos sus datos, y lo que Auditoría cambia seguido (canal, plataforma, mails, tolerancia). */
function FichaCompania({
  a,
  facturas,
  onCambiar,
  onCerrar,
}: {
  a: Aseguradora
  facturas: number
  onCambiar: (c: Partial<Aseguradora>) => void
  onCerrar: () => void
}) {
  const campo = 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-noche focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/20'
  const texto = (clave: 'email' | 'emailReclamos' | 'portalUrl', titulo: string, ejemplo: string) => (
    <label className="block text-xs font-semibold text-slate-600">
      {titulo}
      <input
        key={`${a.id}-${clave}`}
        defaultValue={a[clave] ?? ''}
        onBlur={(e) => e.target.value.trim() !== (a[clave] ?? '') && onCambiar({ [clave]: e.target.value.trim() })}
        placeholder={ejemplo}
        className={campo}
      />
    </label>
  )
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-noche/30" role="dialog" aria-modal="true" aria-labelledby="titulo-ficha" onClick={onCerrar}>
      <div className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="titulo-ficha" className="text-lg font-extrabold">
              {a.nombre}
            </h2>
            <p className="text-xs text-slate-500">
              {a.razonSocial ?? 'Sin razón social'} · CUIT {formatoCuit(a.cuit) || 'sin cargar'} · {facturas.toLocaleString('es-AR')} facturas
            </p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-400 hover:bg-fondo">
            <X className="h-5 w-5" />
          </button>
        </div>

        <section className="mt-5 space-y-3 rounded-xl border border-slate-200 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Presentación</h3>
          <div className="inline-flex rounded-lg border border-slate-200 bg-fondo p-0.5 text-sm font-semibold" role="group" aria-label="Cómo se presenta">
            {(
              [
                ['mail', 'Por mail', Mail],
                ['portal', 'Por plataforma', MonitorUp],
              ] as const
            ).map(([canal, titulo, Icono]) => {
              const activo = (a.canal === 'portal') === (canal === 'portal')
              return (
                <button
                  key={canal}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => !activo && onCambiar({ canal })}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 ${activo ? 'bg-white text-noche shadow-sm' : 'text-slate-500 hover:text-noche'}`}
                >
                  <Icono className="h-4 w-4" /> {titulo}
                </button>
              )
            })}
          </div>
          {a.canal === 'portal' ? texto('portalUrl', 'Dirección de la plataforma', 'https://…') : texto('email', 'Mail para presentar', 'facturacion@compania.com')}
          <p className="text-xs text-slate-500">Paga a los {a.plazoPagoDias} días de presentada.</p>
        </section>

        <section className="mt-4 space-y-3 rounded-xl border border-slate-200 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Reclamos</h3>
          {texto('emailReclamos', 'Mail para reclamar', 'Si queda vacío, se usa el de presentar')}
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
        <p className="mt-3 text-[11px] text-slate-500">Los cambios se guardan solos al salir de cada campo y valen para todo el sector.</p>
      </div>
    </div>
  )
}
