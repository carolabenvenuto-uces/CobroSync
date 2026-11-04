/**
 * Antes de subir: las fotos del celular (5 a 10 MB) se achican a un tamaño que se sigue leyendo
 * bien (lado mayor de 2000 px, JPEG al 82 %). Así se suben rápido aunque la señal sea mala.
 * Los PDF se suben como están, con un máximo de 20 MB.
 */
export const MAXIMO_MB = 20

export async function prepararArchivo(archivo: File): Promise<File> {
  if (!archivo.type.startsWith('image/') || archivo.type === 'image/gif') {
    if (archivo.size > MAXIMO_MB * 1024 * 1024) throw new Error(`"${archivo.name}" pesa más de ${MAXIMO_MB} MB. Escanealo con menos resolución.`)
    return archivo
  }
  if (archivo.size < 1.2 * 1024 * 1024) return archivo
  try {
    const imagen = await createImageBitmap(archivo)
    const escala = Math.min(1, 2000 / Math.max(imagen.width, imagen.height))
    const lienzo = document.createElement('canvas')
    lienzo.width = Math.round(imagen.width * escala)
    lienzo.height = Math.round(imagen.height * escala)
    lienzo.getContext('2d')?.drawImage(imagen, 0, 0, lienzo.width, lienzo.height)
    const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, 'image/jpeg', 0.82))
    if (!blob) return archivo
    return new File([blob], archivo.name.replace(/\.[a-z0-9]+$/i, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return archivo // si el navegador no puede procesarla, se sube como está
  }
}
