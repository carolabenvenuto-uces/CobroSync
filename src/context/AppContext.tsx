/**
 * Estado global de la app (lo que comparten todas las pantallas):
 * - los datos cargados
 * - el rol activo (Sucursal, Auditoría, Gerencia) y la persona que "usa" la demo
 * - los filtros del encabezado (sucursal y mes)
 *
 * React Context evita pasar estos valores "a mano" de componente en componente.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AreaEvento, Comprobante, DatosApp, Evento, Rol, Sucursal } from '../domain/tipos'
import { anioDe, mesDe } from '../lib/fechas'
import { cargarDatos } from '../services/datos'
import { PARAMETROS_INICIALES, type ParametrosImpacto } from '../domain/impacto'

export const TODAS_LAS_SUCURSALES = 'Todas'

export const NOMBRE_ROL: Record<Rol, string> = {
  sucursal: 'Sucursal',
  auditoria: 'Auditoría',
  gerencia: 'Gerencia',
}

/** Pantalla de inicio de cada rol. */
export const INICIO_ROL: Record<Rol, string> = {
  sucursal: '/app/pendientes',
  auditoria: '/app',
  gerencia: '/app',
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
  /** nombre de quien está usando la demo según el rol */
  usuario: string
  /** "hoy" de la demo */
  hoy: string
  /** En la demo los cambios viven en memoria: al recargar la página se pierden. */
  actualizarComprobante: (id: string, cambios: Partial<Comprobante>) => void
  agregarComprobante: (comprobante: Comprobante) => void
  /** Agrega un evento a la conversación del legajo, firmado por el usuario actual. */
  registrarEvento: (id: string, tipo: Evento['tipo'], texto: string) => void
  /** tasa y objetivo de días para el informe de impacto económico */
  parametros: ParametrosImpacto
  setParametros: (p: ParametrosImpacto) => void
}

const AppContext = createContext<EstadoApp | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [datos, setDatos] = useState<DatosApp | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rol, setRolInterno] = useState<Rol>('auditoria')
  const [sucursal, setSucursal] = useState(TODAS_LAS_SUCURSALES)
  const [mes, setMes] = useState(10)
  const [anio, setAnio] = useState(2026)
  const [parametros, setParametros] = useState<ParametrosImpacto>(PARAMETROS_INICIALES)

  useEffect(() => {
    cargarDatos()
      .then((d) => {
        setDatos(d)
        setAnio(anioDe(d.meta.fechaCorte))
        setMes(mesDe(d.meta.fechaCorte))
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  // Una persona de sucursal solo ve su sucursal: si estaba en "Todas", elige la primera.
  const setRol = useCallback(
    (nuevo: Rol) => {
      setRolInterno(nuevo)
      if (nuevo === 'sucursal' && sucursal === TODAS_LAS_SUCURSALES && datos) {
        setSucursal(datos.meta.sucursales[0].nombre)
      }
    },
    [sucursal, datos],
  )

  const sucursalActual: Sucursal | undefined = datos?.meta.sucursales.find((s) => s.nombre === sucursal)
  const usuario =
    rol === 'sucursal' ? (sucursalActual?.personas[0] ?? 'Sucursal') : rol === 'auditoria' ? 'Carola B.' : 'Gerencia'
  const hoy = datos?.meta.fechaCorte ?? ''

  const actualizarComprobante = useCallback((id: string, cambios: Partial<Comprobante>) => {
    setDatos((actual) =>
      actual
        ? { ...actual, comprobantes: actual.comprobantes.map((c) => (c.id === id ? { ...c, ...cambios } : c)) }
        : actual,
    )
  }, [])

  const agregarComprobante = useCallback((comprobante: Comprobante) => {
    setDatos((actual) => (actual ? { ...actual, comprobantes: [...actual.comprobantes, comprobante] } : actual))
  }, [])

  const registrarEvento = useCallback(
    (id: string, tipo: Evento['tipo'], texto: string) => {
      const area: AreaEvento = rol
      const evento: Evento = { fecha: hoy, autor: usuario, area, tipo, texto }
      setDatos((actual) =>
        actual
          ? {
              ...actual,
              comprobantes: actual.comprobantes.map((c) => (c.id === id ? { ...c, eventos: [...c.eventos, evento] } : c)),
            }
          : actual,
      )
    },
    [rol, hoy, usuario],
  )

  const valor = useMemo(
    () => ({
      datos,
      error,
      rol,
      setRol,
      sucursal,
      setSucursal,
      anio,
      mes,
      setMes,
      usuario,
      hoy,
      actualizarComprobante,
      agregarComprobante,
      registrarEvento,
      parametros,
      setParametros,
    }),
    [datos, error, rol, setRol, sucursal, anio, mes, usuario, hoy, actualizarComprobante, agregarComprobante, registrarEvento, parametros],
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
