import { useState, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileSpreadsheet, LockKeyhole, RotateCcw, Upload } from 'lucide-react'
import { Card, CardTitulo, EncabezadoPagina } from '../components/ui/Card'
import { useApp } from '../context/AppContext'
import { importarPlanilla, leerArchivo, type ResultadoImportacion } from '../services/planilla'
import { formatoFecha } from '../lib/formato'

/** Fecha de hoy en la zona horaria del navegador, como "AAAA-MM-DD". */
function hoyLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Cargar la planilla real (hoja Diario en CSV) para ver los pendientes, alertas e
 * informes con datos verdaderos. Se procesa solo en este navegador.
 */
export default function UsarPlanilla() {
  const { fuente, usarPlanilla, usarDemo } = useApp()
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
      const texto = await leerArchivo(archivo)
      const resultado = importarPlanilla(texto, hoyLocal())
      usarPlanilla(resultado, archivo.name)
      setResumen(resultado)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setCargando(false)
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
          <CardTitulo>1. Descargá la hoja Diario</CardTitulo>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>Abrí la planilla de control en Google Sheets y pasate a la pestaña <strong>Diario</strong>.</li>
            <li>
              Menú <strong>Archivo → Descargar → Valores separados por comas (.csv)</strong>. Se descarga solo la hoja que
              tenés abierta.
            </li>
            <li>Arrastrá el archivo acá al lado (o tocá para elegirlo).</li>
          </ol>
          <p className="mt-4 text-xs text-slate-500">
            Si trabajás con Excel: <strong>Guardar como → CSV UTF-8</strong> estando en la hoja Diario. Se espera el
            mismo orden de columnas que la planilla (C = Sucursal, O = Estado).
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
          <span className="font-semibold">{cargando ? 'Leyendo…' : '2. Soltá acá el CSV de la hoja Diario'}</span>
          <span className="text-xs text-slate-500">o tocá para elegirlo</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => void procesar(e.target.files?.[0])}
          />
        </label>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-sem-rojo/30 bg-sem-rojo/5 px-4 py-3 text-sm text-red-800">{error}</div>
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
