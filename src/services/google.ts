/**
 * Conexión con Google (etapa 2, prueba piloto).
 *
 * Cuando la aplicación se abre desde Google Apps Script (ver google/LEEME.md), existe
 * `google.script.run`: con eso se leen y guardan los datos en la planilla de Google y
 * los archivos en el Drive de la empresa (google/Codigo.gs).
 *
 * En la demo de GitHub Pages no existe: todo sigue funcionando en memoria, como hasta ahora.
 */
import type { Aseguradora, Comprobante, DatosApp, Rol, TipoDocumento } from '../domain/tipos'

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

export function cargarDesdeGoogle(): Promise<{ usuario: UsuarioGoogle; datos: DatosApp }> {
  return llamar('obtenerDatos')
}

export function guardarEnGoogle(c: Comprobante): Promise<boolean> {
  return llamar('guardarComprobante', c)
}

export function agregarEnGoogle(lista: Comprobante[]): Promise<number> {
  return llamar('agregarComprobantes', lista)
}

export function sincronizarPlanillaEnGoogle(lista: Comprobante[]): Promise<{ nuevas: number; actualizadas: number }> {
  return llamar('sincronizarDesdePlanilla', lista)
}

export function guardarAseguradorasEnGoogle(lista: Aseguradora[]): Promise<number> {
  return llamar('guardarAseguradoras', lista)
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
