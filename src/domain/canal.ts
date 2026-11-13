import type { Aseguradora, Comprobante } from './tipos'
import { separarLista } from '../lib/listas'

/** Por dónde va una factura: por mail, por la plataforma, o cualquiera de las dos (se elige al presentar). */
export type Via = 'mail' | 'portal' | 'ambas'

/** Comienzos de siniestro cargados en la ficha ("2, 30" → ["2", "30"]). */
export const prefijos = (texto: string | undefined) => separarLista(texto).map((p) => p.trim()).filter(Boolean)

const empiezaCon = (siniestro: string, lista: string[]) => {
  const s = siniestro.trim()
  return !!s && lista.some((p) => s.startsWith(p))
}

/**
 * La vía de una factura según cómo está definida su compañía en Ajustes → Compañías.
 * Si la compañía recibe por las dos, se mira cómo empieza el siniestro; si no coincide con
 * ninguna regla, quedan las dos opciones.
 */
export function viaDe(a: Aseguradora | undefined, c: Pick<Comprobante, 'siniestro'>): Via {
  if (!a || !a.canal || a.canal === 'mail') return 'mail'
  if (a.canal === 'portal') return 'portal'
  if (empiezaCon(c.siniestro ?? '', prefijos(a.siniestrosPorMail))) return 'mail'
  if (empiezaCon(c.siniestro ?? '', prefijos(a.siniestrosPorPlataforma))) return 'portal'
  return 'ambas'
}

export const NOMBRE_VIA: Record<Via, string> = { mail: 'Por mail', portal: 'Por su plataforma', ambas: 'Por mail o plataforma' }

/** Cómo se presenta la compañía, para mostrar en la tabla y en el Excel. */
export const nombreCanal = (a: Aseguradora | undefined) =>
  a?.canal === 'portal' ? 'Plataforma' : a?.canal === 'ambas' ? 'Mail y plataforma' : 'Mail'
