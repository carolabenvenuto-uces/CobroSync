/**
 * Antes de subir: solo se aceptan PDF, porque las plataformas de las compañías no reciben fotos
 * ni otros formatos. Máximo 20 MB por archivo.
 * (Desde el celular: escanear con la cámara del teléfono o con Google Drive, que guardan en PDF.)
 */
export const MAXIMO_MB = 20

export function esPdf(archivo: File): boolean {
  return archivo.type === 'application/pdf' || /\.pdf$/i.test(archivo.name)
}

export async function prepararArchivo(archivo: File): Promise<File> {
  if (!esPdf(archivo)) {
    throw new Error(`"${archivo.name}" no es un PDF. Solo se aceptan PDF: las compañías no reciben fotos ni otros formatos. Hay que escanearlo como PDF.`)
  }
  if (archivo.size > MAXIMO_MB * 1024 * 1024) throw new Error(`"${archivo.name}" pesa más de ${MAXIMO_MB} MB. Conviene escanearlo con menos resolución.`)
  return archivo
}
