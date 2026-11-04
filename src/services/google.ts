/**
 * Conexión con Google (etapa 2, prueba piloto).
 *
 * Cuando la aplicación se abre desde Google Apps Script (ver google/LEEME.md), existe
 * `google.script.run`: con eso se leen y guardan los datos en la planilla de Google y
 * los archivos en el Drive de la empresa (google/Codigo.gs).
 *
 * En la demo de GitHub Pages no existe: todo sigue funcionando en memoria, como hasta ahora.
 */
import type { Aseguradora, Comprobante, DatosApp, Documento, Evento, Rol, TipoDocumento } from '../domain/tipos'

export interface UsuarioGoogle {
  email: string
  nombre: string
  rol: Rol
  sucursal: string | null
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

export function cargarDesdeGoogle(): Promise<{ usuario: UsuarioGoogle; datos: DatosApp; ahora: string; leidas: string[] }> {
  return llamar('obtenerDatos')
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
  /** factura nueva completa (solo Auditoría) */
  nuevo?: Comprobante
}

export function aplicarCambiosEnGoogle(
  cambios: Cambio[],
): Promise<{ comprobantes: Comprobante[]; ahora: string; errores?: { id: string; mensaje: string }[] }> {
  return llamar('aplicarCambios', cambios)
}

/** Lo que cambiaron los demás desde la última consulta. */
export function obtenerCambiosDeGoogle(desde: string): Promise<{ comprobantes: Comprobante[]; ahora: string }> {
  return llamar('obtenerCambios', desde)
}

export function marcarLeidasEnGoogle(ids: string[]): Promise<boolean> {
  return llamar('marcarLeidas', ids)
}

export function agregarEnGoogle(lista: Comprobante[]): Promise<number> {
  return llamar('agregarComprobantes', lista)
}

export function sincronizarPlanillaEnGoogle(lista: Comprobante[]): Promise<{ nuevas: number; actualizadas: number }> {
  return llamar('sincronizarDesdePlanilla', lista)
}

/** Agrega compañías nuevas; con completarExistentes, también completa CUIT, razón social, plazo y correos. */
export function guardarAseguradorasEnGoogle(lista: Aseguradora[], completarExistentes = false): Promise<number> {
  return llamar('guardarAseguradoras', lista, completarExistentes)
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
