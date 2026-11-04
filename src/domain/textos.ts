/**
 * Textos de las notificaciones a Gerencia. Auditoría los puede cambiar en Ajustes; entre llaves van
 * los datos que completa CobroSync: {compania}, {sucursal}, {facturas} ("una factura" o "5 facturas")
 * y {dias} (desde cuántos días es crítica).
 */
export interface TextosAvisos {
  /** la compañía no respondió 3 reclamos: Auditoría pide apoyo */
  apoyo: string
  /** facturas que pasaron a críticas por falta de documentación */
  critica: string
}

export const TEXTOS_INICIALES: TextosAvisos = {
  apoyo: 'Auditoría solicita su apoyo con {compania}: la compañía no responde los reclamos de {facturas} vencidas.',
  critica: 'Auditoría marcó como críticas {facturas} de {sucursal}: la documentación está pendiente hace más de {dias} días. Se solicita su intervención para que la sucursal la regularice.',
}

export const DATOS_DE_TEXTO = ['{compania}', '{sucursal}', '{facturas}', '{dias}']

let actuales: TextosAvisos = TEXTOS_INICIALES

export function configurarTextos(textos: Partial<TextosAvisos> | undefined): void {
  actuales = {
    apoyo: textos?.apoyo?.trim() || TEXTOS_INICIALES.apoyo,
    critica: textos?.critica?.trim() || TEXTOS_INICIALES.critica,
  }
}

/** Arma el texto con los datos del aviso. */
export function armarTexto(
  plantilla: string,
  datos: { compania?: string; sucursal?: string; cantidad: number; dias?: number },
): string {
  const facturas = datos.cantidad === 1 ? 'una factura' : `${datos.cantidad} facturas`
  return plantilla
    .replaceAll('{compania}', datos.compania ?? 'la compañía')
    .replaceAll('{sucursal}', datos.sucursal ?? 'la sucursal')
    .replaceAll('{facturas}', facturas)
    .replaceAll('{dias}', String(datos.dias ?? ''))
}

export function textoAviso(tipo: keyof TextosAvisos, datos: Parameters<typeof armarTexto>[1]): string {
  return armarTexto(actuales[tipo], datos)
}
