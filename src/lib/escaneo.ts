/**
 * Fotos del celular → PDF, todo en el navegador (sin servicios externos).
 *
 * Para que la foto se lea como un escaneo:
 * 1. Se empareja la luz: se divide cada píxel por el fondo (la misma foto muy achicada y vuelta a
 *    agrandar, que queda borrosa). Así desaparecen las sombras y el papel queda parejo.
 * 2. Se estiran los niveles: el papel pasa a blanco y la tinta a casi negro.
 * 3. Se elige cómo queda: original (sin cambios), mejorada (lo anterior, sin exagerar los colores) o
 *    blanco y negro (grises con más contraste, más nítido para texto).
 * La imagen se guarda como JPEG y cada foto es una página A4 del PDF.
 */

export interface Pagina {
  jpeg: Uint8Array
  ancho: number
  alto: number
}

const LADO_MAXIMO = 2000

async function cargar(archivo: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  try {
    // respeta la orientación de la foto (EXIF)
    return await createImageBitmap(archivo, { imageOrientation: 'from-image' })
  } catch {
    const url = URL.createObjectURL(archivo)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return img
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

function lienzo(ancho: number, alto: number) {
  const c = document.createElement('canvas')
  c.width = ancho
  c.height = alto
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('El navegador no permite procesar la imagen')
  return { c, ctx }
}

/** Mejora una foto y la devuelve como página (rotacion en múltiplos de 90°). */
export type ModoFoto = 'original' | 'mejorada' | 'byn'

export async function procesarFoto(archivo: Blob, opciones: { modo: ModoFoto; rotacion: number }): Promise<Pagina> {
  const img = await cargar(archivo)
  const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height))
  const w0 = Math.round(img.width * escala)
  const h0 = Math.round(img.height * escala)
  const giro = ((opciones.rotacion % 360) + 360) % 360
  const [w, h] = giro === 90 || giro === 270 ? [h0, w0] : [w0, h0]

  const { c, ctx } = lienzo(w, h)
  ctx.translate(w / 2, h / 2)
  ctx.rotate((giro * Math.PI) / 180)
  ctx.drawImage(img, -w0 / 2, -h0 / 2, w0, h0)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  if (opciones.modo === 'original') return aPagina(c, w, h)
  const blancoYNegro = opciones.modo === 'byn'

  // Fondo: la foto achicada en dos pasos (queda borrosa) y vuelta a agrandar
  const chico1 = lienzo(Math.max(1, Math.round(w / 8)), Math.max(1, Math.round(h / 8)))
  chico1.ctx.imageSmoothingQuality = 'high'
  chico1.ctx.drawImage(c, 0, 0, chico1.c.width, chico1.c.height)
  const chico2 = lienzo(Math.max(1, Math.round(w / 40)), Math.max(1, Math.round(h / 40)))
  chico2.ctx.imageSmoothingQuality = 'high'
  chico2.ctx.drawImage(chico1.c, 0, 0, chico2.c.width, chico2.c.height)
  const fondo = lienzo(w, h)
  fondo.ctx.imageSmoothingQuality = 'high'
  fondo.ctx.drawImage(chico2.c, 0, 0, w, h)

  const datos = ctx.getImageData(0, 0, w, h)
  const p = datos.data
  const f = fondo.ctx.getImageData(0, 0, w, h).data

  // 1. Luz pareja: píxel / fondo
  const hist = new Uint32Array(256)
  for (let i = 0; i < p.length; i += 4) {
    for (let k = 0; k < 3; k++) {
      const b = Math.max(f[i + k], 40)
      p[i + k] = Math.min(255, (p[i + k] / b) * 235)
    }
    hist[(p[i] * 77 + p[i + 1] * 150 + p[i + 2] * 29) >> 8]++
  }
  // 2. Niveles: del 1 % más oscuro al 92 % (el papel) → 0..255
  const total = w * h
  let acum = 0
  let bajo = 0
  let alto = 255
  for (let v = 0; v < 256; v++) {
    acum += hist[v]
    if (acum < total * 0.01) bajo = v
    if (acum < total * 0.96) alto = v
  }
  if (alto - bajo < 40) alto = Math.min(255, bajo + 40)
  const tabla = new Uint8ClampedArray(256)
  for (let v = 0; v < 256; v++) {
    const x = Math.min(1, Math.max(0, (v - bajo) / (alto - bajo)))
    // un poco más de contraste en los tonos medios (la letra se ve más firme)
    tabla[v] = Math.round(255 * (blancoYNegro ? Math.pow(x, 1.5) : Math.pow(x, 1.1)))
  }
  for (let i = 0; i < p.length; i += 4) {
    const l = (p[i] * 77 + p[i + 1] * 150 + p[i + 2] * 29) >> 8
    if (blancoYNegro) {
      p[i] = p[i + 1] = p[i + 2] = tabla[l]
    } else {
      // se ajusta el brillo sin exagerar los colores: misma proporción entre canales y un poco menos de color
      const k = l ? tabla[l] / l : 1
      const g = tabla[l]
      p[i] = Math.min(255, (p[i] * k) * 0.8 + g * 0.2)
      p[i + 1] = Math.min(255, (p[i + 1] * k) * 0.8 + g * 0.2)
      p[i + 2] = Math.min(255, (p[i + 2] * k) * 0.8 + g * 0.2)
    }
  }
  ctx.putImageData(datos, 0, 0)
  return aPagina(c, w, h)
}

async function aPagina(c: HTMLCanvasElement, w: number, h: number): Promise<Pagina> {
  const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', 0.85))
  if (!blob) throw new Error('No se pudo convertir la foto')
  return { jpeg: new Uint8Array(await blob.arrayBuffer()), ancho: w, alto: h }
}

/** Arma un PDF con una página A4 por foto (la imagen ocupa la hoja, sin deformarse). */
export function armarPdf(paginas: Pagina[]): Blob {
  const enc = new TextEncoder()
  const partes: Uint8Array[] = []
  const offsets: number[] = []
  let largo = 0
  const escribir = (x: string | Uint8Array) => {
    const b = typeof x === 'string' ? enc.encode(x) : x
    partes.push(b)
    largo += b.length
  }
  const objeto = (n: number, cuerpo: () => void) => {
    offsets[n] = largo
    escribir(`${n} 0 obj\n`)
    cuerpo()
    escribir('\nendobj\n')
  }

  escribir('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')
  const A4 = { w: 595.28, h: 841.89 }
  const n = paginas.length
  // 1 catálogo, 2 páginas, y por cada página: página, contenido, imagen
  const idPagina = (i: number) => 3 + i * 3
  objeto(1, () => escribir('<< /Type /Catalog /Pages 2 0 R >>'))
  objeto(2, () => escribir(`<< /Type /Pages /Count ${n} /Kids [${paginas.map((_, i) => `${idPagina(i)} 0 R`).join(' ')}] >>`))
  paginas.forEach((pg, i) => {
    const id = idPagina(i)
    const horizontal = pg.ancho > pg.alto
    const hoja = horizontal ? { w: A4.h, h: A4.w } : A4
    const esc = Math.min(hoja.w / pg.ancho, hoja.h / pg.alto)
    const dw = pg.ancho * esc
    const dh = pg.alto * esc
    const x = (hoja.w - dw) / 2
    const y = (hoja.h - dh) / 2
    const contenido = `q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im${i} Do Q`
    objeto(id, () =>
      escribir(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${hoja.w} ${hoja.h}] /Resources << /XObject << /Im${i} ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`),
    )
    objeto(id + 1, () => escribir(`<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`))
    objeto(id + 2, () => {
      escribir(`<< /Type /XObject /Subtype /Image /Width ${pg.ancho} /Height ${pg.alto} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.jpeg.length} >>\nstream\n`)
      escribir(pg.jpeg)
      escribir('\nendstream')
    })
  })
  const xref = largo
  const cantidad = 3 + n * 3
  let tablaXref = `xref\n0 ${cantidad}\n0000000000 65535 f \n`
  for (let i = 1; i < cantidad; i++) tablaXref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  escribir(tablaXref)
  escribir(`trailer\n<< /Size ${cantidad} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`)
  return new Blob(partes as BlobPart[], { type: 'application/pdf' })
}
