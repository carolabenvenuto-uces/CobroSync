import type { Comprobante } from '../domain/tipos'

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

/** $ 1.234.567 */
export function formatoPesos(valor: number): string {
  return pesos.format(valor)
}

/** $ 9,2 M — para tarjetas y ejes de gráficos (con espacios que no cortan línea) */
export function formatoPesosCorto(valor: number): string {
  const absoluto = Math.abs(valor)
  if (absoluto < 1_000_000) return formatoPesos(valor)
  const millones = (absoluto / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })
  return `${valor < 0 ? '-' : ''}$\u00a0${millones}\u00a0M`
}

/** "2026-10-31" → "31/10/26" */
export function formatoFecha(iso: string | null): string {
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : '—'
}

/** FC E 35-00004570 (mismo formato que la planilla de control) */
export function formatoComprobante(c: Pick<Comprobante, 'tipo' | 'puntoVenta' | 'numero'>): string {
  return `${c.tipo} E ${c.puntoVenta}-${String(c.numero).padStart(8, '0')}`
}

export const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]
