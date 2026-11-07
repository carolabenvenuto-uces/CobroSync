/**
 * Marca y autoría, en un solo lugar: si cambia el nombre del estudio o sale una versión nueva,
 * se cambia acá y se actualiza en toda la aplicación (menú, ingreso, pie, manual).
 *
 * CobroSync es un producto de CBenvenuto, el estudio de Carola Benvenuto, que puede tener otros
 * productos más adelante. Hasta el lanzamiento se mantiene la versión 1.0.
 */
export const PRODUCTO = 'CobroSync'
/** Versión del producto que ven las personas. Subirla cuando se publiquen cambios importantes (1.1, 1.2… 2.0). */
export const VERSION = '1.0'
export const AUTORA = 'Carola Benvenuto'
export const ESTUDIO = 'CBenvenuto'
/** Firma corta y discreta, al lado de la versión (la plataforma es de SVA; la autoría completa va en el pie) */
export const FIRMA = 'by CB'
/** Línea de autoría completa (pie, ingreso, manual) */
export const AUTORIA = `${PRODUCTO} v${VERSION} · Diseño y desarrollo: ${AUTORA}`
export const ANIO = 2026
