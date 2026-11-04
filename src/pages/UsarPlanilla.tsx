import { useState, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileSpreadsheet, LockKeyhole, RotateCcw, Upload } from 'lucide-react'
import { Card, CardTitulo, EncabezadoPagina } from '../components/ui/Card'
import { useApp } from '../context/AppContext'
import { actualizarPlanillaEnGoogle, guardarAseguradorasEnGoogle, sincronizarPlanillaEnGoogle } from '../services/google'
import { importarPlanilla, leerArchivo, type ResultadoImportacion } from '../services/planilla'
import { formatoFecha } from '../lib/formato'

/** Fecha de hoy en la zona horaria del navegador, como "AAAA-MM-DD". */
function hoyLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Cargar la planilla real (el Excel completo o la hoja Diario en CSV) para ver los pendientes, alertas e
 * informes con datos verdaderos. Se procesa solo en este navegador.
 */
export default function UsarPlanilla() {
  const { fuente, usarPlanilla, usarDemo } = useApp()
  const conGoogle = fuente.tipo === 'google'
  const [pasando, setPasando] = useState<string | null>(null)
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [resumen, setResumen] = useState<ResultadoImportacion | null>(null)
  const [arrastrando, setArrastrando] = useState(false)

  async function procesar(archivo: File | undefined) {
    if (!archivo) return
    setError(null)
    setCargando(true)
    try {
      const texto = await leerArchivo(archivo, /diario/i)
      const resultado = importarPlanilla(texto, hoyLocal())
      // Con Google no se reemplazan los datos de la empresa: primero se muestra qué se va a pasar
      if (!conGoogle) usarPlanilla(resultado, archivo.name)
      setResumen(resultado)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setCargando(false)
    }
  }

  /**
   * Pasa la planilla a CobroSync (Google). Se puede repetir: agrega las facturas nuevas y, en las
   * que ya están, completa presentación y cobro. El id sale de la referencia, para que no cambie
   * de una carga a otra.
   */
  async function pasarAGoogle() {
    if (!resumen) return
    setError(null)
    try {
      setPasando('Guardando las compañías…')
      await guardarAseguradorasEnGoogle(resumen.datos.aseguradoras)
      const lista = resumen.datos.comprobantes.map((c) => ({
        ...c,
        id: c.ref ? `ref-${c.ref}` : `pl-${c.tipo}-${c.puntoVenta}-${c.numero}`,
      }))
      let nuevas = 0
      let actualizadas = 0
      let omitidas = 0
      for (let i = 0; i < lista.length; i += 300) {
        setPasando(`Guardando facturas: ${Math.min(i + 300, lista.length).toLocaleString('es-AR')} de ${lista.length.toLocaleString('es-AR')}…`)
        const r = await sincronizarPlanillaEnGoogle(lista.slice(i, i + 300))
        nuevas += r.nuevas
        actualizadas += r.actualizadas
        omitidas += r.omitidas ?? 0
      }
      setPasando(
        `Listo: ${nuevas.toLocaleString('es-AR')} facturas nuevas y ${actualizadas.toLocaleString('es-AR')} actualizadas (presentación o cobro). No se borró nada.${
          omitidas ? ` ${omitidas.toLocaleString('es-AR')} son de sucursales que no están en la prueba y siguen solo en la planilla.` : ''
        }`,
      )
      usarDemo() // vuelve a leer los datos desde Google
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setPasando(null)
    }
  }

  const [copiando, setCopiando] = useState<string | null>(null)
  async function copiarAMiPlanilla() {
    setCopiando('Actualizando…')
    try {
      const r = await actualizarPlanillaEnGoogle()
      setCopiando(r.completadas ? `Listo: se completaron ${r.completadas.toLocaleString('es-AR')} celdas en la hoja Diario.` : 'Listo: la hoja Diario ya estaba al día.')
    } catch (e) {
      setCopiando(e instanceof Error ? e.message : String(e))
    }
  }

  function soltar(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    setArrastrando(false)
    void procesar(e.dataTransfer.files[0])
  }

  const porSucursal = resumen
    ? resumen.datos.meta.sucursales.map((s) => ({
        nombre: s.nombre,
        cantidad: resumen.datos.comprobantes.filter((c) => c.sucursal === s.nombre).length,
      }))
    : []

  return (
    <>
      <EncabezadoPagina
        titulo="Usar mi planilla"
        subtitulo="Mirá los pendientes, alertas e informes con los datos reales de la planilla de control"
      />

      <div className="mb-4 flex items-start gap-3 rounded-lg border border-esmeralda/30 bg-esmeralda/5 px-4 py-3 text-sm text-emerald-900">
        <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <strong>El archivo no sale de tu computadora.</strong> Se lee y se procesa en este navegador: no se sube a
          ningún servidor ni se guarda. Al recargar la página o cerrarla, los datos desaparecen y vuelve la demo.
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitulo>1. Descargá la planilla</CardTitulo>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>Abrí la planilla de control en Google Sheets.</li>
            <li>
              Menú <strong>Archivo → Descargar → Microsoft Excel (.xlsx)</strong>. Se toma sola la pestaña <strong>Diario</strong>.
            </li>
            <li>Arrastrá el archivo acá al lado (o tocá para elegirlo).</li>
          </ol>
          <p className="mt-4 text-xs text-slate-500">
            También sirve un CSV de la hoja Diario. Se espera el mismo orden de columnas que la planilla (C = Sucursal, O = Estado).
          </p>
          <p className="mt-2 text-xs text-slate-500">
            <strong>Reclamos (opcional):</strong> si agregás a la planilla las columnas <strong>S</strong> "Reclamado" (una x),{' '}
            <strong>T</strong> "Cant. reclamos" y <strong>U</strong> "Fecha último reclamo", la página muestra qué vencidas se reclamaron
            y cuáles hay que escalar.
          </p>
        </Card>

        <label
          onDragOver={(e) => {
            e.preventDefault()
            setArrastrando(true)
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={soltar}
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition ${
            arrastrando ? 'border-marca bg-marca/5' : 'border-slate-300 bg-white hover:border-marca/60'
          }`}
        >
          <Upload className="h-8 w-8 text-marca" />
          <span className="font-semibold">{cargando ? 'Leyendo…' : '2. Soltá acá el Excel de la planilla'}</span>
          <span className="text-xs text-slate-500">o tocá para elegirlo</span>
          <input
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(e) => void procesar(e.target.files?.[0])}
          />
        </label>
      </div>

      <Card className="mt-4">
        <CardTitulo>Durante la prueba: tu planilla se sigue llenando sola</CardTitulo>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
          <li>
            Al cargar el Excel del ERP en <strong>Control diario</strong>, las filas nuevas se agregan al final de la pestaña{' '}
            <strong>Quiter</strong> de tu planilla, tal cual y de todas las sucursales. La hoja Diario las toma como siempre, en el mismo orden.
          </li>
          <li>
            Cada hora, en la hoja <strong>Diario</strong>, se completan para las sucursales del piloto las columnas que hoy se escriben a
            mano: <strong>Drive</strong> (el día en que Auditoría aprobó toda la documentación), <strong>Presentación</strong>,{' '}
            <strong>Cobro</strong> y <strong>Estado</strong>. Cada factura se busca por la referencia.
          </li>
          <li>No se borra ningún dato, no se pisa ninguna fórmula y no se mueve ninguna fila. Las demás sucursales se completan a mano como siempre.</li>
        </ul>
        {conGoogle && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void copiarAMiPlanilla()}
              disabled={copiando === 'Actualizando…'}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-fondo disabled:opacity-60"
            >
              Actualizar mi planilla ahora
            </button>
            {copiando && <span className="text-xs text-slate-600">{copiando}</span>}
          </div>
        )}
      </Card>

      {error && (
        <div className="mt-4 rounded-lg border border-sem-rojo/30 bg-sem-rojo/5 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {conGoogle && resumen && (
        <Card className="mt-4">
          <CardTitulo>3. Pasar la planilla a CobroSync</CardTitulo>
          <p className="text-sm text-slate-700">
            Se leyeron <strong>{resumen.datos.comprobantes.length.toLocaleString('es-AR')}</strong> comprobantes. Al confirmar, se agregan
            a CobroSync los que todavía no estén (se comparan por referencia). En los que ya están, solo se completan la presentación y
            el cobro si la planilla los tiene. Se puede repetir durante la prueba; no se borra nada. Solo pasan las sucursales
            cargadas en la prueba piloto; las demás siguen en la planilla.
          </p>
          <button
            type="button"
            disabled={pasando !== null && !pasando.startsWith('Listo')}
            onClick={() => void pasarAGoogle()}
            className="mt-3 rounded-lg bg-marca px-4 py-2 text-sm font-semibold text-white hover:bg-marca-oscuro disabled:opacity-60"
          >
            Guardar en CobroSync
          </button>
          {pasando && <p className="mt-2 text-sm text-slate-600">{pasando}</p>}
        </Card>
      )}

      {fuente.tipo === 'planilla' && (
        <Card className="mt-4">
          <CardTitulo
            accion={
              <button
                type="button"
                onClick={usarDemo}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-fondo"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Volver a la demo
              </button>
            }
          >
            <span className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-esmeralda" />
              Usando {fuente.archivo}
            </span>
          </CardTitulo>
          <p className="text-sm text-slate-700">
            Se leyeron <strong>{fuente.filas.toLocaleString('es-AR')}</strong> comprobantes
            {resumen && resumen.filasIgnoradas > 0 && ` (se ignoraron ${resumen.filasIgnoradas} filas sin fecha o sin sucursal)`}.
            Los plazos se calculan al {formatoFecha(hoyLocal())}.
          </p>
          {porSucursal.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2 text-xs">
              {porSucursal.map((s) => (
                <li key={s.nombre} className="rounded-md bg-fondo px-2 py-1">
                  {s.nombre}: <strong>{s.cantidad.toLocaleString('es-AR')}</strong>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate('/app/pendientes')}
              className="rounded-lg bg-marca px-4 py-2 text-sm font-semibold text-white hover:bg-marca-oscuro"
            >
              Ver pendientes de sucursales
            </button>
            <button
              type="button"
              onClick={() => navigate('/app/sucursales')}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-fondo"
            >
              Ver ranking
            </button>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Qué no trae la planilla: el detalle de cada documento (se considera completo si tiene fecha de Drive), las
            conversaciones, los compromisos de las sucursales y el aviso de las notas de crédito. Eso empieza a existir
            cuando las sucursales usen CobroSync.
          </p>
        </Card>
      )}
    </>
  )
}
