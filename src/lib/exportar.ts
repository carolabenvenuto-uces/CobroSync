/**
 * Exportar tablas para abrir en Excel.
 *
 * Genera un CSV "a la argentina": separador punto y coma, coma decimal y
 * fechas dd/mm/aaaa, con BOM (﻿) para que Excel lea bien los acentos.
 * Se abre con doble clic en Excel sin pasos extra.
 */
export type Celda = string | number | null

function celda(valor: Celda): string {
  if (valor === null) return ''
  if (typeof valor === 'number') return String(Math.round(valor * 100) / 100).replace('.', ',')
  const texto = valor.replace(/"/g, '""')
  return /[;"\n\r]/.test(texto) ? `"${texto}"` : texto
}

/** "2026-10-31" → "31/10/2026" (para que Excel la tome como fecha) */
export function fechaExcel(iso: string | null): string | null {
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : null
}

export function descargarExcel(nombreArchivo: string, encabezados: string[], filas: Celda[][]): void {
  const lineas = [encabezados, ...filas].map((fila) => fila.map(celda).join(';'))
  const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `${nombreArchivo}.csv`
  enlace.click()
  URL.revokeObjectURL(url)
}
