/**
 * Marca y autoría, en un solo lugar: si cambia el nombre del estudio o sale una versión nueva,
 * se cambia acá y se actualiza en toda la aplicación (menú, ingreso, pie, manual).
 *
 * CobroSync es un producto de CBenvenuto, el estudio de Carola Benvenuto, que puede tener otros
 * productos más adelante.
 *
 * Versiones (MAYOR.MENOR.ARREGLO, ver changelog.md):
 * - MAYOR: un cambio grande en cómo se trabaja. 0 mientras dura el piloto; 1.0.0 es el lanzamiento
 *   en todas las sucursales.
 * - MENOR: algo nuevo que se suma (una pantalla, una función). Al subirlo, ARREGLO vuelve a 0.
 * - ARREGLO: un error corregido o un detalle.
 * Se sube en cada cambio que se publica, junto con su entrada en changelog.md.
 */
export const PRODUCTO = 'CobroSync'
/** Versión completa (pie, ingreso, manual) */
export const VERSION = '0.9.1'
/** Versión corta, al lado del logo: MAYOR.MENOR */
export const VERSION_CORTA = VERSION.split('.').slice(0, 2).join('.')
export const AUTORA = 'Carola Benvenuto'
export const ESTUDIO = 'CBenvenuto'
/** Firma corta y discreta, al lado de la versión (la plataforma es de SVA; la autoría completa va en el pie) */
export const FIRMA = 'by CB'
/** Línea de autoría completa (pie, ingreso, manual) */
export const AUTORIA = `${PRODUCTO} v${VERSION} · Diseño y desarrollo: ${AUTORA}`
export const ANIO = 2026
