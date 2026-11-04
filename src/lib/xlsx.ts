/**
 * Lector mínimo de Excel (.xlsx), sin librerías: así se puede cargar el Excel tal cual sale del
 * ERP o de Google Sheets, sin guardarlo antes como CSV.
 *
 * Un .xlsx es un ZIP con XML adentro. Se lee la primera hoja (o la que se pida por nombre) y se
 * devuelve como texto CSV "a la argentina" (punto y coma, coma decimal, fechas dd/mm/aaaa), que es
 * lo que ya entienden los importadores de la planilla y del ERP.
 */

interface EntradaZip {
  nombre: string
  metodo: number
  inicio: number
  tamanoComprimido: number
}

function leerZip(bytes: Uint8Array): Map<string, EntradaZip> {
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  // Fin del directorio central: firma 0x06054b50 cerca del final
  let fin = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--) {
    if (vista.getUint32(i, true) === 0x06054b50) {
      fin = i
      break
    }
  }
  if (fin < 0) throw new Error('El archivo no parece un Excel (.xlsx).')
  const cantidad = vista.getUint16(fin + 10, true)
  let p = vista.getUint32(fin + 16, true)
  const entradas = new Map<string, EntradaZip>()
  const decoder = new TextDecoder()
  for (let n = 0; n < cantidad; n++) {
    if (vista.getUint32(p, true) !== 0x02014b50) break
    const metodo = vista.getUint16(p + 10, true)
    const tamanoComprimido = vista.getUint32(p + 20, true)
    const largoNombre = vista.getUint16(p + 28, true)
    const largoExtra = vista.getUint16(p + 30, true)
    const largoComentario = vista.getUint16(p + 32, true)
    const local = vista.getUint32(p + 42, true)
    const nombre = decoder.decode(bytes.subarray(p + 46, p + 46 + largoNombre))
    const inicio = local + 30 + vista.getUint16(local + 26, true) + vista.getUint16(local + 28, true)
    entradas.set(nombre, { nombre, metodo, inicio, tamanoComprimido })
    p += 46 + largoNombre + largoExtra + largoComentario
  }
  return entradas
}

async function leerEntrada(bytes: Uint8Array, e: EntradaZip | undefined): Promise<string> {
  if (!e) return ''
  const datos = bytes.subarray(e.inicio, e.inicio + e.tamanoComprimido)
  if (e.metodo === 0) return new TextDecoder().decode(datos)
  const flujo = new Blob([datos.slice() as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Response(flujo).text()
}

const xml = (texto: string) => new DOMParser().parseFromString(texto, 'application/xml')

/** Formatos de número que son fechas (los de Excel por defecto y los personalizados con d/m/y). */
function formatosDeFecha(estilos: Document): Set<number> {
  const fecha = new Set([14, 15, 16, 17, 22, 27, 30, 36, 45, 46, 47, 50, 57])
  for (const f of Array.from(estilos.getElementsByTagName('numFmt'))) {
    const codigo = (f.getAttribute('formatCode') ?? '').toLowerCase().replace(/"[^"]*"|\[[^\]]*\]/g, '')
    if (/[dmy]/.test(codigo) && !/^[#0.,% ]+$/.test(codigo)) fecha.add(Number(f.getAttribute('numFmtId')))
  }
  const estilosDeFecha = new Set<number>()
  const xfs = estilos.getElementsByTagName('cellXfs')[0]
  Array.from(xfs?.getElementsByTagName('xf') ?? []).forEach((xf, i) => {
    if (fecha.has(Number(xf.getAttribute('numFmtId')))) estilosDeFecha.add(i)
  })
  return estilosDeFecha
}

function serialAFecha(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400000)
  const d = new Date(ms)
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getUTCFullYear()}`
}

function columna(ref: string): number {
  let n = 0
  for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

const celdaCsv = (v: string) => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

/** Lee un .xlsx y devuelve su contenido como CSV (separado por punto y coma). */
export async function xlsxACsv(archivo: File, hoja?: RegExp): Promise<string> {
  const bytes = new Uint8Array(await archivo.arrayBuffer())
  const zip = leerZip(bytes)
  const libro = xml(await leerEntrada(bytes, zip.get('xl/workbook.xml')))
  const relaciones = xml(await leerEntrada(bytes, zip.get('xl/_rels/workbook.xml.rels')))
  const hojas = Array.from(libro.getElementsByTagName('sheet'))
  const elegida = (hoja && hojas.find((h) => hoja.test(h.getAttribute('name') ?? ''))) || hojas[0]
  if (!elegida) throw new Error('El Excel no tiene hojas.')
  const rid = elegida.getAttribute('r:id') ?? elegida.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
  const destino = Array.from(relaciones.getElementsByTagName('Relationship')).find((r) => r.getAttribute('Id') === rid)?.getAttribute('Target') ?? 'worksheets/sheet1.xml'
  const ruta = destino.startsWith('/') ? destino.slice(1) : `xl/${destino}`

  const compartidos = Array.from(xml(await leerEntrada(bytes, zip.get('xl/sharedStrings.xml'))).getElementsByTagName('si')).map((si) =>
    Array.from(si.getElementsByTagName('t'))
      .map((t) => t.textContent ?? '')
      .join(''),
  )
  const deFecha = formatosDeFecha(xml(await leerEntrada(bytes, zip.get('xl/styles.xml'))))
  const hojaXml = xml(await leerEntrada(bytes, zip.get(ruta)))

  const filas: string[] = []
  for (const fila of Array.from(hojaXml.getElementsByTagName('row'))) {
    const valores: string[] = []
    for (const c of Array.from(fila.getElementsByTagName('c'))) {
      const i = columna(c.getAttribute('r') ?? 'A1')
      const tipo = c.getAttribute('t')
      const v = c.getElementsByTagName('v')[0]?.textContent ?? ''
      let texto: string
      if (tipo === 's') texto = compartidos[Number(v)] ?? ''
      else if (tipo === 'inlineStr') texto = c.getElementsByTagName('t')[0]?.textContent ?? ''
      else if (tipo === 'b') texto = v === '1' ? 'VERDADERO' : 'FALSO'
      else if (tipo === 'str' || tipo === 'e') texto = v
      else if (v !== '' && deFecha.has(Number(c.getAttribute('s') ?? -1))) texto = serialAFecha(Number(v))
      else texto = v === '' ? '' : String(Math.round(Number(v) * 100) / 100).replace('.', ',')
      valores[i] = texto
    }
    filas.push(Array.from(valores, (x) => celdaCsv(x ?? '')).join(';'))
  }
  return filas.join('\n')
}
