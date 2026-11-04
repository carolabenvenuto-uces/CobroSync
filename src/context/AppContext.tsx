/**
 * Estado global de la app (lo que comparten todas las pantallas):
 * - los datos cargados
 * - el rol activo (Sucursal, Auditoría, Gerencia) y la persona que "usa" la demo
 * - los filtros del encabezado (sucursal y mes)
 *
 * React Context evita pasar estos valores "a mano" de componente en componente.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AreaEvento, Aseguradora, TipoDocumento, Comprobante, DatosApp, Evento, Rol, Sucursal } from '../domain/tipos'
import { anioDe, diffDias, mesDe } from '../lib/fechas'
import { cargarDatos } from '../services/datos'
import { cargarDesdeGoogle, conectadoAGoogle, guardarEnGoogle, subirAGoogle, type UsuarioGoogle } from '../services/google'
import type { ResultadoImportacion } from '../services/planilla'
import { PARAMETROS_INICIALES, type ParametrosImpacto } from '../domain/impacto'

export const TODAS_LAS_SUCURSALES = 'Todas'

export const NOMBRE_ROL: Record<Rol, string> = {
  sucursal: 'Sucursal',
  auditoria: 'Auditoría',
  gerencia: 'Gerencia',
}

/** Pantalla de inicio de cada rol (la ruta /app muestra una distinta según el rol). */
export const INICIO_ROL: Record<Rol, string> = {
  sucursal: '/app',
  auditoria: '/app',
  gerencia: '/app',
}

/** Aviso para una persona: a Auditoría (para = 'auditoria'), a Gerencia (para = 'gerencia') o a una sucursal (para = su nombre). */
export interface Notificacion {
  id: string
  para: string
  fecha: string
  texto: string
  comprobanteId: string
  leida: boolean
  /** avisos a Gerencia: de qué tipo y de qué sucursal, para agruparlos */
  clase?: 'critica' | 'escalar'
  sucursal?: string
  /** facturas que junta un aviso agrupado */
  facturas?: string[]
  /** si está, al tocar el aviso se abre esta pantalla en vez de una factura */
  ruta?: string
}

/**
 * A Gerencia le llega un aviso por sucursal y por tipo, no uno por factura:
 * "Alvarez Thomas: 15 facturas pasaron a documentación crítica". Al tocarlo se abre la lista.
 */
export function agruparGerencia(lista: Notificacion[]): Notificacion[] {
  const grupos = new Map<string, Notificacion>()
  const resto: Notificacion[] = []
  for (const n of lista) {
    if (n.para !== 'gerencia' || !n.clase || !n.sucursal) {
      resto.push(n)
      continue
    }
    const clave = `${n.clase}|${n.sucursal}`
    const g = grupos.get(clave)
    const facturas = [...new Set([...(g?.facturas ?? []), ...(n.facturas ?? [n.comprobanteId])])]
    const fecha = g && g.fecha > n.fecha ? g.fecha : n.fecha
    const cant = facturas.length
    const texto =
      n.clase === 'critica'
        ? `${n.sucursal}: ${cant} ${cant === 1 ? 'factura pasó' : 'facturas pasaron'} a documentación crítica (más de 21 días)`
        : `${n.sucursal}: ${cant} ${cant === 1 ? 'factura vencida' : 'facturas vencidas'} con 3 reclamos sin respuesta`
    const ruta =
      n.clase === 'critica'
        ? `/app/pendientes?sucursal=${encodeURIComponent(n.sucursal)}&estado=Cr%C3%ADtica`
        : `/app/reclamos?sucursal=${encodeURIComponent(n.sucursal)}&estado=${encodeURIComponent('Escalar a gerencia')}`
    grupos.set(clave, {
      ...(g ?? n),
      id: g?.id ?? `g-${clave}`,
      fecha,
      texto,
      facturas,
      ruta,
      // un aviso nuevo dentro del grupo lo vuelve a marcar como no leído
      leida: (g?.leida ?? true) && n.leida,
    })
  }
  return [...resto, ...grupos.values()].sort((a, b) => b.fecha.localeCompare(a.fecha))
}

/**
 * Las novedades de los últimos días de la demo arrancan como notificaciones sin leer:
 * 3 días para Auditoría y sucursales; 14 para Gerencia, que recibe menos avisos.
 */
function notificacionesIniciales(d: DatosApp): Notificacion[] {
  const lista: Notificacion[] = []
  for (const c of d.comprobantes) {
    for (const e of c.eventos) {
      const dias = diffDias(e.fecha, d.meta.fechaCorte)
      for (const n of crearNotificaciones(c, e)) {
        if (dias <= (n.para === 'gerencia' ? 14 : 3)) lista.push(n)
      }
    }
  }
  // Hasta 40 por destinatario, las más nuevas primero
  const porDestinatario = new Map<string, number>()
  return agruparGerencia(lista)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .filter((n) => {
      const cant = (porDestinatario.get(n.para) ?? 0) + 1
      porDestinatario.set(n.para, cant)
      return cant <= 40
    })
}

let contador = 0
/**
 * Cada movimiento le avisa al otro lado: lo de la sucursal a Auditoría y al revés.
 * A Gerencia le llegan solo los escalamientos: documentación crítica (más de 21 días)
 * y facturas vencidas con 3 reclamos sin respuesta.
 */
function crearNotificaciones(c: Comprobante, e: Evento): Notificacion[] {
  const numero = `${c.tipo} E ${c.puntoVenta}-${String(c.numero).padStart(8, '0')}`
  const base = () => ({ id: `n-${++contador}`, fecha: e.fecha, comprobanteId: c.id, leida: false })
  const lista: Notificacion[] = []
  if (e.area === 'sucursal') lista.push({ ...base(), para: 'auditoria', texto: `${c.sucursal} · ${numero}: ${e.texto}` })
  if (e.area === 'auditoria' && e.tipo !== 'presentacion' && e.tipo !== 'reclamo') {
    lista.push({ ...base(), para: c.sucursal, texto: `Auditoría · ${numero}: ${e.texto}` })
  }
  if (e.area === 'sistema') lista.push({ ...base(), para: c.sucursal, texto: `${numero}: ${e.texto}` })
  if (e.area === 'sistema' && /gerencia general/i.test(e.texto)) {
    lista.push({ ...base(), para: 'gerencia', clase: 'critica', sucursal: c.sucursal, texto: `Documentación crítica · ${c.sucursal} · ${numero}` })
  }
  const nReclamo = e.tipo === 'reclamo' ? Number(/Reclamo (\d+)/.exec(e.texto)?.[1] ?? 0) : 0
  if (nReclamo >= 3) {
    lista.push({ ...base(), para: 'gerencia', clase: 'escalar', sucursal: c.sucursal, texto: `Para escalar · ${numero} (${c.sucursal})` })
  }
  return lista
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
  /** reemplaza los datos de las compañías (por ejemplo, al cargar la pestaña CP de la planilla) */
  actualizarAseguradoras: (aseguradoras: Aseguradora[]) => void
  /** Agrega un evento a la conversación del legajo, firmado por el usuario actual. */
  registrarEvento: (id: string, tipo: Evento['tipo'], texto: string) => void
  /** tasa y objetivo de días para el informe de impacto económico */
  parametros: ParametrosImpacto
  setParametros: (p: ParametrosImpacto) => void
  /** la factura abierta en el panel lateral (desde cualquier pantalla) */
  legajoAbierto: string | null
  abrirLegajo: (id: string | null) => void
  /** notificaciones para quien está usando la demo */
  misNotificaciones: Notificacion[]
  marcarLeida: (id: string) => void
  marcarTodasLeidas: () => void
  /** de dónde salen los datos: la demo o la planilla que cargó el usuario (solo en memoria) */
  fuente: { tipo: 'demo' } | { tipo: 'planilla'; archivo: string; filas: number } | { tipo: 'google'; email: string }
  /** con Google: si los últimos cambios ya se guardaron */
  guardado: { estado: 'ok' | 'guardando' | 'error'; mensaje?: string }
  /** sube un archivo de la factura: a Drive con Google; en la demo solo registra el nombre */
  subirDocumento: (id: string, tipo: TipoDocumento | 'documentacion', archivo: File) => Promise<{ archivo: string; url?: string }>
  usarPlanilla: (resultado: ResultadoImportacion, archivo: string) => void
  usarDemo: () => void
  /** demo: si ya se eligió con qué usuario entrar (con Google siempre es true) */
  sesionIniciada: boolean
  iniciarSesion: (rol: Rol, sucursal?: string) => void
  cerrarSesion: () => void
  /** con Google: la cuenta con la que se entró */
  cuenta: UsuarioGoogle | null
}

const CLAVE_SESION = 'cobrosync-sesion-demo'
/** La sesión de la demo se recuerda mientras la pestaña está abierta (si el navegador lo permite). */
function leerSesion(): { rol: Rol; sucursal: string } | null {
  try {
    const v = sessionStorage.getItem(CLAVE_SESION)
    return v ? (JSON.parse(v) as { rol: Rol; sucursal: string }) : null
  } catch {
    return null
  }
}
function guardarSesion(v: { rol: Rol; sucursal: string } | null) {
  try {
    if (v) sessionStorage.setItem(CLAVE_SESION, JSON.stringify(v))
    else sessionStorage.removeItem(CLAVE_SESION)
  } catch {
    // sin almacenamiento disponible: la sesión dura hasta recargar
  }
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
  const [fuente, setFuente] = useState<EstadoApp['fuente']>({ tipo: 'demo' })
  const [legajoAbierto, abrirLegajo] = useState<string | null>(null)
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [usuarioGoogle, setUsuarioGoogle] = useState<UsuarioGoogle | null>(null)
  const [sesionDemo, setSesionDemo] = useState(() => leerSesion() !== null)
  const [guardado, setGuardado] = useState<EstadoApp['guardado']>({ estado: 'ok' })
  // Facturas cambiadas que falta guardar en Google
  const pendientesDeGuardar = useRef(new Set<string>())

  const cargarDemo = useCallback(() => {
    // Abierta desde Google Apps Script: los datos y el rol vienen de la cuenta de la empresa
    if (conectadoAGoogle()) {
      cargarDesdeGoogle()
        .then(({ usuario: u, datos: d }) => {
          setDatos(d)
          setUsuarioGoogle(u)
          setRolInterno(u.rol)
          setSucursal(u.rol === 'sucursal' && u.sucursal ? u.sucursal : TODAS_LAS_SUCURSALES)
          setAnio(anioDe(d.meta.fechaCorte))
          setMes(mesDe(d.meta.fechaCorte))
          setFuente({ tipo: 'google', email: u.email })
          setNotificaciones(notificacionesIniciales(d))
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      return
    }
    cargarDatos()
      .then((d) => {
        setDatos(d)
        setAnio(anioDe(d.meta.fechaCorte))
        setMes(mesDe(d.meta.fechaCorte))
        setFuente({ tipo: 'demo' })
        setNotificaciones(notificacionesIniciales(d))
        const sesion = leerSesion()
        if (sesion) {
          setRolInterno(sesion.rol)
          setSucursal(sesion.rol === 'sucursal' ? sesion.sucursal : TODAS_LAS_SUCURSALES)
        } else setSucursal(TODAS_LAS_SUCURSALES)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  useEffect(() => {
    cargarDemo()
  }, [cargarDemo])

  const usarPlanilla = useCallback((resultado: ResultadoImportacion, archivo: string) => {
    setDatos(resultado.datos)
    setAnio(anioDe(resultado.datos.meta.fechaCorte))
    setMes(resultado.ultimoMes)
    setSucursal(TODAS_LAS_SUCURSALES)
    setFuente({ tipo: 'planilla', archivo, filas: resultado.filasLeidas })
    setNotificaciones([])
  }, [])

  // Una persona de sucursal solo ve su sucursal: si estaba en "Todas", elige la primera.
  // Al volver a Auditoría o Gerencia, el filtro vuelve a "Todas".
  const setRol = useCallback(
    (nuevo: Rol) => {
      // Con Google el rol lo define la cuenta de la empresa: no se puede cambiar
      if (usuarioGoogle) return
      setRolInterno(nuevo)
      guardarSesion({ rol: nuevo, sucursal: nuevo === 'sucursal' ? (sucursal === TODAS_LAS_SUCURSALES ? (datos?.meta.sucursales[0]?.nombre ?? '') : sucursal) : TODAS_LAS_SUCURSALES })
      if (nuevo === 'sucursal' && sucursal === TODAS_LAS_SUCURSALES && datos) {
        setSucursal(datos.meta.sucursales[0].nombre)
      } else if (nuevo !== 'sucursal' && rol === 'sucursal') {
        setSucursal(TODAS_LAS_SUCURSALES)
      }
    },
    [sucursal, datos, rol, usuarioGoogle],
  )

  const iniciarSesion = useCallback(
    (nuevo: Rol, suc?: string) => {
      const sucursalElegida = nuevo === 'sucursal' ? (suc ?? datos?.meta.sucursales[0]?.nombre ?? TODAS_LAS_SUCURSALES) : TODAS_LAS_SUCURSALES
      setRolInterno(nuevo)
      setSucursal(sucursalElegida)
      setSesionDemo(true)
      guardarSesion({ rol: nuevo, sucursal: sucursalElegida })
    },
    [datos],
  )
  const cerrarSesion = useCallback(() => {
    setSesionDemo(false)
    guardarSesion(null)
    abrirLegajo(null)
  }, [])

  const sucursalActual: Sucursal | undefined = datos?.meta.sucursales.find((s) => s.nombre === sucursal)
  const usuario = usuarioGoogle
    ? usuarioGoogle.nombre
    : rol === 'sucursal' ? (sucursalActual?.personas[0] ?? 'Sucursal') : rol === 'auditoria' ? 'Carola B.' : 'Gerencia'
  const hoy = datos?.meta.fechaCorte ?? ''

  const actualizarComprobante = useCallback((id: string, cambios: Partial<Comprobante>) => {
    pendientesDeGuardar.current.add(id)
    setDatos((actual) =>
      actual
        ? { ...actual, comprobantes: actual.comprobantes.map((c) => (c.id === id ? { ...c, ...cambios } : c)) }
        : actual,
    )
  }, [])

  const agregarComprobante = useCallback((comprobante: Comprobante) => {
    pendientesDeGuardar.current.add(comprobante.id)
    setDatos((actual) => (actual ? { ...actual, comprobantes: [...actual.comprobantes, comprobante] } : actual))
  }, [])

  const actualizarAseguradoras = useCallback((aseguradoras: Aseguradora[]) => {
    setDatos((actual) => (actual ? { ...actual, aseguradoras } : actual))
  }, [])

  const registrarEvento = useCallback(
    (id: string, tipo: Evento['tipo'], texto: string) => {
      const area: AreaEvento = rol
      const evento: Evento = { fecha: hoy, autor: usuario, area, tipo, texto }
      // Cada movimiento le avisa al otro lado: lo de la sucursal a Auditoría y al revés
      const comprobante = datos?.comprobantes.find((c) => c.id === id)
      const avisos = comprobante ? crearNotificaciones(comprobante, evento) : []
      if (avisos.length) setNotificaciones((lista) => agruparGerencia([...avisos, ...lista]))
      pendientesDeGuardar.current.add(id)
      setDatos((actual) =>
        actual
          ? {
              ...actual,
              comprobantes: actual.comprobantes.map((c) => (c.id === id ? { ...c, eventos: [...c.eventos, evento] } : c)),
            }
          : actual,
      )
    },
    [rol, hoy, usuario, datos],
  )

  // Con Google, cada cambio se guarda en la planilla apenas se ve en pantalla
  useEffect(() => {
    if (fuente.tipo !== 'google' || !datos || pendientesDeGuardar.current.size === 0) return
    const ids = [...pendientesDeGuardar.current]
    pendientesDeGuardar.current.clear()
    const aGuardar = datos.comprobantes.filter((c) => ids.includes(c.id))
    setGuardado({ estado: 'guardando' })
    Promise.all(aGuardar.map(guardarEnGoogle))
      .then(() => setGuardado({ estado: 'ok' }))
      .catch((e: unknown) => {
        ids.forEach((id) => pendientesDeGuardar.current.add(id))
        setGuardado({ estado: 'error', mensaje: e instanceof Error ? e.message : String(e) })
      })
  }, [datos, fuente.tipo])

  const subirDocumento = useCallback(
    async (id: string, tipo: TipoDocumento | 'documentacion', archivo: File) =>
      fuente.tipo === 'google' ? subirAGoogle(id, tipo, archivo) : { archivo: archivo.name },
    [fuente.tipo],
  )

  const destinatario = rol === 'sucursal' ? sucursal : rol
  const misNotificaciones = useMemo(
    () => (destinatario ? notificaciones.filter((n) => n.para === destinatario) : []),
    [notificaciones, destinatario],
  )
  const marcarLeida = useCallback((nid: string) => {
    setNotificaciones((lista) => lista.map((n) => (n.id === nid ? { ...n, leida: true } : n)))
  }, [])
  const marcarTodasLeidas = useCallback(() => {
    setNotificaciones((lista) => lista.map((n) => (n.para === destinatario ? { ...n, leida: true } : n)))
  }, [destinatario])

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
      actualizarAseguradoras,
      registrarEvento,
      parametros,
      setParametros,
      fuente,
      guardado,
      subirDocumento,
      usarPlanilla,
      usarDemo: cargarDemo,
      sesionIniciada: usuarioGoogle !== null || sesionDemo,
      iniciarSesion,
      cerrarSesion,
      cuenta: usuarioGoogle,
      legajoAbierto,
      abrirLegajo,
      misNotificaciones,
      marcarLeida,
      marcarTodasLeidas,
    }),
    [
      datos,
      error,
      rol,
      setRol,
      sucursal,
      anio,
      mes,
      usuario,
      hoy,
      actualizarComprobante,
      agregarComprobante,
      actualizarAseguradoras,
      registrarEvento,
      parametros,
      fuente,
      guardado,
      subirDocumento,
      usarPlanilla,
      cargarDemo,
      sesionDemo,
      usuarioGoogle,
      iniciarSesion,
      cerrarSesion,
      legajoAbierto,
      misNotificaciones,
      marcarLeida,
      marcarTodasLeidas,
    ],
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
