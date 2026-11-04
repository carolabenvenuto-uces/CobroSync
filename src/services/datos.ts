/**
 * Único punto de acceso a los datos.
 *
 * Demo (GitHub Pages): lee los JSON de ejemplo de public/datos-demo/ con fetch().
 * Prueba piloto (Google): los datos vienen de services/google.ts. Las pantallas no cambian,
 * porque solo conocen el contexto de la aplicación y los tipos de domain/tipos.ts.
 */
import type { Aseguradora, CobroPrevisto, Comprobante, DatosApp, MetaDemo } from '../domain/tipos'

const CARPETA = `${import.meta.env.BASE_URL}datos-demo/`

async function leer<T>(archivo: string): Promise<T> {
  // no-cache: el navegador siempre consulta si hay una versión nueva del archivo.
  // Sin esto, después de publicar podía combinar el código nuevo con datos viejos guardados.
  const respuesta = await fetch(CARPETA + archivo, { cache: 'no-cache' })
  if (!respuesta.ok) throw new Error(`No se pudo leer ${archivo} (error ${respuesta.status})`)
  return (await respuesta.json()) as T
}

export async function cargarDatos(): Promise<DatosApp> {
  const [aseguradoras, comprobantes, cobrosPrevistos, meta] = await Promise.all([
    leer<Aseguradora[]>('aseguradoras.json'),
    leer<Comprobante[]>('comprobantes.json'),
    leer<CobroPrevisto[]>('cobros-previstos.json'),
    leer<MetaDemo>('meta.json'),
  ])
  return { aseguradoras, comprobantes: comprobantes.map(normalizar), cobrosPrevistos, meta }
}

/** Completa los campos que un archivo de una versión anterior podría no tener. */
function normalizar(c: Comprobante): Comprobante {
  return {
    ...c,
    reclamos: c.reclamos ?? [],
    eventos: c.eventos ?? [],
    documentos: c.documentos ?? [],
    compromiso: c.compromiso ?? null,
  }
}
