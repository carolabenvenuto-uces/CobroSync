/**
 * Exportar tablas para abrir en Excel.
 *
 * Genera un Excel de verdad (.xlsx), sin librerías: cada dato en su columna, los importes como
 * números (se pueden sumar), las fechas como fechas, la primera fila en negrita y fija, con filtro.
 * Antes era un CSV con punto y coma, que en las computadoras con Excel configurado con coma quedaba
 * todo pegado en una sola celda.
 *
 * Un .xlsx es un ZIP con unos XML adentro; acá se arma el ZIP "sin comprimir" (alcanza y es simple).
 */
export type Celda = string | number | null

/** "2026-10-31" → "31/10/2026": se exporta como fecha de Excel */
export function fechaExcel(iso: string | null): string | null {
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : null
}

const FECHA = /^(\d{2})\/(\d{2})\/(\d{4})$/

/** Número de serie de Excel para una fecha dd/mm/aaaa (días desde el 30/12/1899). */
function serieFecha(texto: string): number | null {
  const m = texto.match(FECHA)
  if (!m) return null
  const ms = Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
  return Math.round(ms / 86400000) + 25569
}

const escapar = (t: string) =>
  t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // caracteres de control que el XML no acepta
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')

/** A1, B1 … Z1, AA1 */
function columna(i: number): string {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

// Estilos: 0 normal · 1 encabezado en negrita · 2 importe con 2 decimales · 3 fecha · 4 número entero (con miles)
const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

/** Arma el XML de la hoja. Exportado para las pruebas. */
export function hojaXml(encabezados: string[], filas: Celda[][]): string {
  const anchos = encabezados.map((e) => Math.max(8, e.length + 2))
  const fila = (valores: Celda[], r: number, encabezado: boolean) =>
    `<row r="${r}">${valores
      .map((v, i) => {
        const ref = `${columna(i)}${r}`
        if (v === null || v === '') return ''
        if (encabezado) return `<c r="${ref}" t="inlineStr" s="1"><is><t>${escapar(String(v))}</t></is></c>`
        if (typeof v === 'number') {
          anchos[i] = Math.max(anchos[i], 14)
          return `<c r="${ref}" s="${Number.isInteger(v) && Math.abs(v) < 10000 ? 4 : 2}"><v>${v}</v></c>`
        }
        const serie = serieFecha(v)
        if (serie !== null) {
          anchos[i] = Math.max(anchos[i], 11)
          return `<c r="${ref}" s="3"><v>${serie}</v></c>`
        }
        anchos[i] = Math.min(50, Math.max(anchos[i], v.length + 1))
        return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapar(v)}</t></is></c>`
      })
      .join('')}</row>`
  const cuerpo = [fila(encabezados, 1, true), ...filas.map((f, i) => fila(f, i + 2, false))].join('')
  const ultima = `${columna(Math.max(0, encabezados.length - 1))}${filas.length + 1}`
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${anchos.map((a, i) => `<col min="${i + 1}" max="${i + 1}" width="${a}" customWidth="1"/>`).join('')}</cols>
<sheetData>${cuerpo}</sheetData>
<autoFilter ref="A1:${ultima}"/>
</worksheet>`
}

// --- ZIP sin comprimir ---
const TABLA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(datos: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < datos.length; i++) c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Arma el .xlsx completo. Exportado para las pruebas. */
export function armarXlsx(encabezados: string[], filas: Celda[][], nombreHoja = 'CobroSync'): Uint8Array {
  const hoja = escapar(nombreHoja.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Hoja1')
  const archivos: [string, string][] = [
    [
      '[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    ],
    [
      '_rels/.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      'xl/workbook.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${hoja}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${hoja}'!$A$1:$${columna(Math.max(0, encabezados.length - 1))}$${filas.length + 1}</definedName></definedNames></workbook>`,
    ],
    [
      'xl/_rels/workbook.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ],
    ['xl/styles.xml', ESTILOS],
    ['xl/worksheets/sheet1.xml', hojaXml(encabezados, filas)],
  ]

  const codificar = new TextEncoder()
  const partes: Uint8Array[] = []
  const central: Uint8Array[] = []
  let desplazamiento = 0
  for (const [nombre, texto] of archivos) {
    const n = codificar.encode(nombre)
    const datos = codificar.encode(texto)
    const crc = crc32(datos)
    const local = new Uint8Array(30 + n.length)
    const v = new DataView(local.buffer)
    v.setUint32(0, 0x04034b50, true)
    v.setUint16(4, 20, true)
    v.setUint16(6, 0x0800, true) // nombres en UTF-8
    v.setUint16(8, 0, true) // sin comprimir
    v.setUint32(14, crc, true)
    v.setUint32(18, datos.length, true)
    v.setUint32(22, datos.length, true)
    v.setUint16(26, n.length, true)
    local.set(n, 30)
    const dir = new Uint8Array(46 + n.length)
    const w = new DataView(dir.buffer)
    w.setUint32(0, 0x02014b50, true)
    w.setUint16(4, 20, true)
    w.setUint16(6, 20, true)
    w.setUint16(8, 0x0800, true)
    w.setUint32(16, crc, true)
    w.setUint32(20, datos.length, true)
    w.setUint32(24, datos.length, true)
    w.setUint16(28, n.length, true)
    w.setUint32(42, desplazamiento, true)
    dir.set(n, 46)
    partes.push(local, datos)
    central.push(dir)
    desplazamiento += local.length + datos.length
  }
  const tamCentral = central.reduce((t, c) => t + c.length, 0)
  const fin = new Uint8Array(22)
  const f = new DataView(fin.buffer)
  f.setUint32(0, 0x06054b50, true)
  f.setUint16(8, archivos.length, true)
  f.setUint16(10, archivos.length, true)
  f.setUint32(12, tamCentral, true)
  f.setUint32(16, desplazamiento, true)
  const todo = [...partes, ...central, fin]
  const salida = new Uint8Array(todo.reduce((t, p) => t + p.length, 0))
  let p = 0
  for (const x of todo) {
    salida.set(x, p)
    p += x.length
  }
  return salida
}

export function descargarExcel(nombreArchivo: string, encabezados: string[], filas: Celda[][]): void {
  const bytes = armarXlsx(encabezados, filas)
  const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `${nombreArchivo}.xlsx`
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
