/**
 * Utilidades de fechas sobre texto ISO "AAAA-MM-DD".
 * Trabajamos con texto (y no con objetos Date) para evitar errores de zona horaria:
 * un `new Date('2026-10-31')` en Argentina puede mostrarse como 30/10.
 */

const MS_POR_DIA = 86_400_000

export function anioDe(iso: string): number {
  return Number(iso.slice(0, 4))
}

export function mesDe(iso: string): number {
  return Number(iso.slice(5, 7))
}

export function diaDe(iso: string): number {
  return Number(iso.slice(8, 10))
}

/** Días entre dos fechas (positivo si `hasta` es posterior a `desde`). */
export function diffDias(desde: string, hasta: string): number {
  return Math.round((Date.parse(hasta) - Date.parse(desde)) / MS_POR_DIA)
}

export function sumarDias(iso: string, dias: number): string {
  return new Date(Date.parse(iso) + dias * MS_POR_DIA).toISOString().slice(0, 10)
}

export function enMes(iso: string | null, anio: number, mes: number): iso is string {
  return iso !== null && anioDe(iso) === anio && mesDe(iso) === mes
}

/** Semana 1 = días 1 a 7, semana 2 = días 8 a 14, etc. (igual que en la planilla). */
export function semanaDelMes(iso: string): number {
  return Math.ceil(diaDe(iso) / 7)
}

export function semanasDelMes(anio: number, mes: number): number {
  const diasDelMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
  return Math.ceil(diasDelMes / 7)
}
