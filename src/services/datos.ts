/**
 * Único punto de acceso a los datos.
 *
 * Etapa 1 (ahora): lee los JSON ficticios de public/datos-demo/ con fetch().
 * Etapa 2: este archivo pasa a consultar Supabase. Las pantallas no se modifican,
 * porque solo conocen la función cargarDatos() y los tipos de domain/tipos.ts.
 */
import type { Aseguradora, CobroPrevisto, Comprobante, DatosApp, MetaDemo } from '../domain/tipos'

const CARPETA = `${import.meta.env.BASE_URL}datos-demo/`

async function leer<T>(archivo: string): Promise<T> {
  const respuesta = await fetch(CARPETA + archivo)
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
  return { aseguradoras, comprobantes, cobrosPrevistos, meta }
}
