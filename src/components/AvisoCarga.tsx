import { Loader2, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ponerEstadoCarga, useEstadoCarga } from '../lib/cargaPlanilla'

/**
 * Avance de la carga de la planilla, visible desde cualquier pantalla: si se cambia de pantalla
 * mientras se guarda, la carga sigue. Al tocarlo, vuelve a "Usar mi planilla".
 */
export function AvisoCarga() {
  const carga = useEstadoCarga()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  if (!carga || pathname === '/app/planilla') return null
  return (
    <div className="fixed bottom-5 left-1/2 z-[75] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-slate-200 bg-white py-2 pl-4 pr-2 text-sm shadow-lg" role="status">
      {carga.enCurso && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-marca" />}
      <button type="button" onClick={() => navigate('/app/planilla')} className={`text-left ${carga.error ? 'text-sem-rojo' : 'text-noche'}`}>
        <strong>Planilla:</strong> {carga.texto}
      </button>
      {!carga.enCurso && (
        <button type="button" onClick={() => ponerEstadoCarga(null)} aria-label="Cerrar" className="rounded-full p-1 text-slate-400 hover:bg-fondo">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
