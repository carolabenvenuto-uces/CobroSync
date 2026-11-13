/**
 * Ajustes es solo de la administradora (Carola): la cuenta cuyo correo está cargado como "correo de
 * soporte" en Ajustes. Mientras ese correo no está cargado, o fuera de la versión con Google,
 * cualquiera de Cobranzas puede entrar (para poder configurarlo la primera vez).
 */
import type { Rol } from './tipos'

export function esAdministradora(rol: Rol, emailCuenta: string | null | undefined, correoSoporte: string | null | undefined): boolean {
  if (rol !== 'auditoria') return false
  const soporte = (correoSoporte ?? '').trim().toLowerCase()
  if (!soporte || !emailCuenta) return true
  return emailCuenta.trim().toLowerCase() === soporte
}
