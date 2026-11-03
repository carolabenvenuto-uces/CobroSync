/**
 * Estado global de la app (lo que comparten todas las pantallas):
 * - los datos cargados
 * - el rol activo (Taller, Administración, Gerencia)
 * - los filtros del encabezado (sucursal y mes)
 *
 * React Context evita pasar estos valores "a mano" de componente en componente.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Comprobante, DatosApp, Rol } from '../domain/tipos'
import { anioDe, mesDe } from '../lib/fechas'
import { cargarDatos } from '../services/datos'

export const TODAS_LAS_SUCURSALES = 'Todas'

export const NOMBRE_ROL: Record<Rol, string> = {
  taller: 'Taller',
  administracion: 'Administración y cobranzas',
  gerencia: 'Gerencia',
}

interface EstadoApp {
  datos: DatosApp | null
  error: string | null
  rol: Rol
  setRol: (rol: Rol) => void
  sucursal: string
  setSucursal: (sucursal: string) => void
  anio: number
  mes: number
  setMes: (mes: number) => void
  /** En la etapa 1 los cambios viven en memoria: al recargar la página se pierden. */
  actualizarComprobante: (id: string, cambios: Partial<Comprobante>) => void
}

const AppContext = createContext<EstadoApp | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [datos, setDatos] = useState<DatosApp | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rol, setRol] = useState<Rol>('administracion')
  const [sucursal, setSucursal] = useState(TODAS_LAS_SUCURSALES)
  const [mes, setMes] = useState(10)
  const [anio, setAnio] = useState(2026)

  useEffect(() => {
    cargarDatos()
      .then((d) => {
        setDatos(d)
        setAnio(anioDe(d.meta.fechaCorte))
        setMes(mesDe(d.meta.fechaCorte))
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  const actualizarComprobante = useCallback((id: string, cambios: Partial<Comprobante>) => {
    setDatos((actual) =>
      actual
        ? {
            ...actual,
            comprobantes: actual.comprobantes.map((c) => (c.id === id ? { ...c, ...cambios } : c)),
          }
        : actual,
    )
  }, [])

  const valor = useMemo(
    () => ({ datos, error, rol, setRol, sucursal, setSucursal, anio, mes, setMes, actualizarComprobante }),
    [datos, error, rol, sucursal, anio, mes, actualizarComprobante],
  )

  return <AppContext.Provider value={valor}>{children}</AppContext.Provider>
}

export function useApp(): EstadoApp {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp debe usarse dentro de <AppProvider>')
  return ctx
}

/** Comprobantes filtrados por la sucursal elegida en el encabezado. */
export function useComprobantes(): Comprobante[] {
  const { datos, sucursal } = useApp()
  return useMemo(() => {
    if (!datos) return []
    if (sucursal === TODAS_LAS_SUCURSALES) return datos.comprobantes
    return datos.comprobantes.filter((c) => c.sucursal === sucursal)
  }, [datos, sucursal])
}
