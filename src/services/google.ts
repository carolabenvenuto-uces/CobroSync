/**
 * Conexión con Google (etapa 2, prueba piloto).
 *
 * Cuando la aplicación se abre desde Google Apps Script (ver google/LEEME.md), existe
 * `google.script.run`: con eso se leen y guardan los datos en la planilla de Google y
 * los archivos en el Drive de la empresa (google/Codigo.gs).
 *
 * En la demo de GitHub Pages no existe: todo sigue funcionando en memoria, como hasta ahora.
 */
import type { Ajustes } from '../domain/plazos'
import type { Aseguradora, Comprobante, DatosApp, Documento, DocumentoEnEspera, Evento, Rol, TipoDocumento } from '../domain/tipos'

export interface UsuarioGoogle {
  email: string
  nombre: string
  rol: Rol
  sucursal: string | null
  /** Cobranzas que además escanea la documentación de una sucursal (la suya) */
  sucursalPropia?: string | null
}

type Corredor = Record<string, (...args: unknown[]) => void> & {
  withSuccessHandler: (fn: (r: unknown) => void) => Corredor
  withFailureHandler: (fn: (e: Error) => void) => Corredor
}

function corredor(): Corredor | null {
  const g = (globalThis as { google?: { script?: { run?: Corredor } } }).google
  return g?.script?.run ?? null
}

/** ¿La aplicación está corriendo dentro de Google Apps Script? */
export const conectadoAGoogle = (): boolean => corredor() !== null

/** Llama a una función de google/Codigo.gs y espera la respuesta. */
function llamar<T>(funcion: string, ...args: unknown[]): Promise<T> {
  const run = corredor()
  if (!run) return Promise.reject(new Error('No hay conexión con Google.'))
  return new Promise<T>((resolver, rechazar) => {
    run
      .withSuccessHandler((r) => resolver(r as T))
      .withFailureHandler((e) => rechazar(e))
      [funcion](...args)
  })
}

/**
 * Completa lo que puede llegar vacío desde Google: al pasar los datos a la página, Google puede
 * omitir los campos sin valor, y el resto del código espera null o una lista vacía.
 */
export function completarComprobante(c: Comprobante): Comprobante {
  return {
    ...c,
    siniestro: c.siniestro ?? '',
    patente: c.patente ?? '',
    observaciones: c.observaciones ?? '',
    fechaDrive: c.fechaDrive ?? null,
    subidoPor: c.subidoPor ?? null,
    fechaPresentacion: c.fechaPresentacion ?? null,
    vencimiento: c.vencimiento ?? null,
    fechaCobro: c.fechaCobro ?? null,
    ncReferencia: c.ncReferencia ?? null,
    ncInformada: c.ncInformada ?? null,
    compromiso: c.compromiso ?? null,
    anulacionInformada: c.anulacionInformada ?? null,
    reclamos: Array.isArray(c.reclamos) ? c.reclamos.filter(Boolean) : [],
    documentos: Array.isArray(c.documentos) ? c.documentos.filter(Boolean) : [],
    eventos: Array.isArray(c.eventos) ? c.eventos.filter(Boolean) : [],
    pedidos: Array.isArray(c.pedidos) ? c.pedidos.filter(Boolean) : c.pedidos,
  }
}

export async function cargarDesdeGoogle(): Promise<{ usuario: UsuarioGoogle; datos: DatosApp; ahora: string; leidas: string[] }> {
  const r = await llamar<{ usuario: UsuarioGoogle; datos: DatosApp; ahora: string; leidas: string[] }>('obtenerDatos')
  return { ...r, datos: { ...r.datos, comprobantes: (r.datos.comprobantes ?? []).map(completarComprobante) } }
}

/**
 * Un cambio sobre una factura. Se guarda sobre lo que hay en ese momento en Google, así dos
 * personas trabajando en la misma factura no se pisan.
 */
export interface Cambio {
  id: string
  campos?: Partial<Comprobante>
  /** solo los documentos que cambiaron */
  documentos?: Documento[]
  /** mensaje nuevo para la conversación (lo firma el servidor) */
  evento?: Pick<Evento, 'tipo' | 'texto'>
  /** factura nueva completa (solo Cobranzas) */
  nuevo?: Comprobante
}

export function aplicarCambiosEnGoogle(
  cambios: Cambio[],
): Promise<{ comprobantes: Comprobante[]; ahora: string; errores?: { id: string; mensaje: string }[] }> {
  return llamar('aplicarCambios', cambios)
}

/** Lo que cambiaron los demás desde la última consulta. */
export async function obtenerCambiosDeGoogle(desde: string): Promise<{ comprobantes: Comprobante[]; ahora: string }> {
  const r = await llamar<{ comprobantes: Comprobante[]; ahora: string }>('obtenerCambios', desde)
  return { ...r, comprobantes: (r.comprobantes ?? []).map(completarComprobante) }
}

export function marcarLeidasEnGoogle(ids: string[]): Promise<boolean> {
  return llamar('marcarLeidas', ids)
}

export function agregarEnGoogle(lista: Comprobante[]): Promise<number> {
  return llamar('agregarComprobantes', lista)
}

export function sincronizarPlanillaEnGoogle(lista: Comprobante[]): Promise<{ nuevas: number; actualizadas: number; omitidas?: number }> {
  return llamar('sincronizarDesdePlanilla', lista)
}

/** Completa ya mismo Drive, Presentación, Cobro y Estado en la hoja Diario de la planilla de control. */
/** Lee ahora la hoja Diario de la planilla de control (lo mismo que se hace solo cada hora). */
export function traerDeMiPlanillaEnGoogle(): Promise<{ nuevas: number; actualizadas: number; omitidas?: number }> {
  return llamar('traerDeMiPlanilla')
}

export function actualizarPlanillaEnGoogle(): Promise<{ completadas: number; ahora: string }> {
  return llamar('actualizarMiPlanilla')
}

/** Guarda los ajustes en la pestaña Config (plazos y avisos) y en Aseguradoras (recibe FCE). Solo Cobranzas. */
/** Los documentos de varias facturas en un .zip (para presentarlas a la compañía). */
export function descargarDocumentosDeGoogle(ids: string[], nombre: string): Promise<{ nombre: string; base64: string; cantidad: number; faltan: number }> {
  return llamar('descargarDocumentos', ids, nombre)
}

/** Reporte de un problema técnico: le llega por mail solo a la desarrolladora. */
export function reportarProblemaEnGoogle(texto: string, contexto: { pantalla: string; navegador: string }): Promise<boolean> {
  return llamar('reportarProblema', texto, contexto)
}

export function guardarAjustesEnGoogle(ajustes: Ajustes): Promise<boolean> {
  return llamar('guardarAjustes', ajustes)
}

/** Agrega al final de la pestaña Quiter de la planilla de control las filas del ERP que no estén. */
export function agregarAQuiterEnGoogle(filas: string[][]): Promise<{ configurada: boolean; agregadas: number; completadas?: number }> {
  return llamar('agregarAQuiter', filas)
}

/** Agrega compañías nuevas; con completarExistentes, también completa CUIT, razón social, plazo y correos. */
/** exacto: desde la pantalla Compañías, se guarda tal cual lo que se manda (también vacío) */
export function guardarAseguradorasEnGoogle(lista: Aseguradora[], completarExistentes = false, exacto = false): Promise<number> {
  return llamar('guardarAseguradoras', lista, completarExistentes, exacto)
}

/** Sube un PDF o una foto al Drive de la empresa, en la carpeta de la factura. */
export async function subirAGoogle(comprobanteId: string, tipo: TipoDocumento | 'documentacion', archivo: File) {
  const base64 = await new Promise<string>((resolver, rechazar) => {
    const lector = new FileReader()
    lector.onload = () => resolver(String(lector.result).split(',')[1] ?? '')
    lector.onerror = () => rechazar(lector.error)
    lector.readAsDataURL(archivo)
  })
  return llamar<{ archivo: string; url: string }>('subirArchivo', comprobanteId, tipo, archivo.name, archivo.type || 'application/pdf', base64)
}

/** PDF de una factura de hoy (todavía no cargada): queda en espera hasta que se cargue el ERP. */
export async function subirEnEsperaEnGoogle(puntoVenta: number, numero: number, tipo: string, siniestro: string, archivo: File) {
  const base64 = await new Promise<string>((resolver, rechazar) => {
    const lector = new FileReader()
    lector.onload = () => resolver(String(lector.result).split(',')[1] ?? '')
    lector.onerror = () => rechazar(lector.error)
    lector.readAsDataURL(archivo)
  })
  return llamar<DocumentoEnEspera>('subirEnEspera', puntoVenta, numero, tipo, siniestro, archivo.name, archivo.type || 'application/pdf', base64)
}

export function marcarEsperaAsociadaEnGoogle(pares: { id: string; comprobanteId: string }[]): Promise<number> {
  return llamar<number>('marcarEsperaAsociada', pares)
}

export function descartarEsperaEnGoogle(id: string): Promise<boolean> {
  return llamar<boolean>('descartarEspera', id)
}
