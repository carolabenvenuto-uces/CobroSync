import { useEffect, useState } from 'react'
import { DatabaseBackup, ExternalLink } from 'lucide-react'
import { Card, CardTitulo } from './ui/Card'
import { hacerBackupEnGoogle, listarBackupsDeGoogle, type Backup } from '../services/google'

const NOMBRE_TIPO: Record<Backup['tipo'], string> = { diario: 'Diario', semanal: 'Semanal', mensual: 'Mensual', manual: 'A mano' }
const fechaHora = (iso: string) => (iso ? new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '')

/**
 * Backups de la planilla "CobroSync · Datos": cuándo fue el último, si se hacen solos y la lista
 * con el enlace a cada copia. Solo la administradora (Ajustes). Los documentos PDF no se copian ni se tocan.
 */
export function Backups() {
  const [info, setInfo] = useState<{ backups: Backup[]; ultimo: string; automatico: boolean } | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [haciendo, setHaciendo] = useState(false)
  const [verTodos, setVerTodos] = useState(false)

  const cargar = () =>
    listarBackupsDeGoogle()
      .then(setInfo)
      .catch((e: unknown) => setMensaje(e instanceof Error ? e.message : String(e)))
  useEffect(() => {
    void cargar()
  }, [])

  async function hacerAhora() {
    setHaciendo(true)
    setMensaje(null)
    try {
      const r = await hacerBackupEnGoogle()
      setMensaje(`Listo: ${r.nombre}.`)
      await cargar()
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : String(e))
    } finally {
      setHaciendo(false)
    }
  }

  const lista = info?.backups ?? []
  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitulo>Backups</CardTitulo>
          <p className="text-sm text-slate-600">
            Copias de la planilla de datos en la carpeta <strong>CobroSync · Backups</strong>: todos los días (quedan 7), los domingos (quedan
            4) y el día 1 de cada mes (quedan 12). Los documentos no se copian ni se tocan.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void hacerAhora()}
          disabled={haciendo}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-fondo disabled:opacity-60"
        >
          <DatabaseBackup className="h-4 w-4" /> {haciendo ? 'Copiando…' : 'Hacer un backup ahora'}
        </button>
      </div>

      {info && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${info.automatico ? 'bg-esmeralda/10 text-teal-900' : 'bg-amber-50 text-amber-900'}`}>
          {info.automatico ? 'Se hacen solos cada madrugada.' : 'Todavía no se hacen solos: falta correr instalarDisparadores en Apps Script.'}
          {info.ultimo ? ` Último backup: ${fechaHora(info.ultimo)}.` : ' Todavía no hay ninguno.'}
        </p>
      )}
      {mensaje && <p className="mt-2 text-sm text-slate-600">{mensaje}</p>}

      {lista.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
          {(verTodos ? lista : lista.slice(0, 5)).map((b) => (
            <li key={b.nombre} className="flex items-center gap-3 px-3 py-2">
              <span className="w-20 shrink-0 text-xs font-semibold text-slate-500">{NOMBRE_TIPO[b.tipo] ?? b.tipo}</span>
              <span className="flex-1 tabular-nums">{b.fecha}</span>
              <a href={b.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-marca hover:underline">
                Abrir <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </li>
          ))}
        </ul>
      )}
      {lista.length > 5 && (
        <button type="button" onClick={() => setVerTodos(!verTodos)} className="mt-2 text-xs font-semibold text-marca hover:underline">
          {verTodos ? 'Ver menos' : `Ver los ${lista.length}`}
        </button>
      )}
    </Card>
  )
}
