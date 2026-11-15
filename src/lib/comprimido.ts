/** Texto en base64 comprimido con gzip (lo que manda obtenerDatosComprimidos) → objeto. */
export async function descomprimirJson<T>(base64: string): Promise<T> {
  const binario = atob(base64)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  const flujo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return JSON.parse(await new Response(flujo).text()) as T
}
