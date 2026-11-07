import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Building2, ChevronRight, ClipboardCheck, LineChart } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Isologo } from '../components/Logo'
import { AUTORIA, VERSION } from '../lib/marca'
import { useApp } from '../context/AppContext'
import type { Rol } from '../domain/tipos'
import { conectadoAGoogle } from '../services/google'

const PERFILES: { rol: Rol; titulo: string; cuenta: string; detalle: string; icono: typeof LineChart }[] = [
  { rol: 'gerencia', titulo: 'Gerencia', cuenta: 'gerencia.general@svaauto.com.ar', detalle: 'Resumen, control por sucursal, saldos e impacto. Solo consulta.', icono: LineChart },
  { rol: 'auditoria', titulo: 'Auditoría', cuenta: 'auditoria@svaauto.com.ar', detalle: 'Avisos, revisión de documentos, presentación y reclamos.', icono: ClipboardCheck },
  { rol: 'sucursal', titulo: 'Sucursal', cuenta: 'facturacion.sucursal@svaauto.com.ar', detalle: 'Carga de documentación de las facturas de la sucursal.', icono: Building2 },
]

/**
 * Pantalla de inicio.
 * - Demo: se elige con qué usuario de ejemplo entrar (en la versión real, el usuario sale de la cuenta de la empresa).
 * - Con Google: la persona ya entró con su cuenta, así que pasa directo a su vista.
 */
export default function Ingreso() {
  const { datos, fuente, sesionIniciada, iniciarSesion } = useApp()
  const navigate = useNavigate()
  const [sucursal, setSucursal] = useState('')

  if (conectadoAGoogle() || fuente.tipo === 'google' || sesionIniciada) return <Navigate to="/app" replace />

  const sucursales = datos?.meta.sucursales ?? []
  const elegida = sucursal || sucursales[0]?.nombre || ''

  function entrar(rol: Rol) {
    iniciarSesion(rol, rol === 'sucursal' ? elegida : undefined)
    navigate('/app')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-noche px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <Isologo className="h-14 w-14" claro />
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white">
            CobroSync <span className="align-baseline text-xs font-medium text-slate-500">v{VERSION}</span>
          </h1>
          <p className="mt-2 text-sm text-slate-300">Seguimiento de facturas a compañías de seguros</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-xl sm:p-8">
          <h2 className="text-xl font-extrabold text-noche">Ingresar</h2>
          <p className="mt-1 text-sm text-slate-600">
            Cada persona entra con la cuenta de la empresa y ve solamente lo que corresponde a su área.
          </p>


          <ul className="mt-5 space-y-3">
            {PERFILES.map((p) => (
              <li key={p.rol}>
                <div className="flex items-center gap-4 rounded-xl border border-slate-200 p-4 transition hover:border-marca hover:shadow-sm">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-marca/10 text-marca">
                    <p.icono className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-noche">{p.titulo}</div>
                    <div className="truncate text-xs text-slate-500">{p.cuenta}</div>
                    <div className="mt-1 text-xs text-slate-600">{p.detalle}</div>
                    {p.rol === 'sucursal' && (
                      <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
                        Sucursal
                        <select
                          value={elegida}
                          onChange={(e) => setSucursal(e.target.value)}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-noche"
                        >
                          {sucursales.map((s) => (
                            <option key={s.nombre}>{s.nombre}</option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => entrar(p.rol)}
                    disabled={!datos}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-marca px-3 py-2 text-sm font-semibold text-white hover:bg-marca-oscuro disabled:opacity-50"
                  >
                    Entrar <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

        </div>
        <img src={`${import.meta.env.BASE_URL}grupo-sva-claro.png`} alt="Grupo SVA" className="mx-auto mt-8 h-12 w-auto opacity-90" />
        <p className="mt-4 text-center text-xs text-slate-400">
          <Link to="/manual" className="font-semibold text-slate-200 hover:underline">
            Manual de uso
          </Link>{' '}
          · {AUTORIA}
        </p>
      </div>
    </div>
  )
}
