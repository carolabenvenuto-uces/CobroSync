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
import {
  aplicarCambiosEnGoogle,
  cargarDesdeGoogle,
  conectadoAGoogle,
  guardarAjustesEnGoogle,
  marcarLeidasEnGoogle,
  obtenerCambiosDeGoogle,
  subirAGoogle,
  type Cambio,
  type UsuarioGoogle,
} from '../services/google'
import type { ResultadoImportacion } from '../services/planilla'
import { PARAMETROS_INICIALES, type ParametrosImpacto } from '../domain/impacto'
import { estadoReclamo, finDeEspera, NOMBRE_ESTADO_RECLAMO } from '../domain/reclamos'
import { configurarPlazos, plazosActuales, type Ajustes } from '../domain/plazos'
import { configurarTextos, textoAviso } from '../domain/textos'

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
  /** id de la compañía (los pedidos de apoyo se agrupan por compañía) */
  compania?: string
  /** facturas que junta un aviso agrupado */
  facturas?: string[]
  /** si está, al tocar el aviso se abre esta pantalla en vez de una factura */
  ruta?: string
}

/**
 * A Gerencia le llega un aviso por sucursal y por tipo, no uno por factura:
 * "Alvarez Thomas: 15 facturas pasaron a documentación crítica". Al tocarlo se abre la lista.
 */
export function agruparGerencia(lista: Notificacion[], nombresCompanias: Record<string, string> = {}): Notificacion[] {
  const grupos = new Map<string, Notificacion>()
  const resto: Notificacion[] = []
  for (const n of lista) {
    const agrupable = n.para === 'gerencia' && (n.clase === 'critica' ? !!n.sucursal : n.clase === 'escalar' && !!n.compania)
    if (!agrupable) {
      resto.push(n)
      continue
    }
    // Lo crítico se agrupa por sucursal; los pedidos de apoyo, por compañía
    const clave = n.clase === 'critica' ? `critica|${n.sucursal}` : `escalar|${n.compania}`
    const g = grupos.get(clave)
    const facturas = [...new Set([...(g?.facturas ?? []), ...(n.facturas ?? [n.comprobanteId])])]
    const fecha = g && g.fecha > n.fecha ? g.fecha : n.fecha
    const cant = facturas.length
    const compania = nombresCompanias[n.compania ?? ''] ?? 'una compañía'
    // Escrito como lo que Gerencia tiene que hacer (el texto se cambia en Ajustes)
    const texto =
      n.clase === 'critica'
        ? textoAviso('critica', { sucursal: n.sucursal, cantidad: cant, dias: plazosActuales().criticaComun })
        : textoAviso('apoyo', { compania, cantidad: cant })
    const ruta =
      n.clase === 'critica'
        ? `/app/pendientes?sucursal=${encodeURIComponent(n.sucursal ?? '')}&estado=Cr%C3%ADtica`
        : `/app/reclamos?compania=${encodeURIComponent(n.compania ?? '')}&estado=${encodeURIComponent(NOMBRE_ESTADO_RECLAMO.escalar)}`
    grupos.set(clave, {
      ...(g ?? n),
      // el id cambia cuando el grupo suma facturas: así vuelve a aparecer como no leído
      id: `g-${clave}-${fecha}-${cant}`,
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
function notificacionesIniciales(d: DatosApp, leidas: Set<string> = new Set()): Notificacion[] {
  // Los textos y plazos de estos datos (todavía no se guardaron en el estado)
  configurarPlazos(d.meta.plazos, d.aseguradoras)
  configurarTextos(d.meta.textos)
  const lista: Notificacion[] = []
  for (const c of d.comprobantes) {
    // Sin respuesta a 3 reclamos: Auditoría pide apoyo a Gerencia desde que terminó la espera
    if (estadoReclamo(c, d.meta.fechaCorte) === 'escalar') {
      const desde = finDeEspera(c) ?? d.meta.fechaCorte
      if (diffDias(desde, d.meta.fechaCorte) <= 14) {
        lista.push({ id: `${c.id}|apoyo|${desde}`, para: 'gerencia', clase: 'escalar', sucursal: c.sucursal, compania: c.aseguradoraId, fecha: desde, comprobanteId: c.id, leida: false, texto: '' })
      }
    }
    for (const e of c.eventos) {
      const dias = diffDias(e.fecha, d.meta.fechaCorte)
      for (const n of crearNotificaciones(c, e)) {
        if (dias <= (n.para === 'gerencia' ? 14 : 3)) lista.push(n)
      }
    }
  }
  // Hasta 40 por destinatario, las más nuevas primero
  const porDestinatario = new Map<string, number>()
  return conLeidas(agruparGerencia(lista, nombresDe(d)), leidas)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .filter((n) => {
      const cant = (porDestinatario.get(n.para) ?? 0) + 1
      porDestinatario.set(n.para, cant)
      return cant <= 40
    })
}

const nombresDe = (d: DatosApp | null | undefined): Record<string, string> =>
  Object.fromEntries((d?.aseguradoras ?? []).map((a) => [a.id, a.nombre]))

/** Marca como leídas las notificaciones que la persona ya leyó (en cualquier computadora). */
function conLeidas(lista: Notificacion[], leidas: Set<string>): Notificacion[] {
  return lista.map((n) => (leidas.has(n.id) ? { ...n, leida: true } : n))
}

/** Huella corta de un texto, para que cada notificación tenga siempre el mismo id. */
function huella(texto: string): string {
  let h = 5381
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/**
 * Cada movimiento le avisa al otro lado: lo de la sucursal a Auditoría y al revés.
 * A Gerencia le llegan solo los escalamientos: documentación crítica (más de 21 días)
 * y facturas vencidas con 3 reclamos sin respuesta.
 */
function crearNotificaciones(c: Comprobante, e: Evento): Notificacion[] {
  const numero = `${c.tipo} E ${c.puntoVenta}-${String(c.numero).padStart(8, '0')}`
  const id = `${c.id}|${e.fecha}|${e.tipo}|${huella(e.texto)}`
  const base = () => ({ id: `${id}|${lista.length}`, fecha: e.fecha, comprobanteId: c.id, leida: false })
  const lista: Notificacion[] = []
  if (e.area === 'sucursal') lista.push({ ...base(), para: 'auditoria', texto: `${c.sucursal} · ${numero}: ${e.texto}` })
  // A la sucursal le llega lo que le pide algo (observaciones, mensajes); las aprobaciones no,
  // porque ya se ven en la factura (pasa de "en revisión" a "aprobado")
  const esAprobacion = e.tipo === 'mensaje' && /^(Aprobado|Documentación revisada y aprobada)/.test(e.texto)
  if (e.area === 'auditoria' && e.tipo !== 'presentacion' && e.tipo !== 'reclamo' && !esAprobacion) {
    lista.push({ ...base(), para: c.sucursal, texto: `Auditoría · ${numero}: ${e.texto}` })
  }
  if (e.area === 'sistema') lista.push({ ...base(), para: c.sucursal, texto: `${numero}: ${e.texto}` })
  if (e.area === 'sistema' && /gerencia general/i.test(e.texto)) {
    lista.push({ ...base(), para: 'gerencia', clase: 'critica', sucursal: c.sucursal, texto: `Documentación crítica · ${c.sucursal} · ${numero}` })
  }
  // Los pedidos de apoyo a Gerencia no salen de un movimiento: salen del estado de la factura
  // (3 reclamos y pasó la semana sin respuesta). Ver notificacionesIniciales.
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
  /** Reemplaza facturas con la versión que devolvió el servidor (por ejemplo, al asignar un archivo del Drive) */
  recibirDelServidor: (lista: Comprobante[]) => void
  /** Ajustes (Auditoría): plazos, compañías que reciben FCE y avisos por mail */
  guardarAjustes: (ajustes: Ajustes) => Promise<void>
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
  // Los plazos se aplican antes de que cualquier pantalla calcule el semáforo
  configurarPlazos(datos?.meta.plazos, datos?.aseguradoras ?? [])
  configurarTextos(datos?.meta.textos)
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
  // Con Google: cambios que falta guardar, la última consulta al servidor y las notificaciones leídas
  const cola = useRef<Cambio[]>([])
  const enviando = useRef(false)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const marcaServidor = useRef('')
  const leidas = useRef(new Set<string>())
  const datosRef = useRef<DatosApp | null>(null)
  datosRef.current = datos

  const cargarDemo = useCallback(() => {
    // Abierta desde Google Apps Script: los datos y el rol vienen de la cuenta de la empresa
    if (conectadoAGoogle()) {
      cargarDesdeGoogle()
        .then(({ usuario: u, datos: d, ahora, leidas: yaLeidas }) => {
          marcaServidor.current = ahora
          leidas.current = new Set(yaLeidas)
          setDatos(d)
          setUsuarioGoogle(u)
          setRolInterno(u.rol)
          setSucursal(u.rol === 'sucursal' && u.sucursal ? u.sucursal : TODAS_LAS_SUCURSALES)
          setAnio(anioDe(d.meta.fechaCorte))
          setMes(mesDe(d.meta.fechaCorte))
          setFuente({ tipo: 'google', email: u.email })
          setNotificaciones(notificacionesIniciales(d, leidas.current))
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

  // ── Guardado en Google ──
  // Cada cambio se manda por separado (campos, documentos que cambiaron, mensaje nuevo) y el
  // servidor lo aplica sobre lo que hay guardado en ese momento: dos personas no se pisan.

  /** Reemplaza facturas con la versión del servidor (salvo las que tienen cambios sin guardar). */
  const aplicarDelServidor = useCallback((lista: Comprobante[], avisar: boolean) => {
    const previas = new Map((datosRef.current?.comprobantes ?? []).map((c) => [c.id, c]))
    const pendientes = new Set(cola.current.map((op) => op.id))
    const vigentes = lista.filter((c) => !pendientes.has(c.id))
    if (vigentes.length === 0) return
    if (avisar) {
      // Mensajes nuevos de otras personas → notificaciones
      const nuevas = vigentes.flatMap((c) => {
        const antes = previas.get(c.id)?.eventos.length ?? 0
        return c.eventos.slice(antes).flatMap((e) => crearNotificaciones(c, e))
      })
      if (nuevas.length) {
        setNotificaciones((l) => {
          const ids = new Set(l.map((n) => n.id))
          return conLeidas(agruparGerencia([...nuevas.filter((n) => !ids.has(n.id)), ...l], nombresDe(datosRef.current)), leidas.current)
        })
      }
    }
    const porId = new Map(vigentes.map((c) => [c.id, c]))
    setDatos((actual) => {
      if (!actual) return actual
      const existentes = new Set(actual.comprobantes.map((c) => c.id))
      return {
        ...actual,
        comprobantes: [
          ...actual.comprobantes.map((c) => porId.get(c.id) ?? c),
          ...vigentes.filter((c) => !existentes.has(c.id)),
        ],
      }
    })
  }, [])

  const enviarCambios = useCallback(() => {
    if (enviando.current || cola.current.length === 0) return
    const lote = cola.current.splice(0)
    enviando.current = true
    setGuardado({ estado: 'guardando' })
    aplicarCambiosEnGoogle(lote)
      .then((r) => {
        // Lo rechazado vuelve como está guardado (la pantalla vuelve atrás) y no traba lo demás
        aplicarDelServidor(r.comprobantes, false)
        if (r.errores?.length) setGuardado({ estado: 'error', mensaje: r.errores[0].mensaje })
        else setGuardado({ estado: cola.current.length ? 'guardando' : 'ok' })
      })
      .catch(() => {
        // Sin conexión o Google no respondió: se reintenta solo
        cola.current.unshift(...lote)
        setGuardado({ estado: 'error', mensaje: 'Sin conexión. Se reintenta solo en unos segundos; no cierres la página.' })
        temporizador.current = setTimeout(enviarCambios, 15_000)
      })
      .finally(() => {
        enviando.current = false
        if (cola.current.length) temporizador.current = setTimeout(enviarCambios, 300)
      })
  }, [aplicarDelServidor])

  const encolar = useCallback(
    (op: Cambio) => {
      if (!usuarioGoogle) return
      cola.current.push(op)
      if (temporizador.current) clearTimeout(temporizador.current)
      temporizador.current = setTimeout(enviarCambios, 300)
    },
    [usuarioGoogle, enviarCambios],
  )

  const actualizarComprobante = useCallback(
    (id: string, cambios: Partial<Comprobante>) => {
      const previo = datosRef.current?.comprobantes.find((c) => c.id === id)
      const { documentos, ...campos } = cambios
      // Solo los documentos que realmente cambiaron
      const docsCambiados = documentos?.filter((d) => JSON.stringify(d) !== JSON.stringify(previo?.documentos.find((x) => x.tipo === d.tipo)))
      encolar({
        id,
        campos: Object.keys(campos).length ? campos : undefined,
        documentos: docsCambiados?.length ? docsCambiados : undefined,
      })
      setDatos((actual) =>
        actual
          ? { ...actual, comprobantes: actual.comprobantes.map((c) => (c.id === id ? { ...c, ...cambios } : c)) }
          : actual,
      )
    },
    [encolar],
  )

  const agregarComprobante = useCallback(
    (comprobante: Comprobante) => {
      encolar({ id: comprobante.id, nuevo: comprobante })
      setDatos((actual) => (actual ? { ...actual, comprobantes: [...actual.comprobantes, comprobante] } : actual))
    },
    [encolar],
  )

  const recibirDelServidor = useCallback((lista: Comprobante[]) => aplicarDelServidor(lista, false), [aplicarDelServidor])

  const guardarAjustes = useCallback(async (a: Ajustes) => {
    if (conectadoAGoogle()) await guardarAjustesEnGoogle(a)
    const sinFce = new Set(a.companiasSinFce)
    // Las notificaciones de Gerencia se vuelven a escribir con los textos nuevos
    configurarTextos(a.textos)
    configurarPlazos(a.plazos, (datosRef.current?.aseguradoras ?? []).map((x) => ({ ...x, recibeFce: !sinFce.has(x.id) })))
    setNotificaciones((l) => agruparGerencia(l, nombresDe(datosRef.current)))
    setDatos((actual) =>
      actual
        ? {
            ...actual,
            // copia nueva de las facturas: así todas las pantallas recalculan con los plazos nuevos
            comprobantes: [...actual.comprobantes],
            aseguradoras: actual.aseguradoras.map((x) => ({ ...x, recibeFce: !sinFce.has(x.id) })),
            meta: { ...actual.meta, plazos: a.plazos, avisos: a.avisos, textos: a.textos },
          }
        : actual,
    )
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
      if (avisos.length) setNotificaciones((lista) => agruparGerencia([...avisos, ...lista], nombresDe(datos)))
      encolar({ id, evento: { tipo, texto } })
      setDatos((actual) =>
        actual
          ? {
              ...actual,
              comprobantes: actual.comprobantes.map((c) => (c.id === id ? { ...c, eventos: [...c.eventos, evento] } : c)),
            }
          : actual,
      )
    },
    [rol, hoy, usuario, datos, encolar],
  )

  // Con Google: cada minuto (y al volver a la pestaña) se traen los cambios de los demás
  useEffect(() => {
    if (!usuarioGoogle) return
    const consultar = () => {
      if (!marcaServidor.current) return
      obtenerCambiosDeGoogle(marcaServidor.current)
        .then((r) => {
          marcaServidor.current = r.ahora
          aplicarDelServidor(r.comprobantes, true)
          // Si la página quedó abierta de un día para otro, los días se cuentan desde hoy
          const hoyServidor = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(r.ahora))
          setDatos((d) => (d && d.meta.fechaCorte !== hoyServidor ? { ...d, meta: { ...d.meta, fechaCorte: hoyServidor } } : d))
        })
        .catch(() => {
          // sin conexión por un momento: se vuelve a intentar en la próxima consulta
        })
    }
    const intervalo = setInterval(() => {
      consultar()
      if (cola.current.length && !enviando.current) enviarCambios()
    }, 60_000)
    // Aviso si se cierra la página con cambios sin guardar
    const alSalir = (e: BeforeUnloadEvent) => {
      if (cola.current.length || enviando.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', alSalir)
    const alVolver = () => {
      if (document.visibilityState === 'visible') consultar()
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      clearInterval(intervalo)
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('beforeunload', alSalir)
    }
  }, [usuarioGoogle, aplicarDelServidor, enviarCambios])

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
  // Las leídas se guardan en la cuenta (con Google): valen en cualquier computadora o celular
  const recordarLeidas = useCallback(
    (ids: string[]) => {
      ids.forEach((id) => leidas.current.add(id))
      if (usuarioGoogle && ids.length) marcarLeidasEnGoogle(ids).catch(() => {})
    },
    [usuarioGoogle],
  )
  const marcarLeida = useCallback(
    (nid: string) => {
      recordarLeidas([nid])
      setNotificaciones((lista) => lista.map((n) => (n.id === nid ? { ...n, leida: true } : n)))
    },
    [recordarLeidas],
  )
  const marcarTodasLeidas = useCallback(() => {
    recordarLeidas(notificaciones.filter((n) => n.para === destinatario && !n.leida).map((n) => n.id))
    setNotificaciones((lista) => lista.map((n) => (n.para === destinatario ? { ...n, leida: true } : n)))
  }, [destinatario, notificaciones, recordarLeidas])

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
      guardarAjustes,
      recibirDelServidor,
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
      guardarAjustes,
      recibirDelServidor,
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
