import { useMemo, useRef, useState } from 'react'
import { Info, LockKeyhole, Upload } from 'lucide-react'
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

  const correo = (texto: string | undefined) =>
    texto ? (
      <span className="block max-w-72 truncate text-xs text-slate-700" title={texto}>
        {texto}
      </span>
    ) : (
      <span className="text-xs text-slate-400">—</span>
    )

  const columnas: Columna<Aseguradora>[] = [
    { clave: 'nombre', titulo: 'Compañía', orden: (a) => a.nombre, filtro: (a) => a.nombre, celda: (a) => <span className="whitespace-nowrap font-semibold">{a.nombre}</span> },
    { clave: 'razon', titulo: 'Razón social', orden: (a) => a.razonSocial ?? '', celda: (a) => <span className="text-xs">{a.razonSocial ?? '—'}</span> },
    { clave: 'cuit', titulo: 'CUIT', celda: (a) => <span className="whitespace-nowrap tabular-nums">{formatoCuit(a.cuit) || '—'}</span> },
    {
      clave: 'plazo',
      titulo: 'Plazo de pago',
      orden: (a) => a.plazoPagoDias,
      filtro: (a) => `${a.plazoPagoDias} días`,
      celda: (a) => <span className="whitespace-nowrap">{a.plazoPagoDias} días</span>,
    },
    { clave: 'email', titulo: 'Mail para presentar', celda: (a) => correo(a.email) },
    { clave: 'reclamos', titulo: 'Mail para reclamar', celda: (a) => correo(a.emailReclamos) },
    { clave: 'facturas', titulo: 'Facturas', derecha: true, orden: (a) => facturas[a.id] ?? 0, celda: (a) => (facturas[a.id] ?? 0).toLocaleString('es-AR') },
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
        subtitulo="Razón social, CUIT, plazo de pago y correos de cada compañía de seguros"
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

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-marca/20 bg-marca/5 px-4 py-3 text-sm text-blue-900">
        {fuente.tipo === 'demo' ? <Info className="mt-0.5 h-4 w-4 shrink-0" /> : <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />}
        <span>
          {fuente.tipo === 'demo' ? (
            <>
              Razón social, CUIT y plazo son los reales. <strong>Los correos de la demo son inventados</strong> (terminan en
              ".example"). Para ver los reales, cargá la pestaña "CP" o "Info. Compañías" de la planilla: se lee solo en este
              navegador y no se guarda.
            </>
          ) : fuente.tipo === 'google' ? (
            <>Los datos que cargues de la planilla quedan guardados en CobroSync para todo el sector.</>
          ) : (
            <>Los datos que cargues de la planilla se leen solo en este navegador y desaparecen al recargar.</>
          )}
        </span>
      </div>

      {mensaje && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${mensaje.error ? 'border-sem-rojo/30 bg-sem-rojo/5 text-red-900' : 'border-esmeralda/30 bg-esmeralda/5 text-emerald-900'}`}
        >
          {mensaje.texto}
        </div>
      )}

      <Tabla
        filas={aseguradoras}
        columnas={columnas}
        clave={(a) => a.id}
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
    </>
  )
}
