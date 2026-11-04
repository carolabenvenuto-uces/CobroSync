/**
 * Marca y autoría, en un solo lugar: si cambia el nombre del estudio o sale una versión nueva,
 * se cambia acá y se actualiza en toda la aplicación (menú, ingreso, pie, manual).
 *
 * CobroSync es un producto del estudio; el estudio es el de Carola Benvenuto y puede tener otros
 * productos más adelante.
 */
export const PRODUCTO = 'CobroSync'
/** Versión del producto que ven las personas. Subirla cuando se publiquen cambios importantes (1.1, 1.2… 2.0). */
export const VERSION = '1.0'
export const AUTORA = 'Carola Benvenuto'
export const ESTUDIO = 'Benvenuto Desarrollos'
/** Firma corta, debajo del logo */
export const FIRMA = `por ${AUTORA}`
/** Línea de autoría completa (pie, ingreso, manual) */
export const AUTORIA = `${PRODUCTO} ${VERSION} · un desarrollo de ${ESTUDIO} · ${AUTORA}`
export const ANIO = 2026
