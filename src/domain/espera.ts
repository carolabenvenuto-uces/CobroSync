import type { Comprobante, Documento, DocumentoEnEspera, Sucursal, TipoDocumento } from './tipos'

/** Puntos de venta y números de factura que aparecen en el nombre de un archivo ("35-11032"). */
export function numerosDelNombre(nombre: string): { puntoVenta: number; numero: number }[] {
  const base = nombre.replace(/\.[a-z0-9]+$/i, '')
  return [...base.matchAll(/(\d{1,5})\s*[-_ ]\s*0*(\d{1,8})/g)].map((m) => ({ puntoVenta: Number(m[1]), numero: Number(m[2]) }))
}

/** Todos los puntos de venta de una sucursal. */
export function puntosDeVenta(s: Pick<Sucursal, 'puntoVenta' | 'puntosVenta'>): number[] {
  return s.puntosVenta?.length ? s.puntosVenta : [s.puntoVenta]
}

/**
 * ¿Es el PDF de una factura de hoy (todavía no cargada)? Sí, si el nombre tiene un número con un
 * punto de venta de la sucursal y esa factura no existe todavía en la plataforma.
 */
export function facturaDeHoy(nombre: string, sucursal: Sucursal | undefined, todas: Comprobante[]): { puntoVenta: number; numero: number } | null {
  if (!sucursal) return null
  const pvs = puntosDeVenta(sucursal)
  for (const n of numerosDelNombre(nombre)) {
    if (!pvs.includes(n.puntoVenta)) continue
    if (todas.some((c) => c.puntoVenta === n.puntoVenta && c.numero === n.numero)) return null
    return n
  }
  return null
}

const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

/**
 * Al cargar el ERP: cada factura nueva toma los PDF en espera con su número (de su sucursal).
 * Devuelve las facturas ya con sus documentos (en revisión) y qué PDF se unieron a cuál.
 */
export function unirEnEspera(
  nuevas: Comprobante[],
  espera: DocumentoEnEspera[],
  hoy: string,
): { comprobantes: Comprobante[]; unidos: { id: string; comprobanteId: string }[] } {
  const unidos: { id: string; comprobanteId: string }[] = []
  const libres = espera.filter((e) => !e.asociado)
  const comprobantes = nuevas.map((c) => {
    if (c.tipo !== 'FC') return c
    const suyos = libres.filter((e) => e.puntoVenta === c.puntoVenta && e.numero === c.numero && normal(e.sucursal) === normal(c.sucursal))
    if (!suyos.length) return c
    const base: Documento[] = c.documentos.length ? c.documentos : (['factura', 'orden'] as TipoDocumento[]).map((t) => ({ tipo: t, estado: 'faltante' }))
    const documentos = base.map((d): Documento => {
      const deEste = suyos.filter((e) => e.tipo === d.tipo || e.tipo === 'documentacion')
      if (!deEste.length) return d
      return {
        tipo: d.tipo,
        estado: 'en_revision',
        archivo: deEste.length > 1 ? `${deEste[0].archivo} (+${deEste.length - 1})` : deEste[0].archivo,
        url: deEste[0].url,
        adjuntos: deEste.length > 1 ? deEste.map((e) => ({ archivo: e.archivo, url: e.url })) : undefined,
        subidoPor: deEste[0].subidoPor,
        fecha: deEste[0].fecha,
        origen: 'varios-automatico',
      }
    })
    suyos.forEach((e) => unidos.push({ id: e.id, comprobanteId: c.id }))
    const primera = [...suyos].sort((a, b) => a.fecha.localeCompare(b.fecha))[0]
    const siniestro = c.siniestro || suyos.find((e) => e.siniestro)?.siniestro || ''
    return {
      ...c,
      documentos,
      siniestro,
      fechaDrive: primera.fecha,
      subidoPor: primera.subidoPor,
      estado: c.estado === 'pendiente_drive' ? 'en_gestion' : c.estado,
      eventos: [
        ...c.eventos,
        {
          fecha: hoy,
          autor: primera.subidoPor,
          area: 'sucursal' as const,
          tipo: 'subida' as const,
          texto: `Subió ${suyos.length === 1 ? 'el PDF' : `${suyos.length} PDF`} antes de que se cargara la factura (${suyos.map((e) => e.nombreOriginal).join(', ')}); se unieron al cargar el ERP`,
        },
      ],
    }
  })
  return { comprobantes, unidos }
}

/** Días que lleva esperando un PDF: más de 2 suele ser un número mal tipeado. */
export const DIAS_ESPERA_REVISAR = 2
