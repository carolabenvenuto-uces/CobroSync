/**
 * Lee la hoja "Diario" de la planilla de control exportada como CSV
 * (Google Sheets: Archivo → Descargar → Valores separados por comas, estando en la hoja Diario).
 *
 * IMPORTANTE: todo ocurre en el navegador de quien carga el archivo. No se envía a
 * ningún servidor ni se guarda: al recargar la página, los datos desaparecen.
 *
 * Columnas esperadas (igual que la planilla):
 *  A Fecha · B Ref. · C Sucursal · D CTE. · E Número · F Compañía · G Siniestro/Patente
 *  H Total · I Fecha Drive · J días · K Fecha presentación · L días · M Vto. · N Fecha de cobro
 *  O Estado · P NC Anula · Q NC Ref. · R Observaciones
 *  Opcionales: S Reclamado (x / ✓ / sí) · T Cant. reclamos · U Fecha del último reclamo
 */
import { datosCompania } from '../domain/companias'
import type {
  Aseguradora,
  Reclamo,
  Comprobante,
  DatosApp,
  Documento,
  EstadoComprobante,
  Sucursal,
} from '../domain/tipos'
import { DOCUMENTOS_REQUERIDOS } from '../domain/semaforo'
import { mesDe, sumarDias } from '../lib/fechas'

const COL = {
  fecha: 0,
  ref: 1,
  sucursal: 2,
  cte: 3,
  numero: 4,
  compania: 5,
  siniestro: 6,
  total: 7,
  drive: 8,
  presentacion: 10,
  vencimiento: 12,
  cobro: 13,
  estado: 14,
  observaciones: 17,
  // Columnas nuevas propuestas para la planilla (opcionales)
  reclamado: 18,
  cantidadReclamos: 19,
  ultimoReclamo: 20,
}

export interface ResultadoImportacion {
  datos: DatosApp
  filasLeidas: number
  filasIgnoradas: number
  /** mes de la última factura, para posicionar los filtros */
  ultimoMes: number
}

/**
 * Lee el archivo como texto. Acepta el Excel tal cual (.xlsx: se toma la hoja cuyo nombre coincida
 * con "hoja", o la primera) o un CSV (prueba UTF-8 y, si hay caracteres rotos, Windows-1252).
 */
export async function leerArchivo(archivo: File, hoja?: RegExp): Promise<string> {
  if (/\.xlsx$/i.test(archivo.name)) {
    const { xlsxACsv } = await import('../lib/xlsx')
    return xlsxACsv(archivo, hoja)
  }
  if (/\.xls$/i.test(archivo.name)) {
    throw new Error('Ese archivo es de un Excel viejo (.xls). Abrilo y guardalo como "Libro de Excel (.xlsx)" o como CSV.')
  }
  const bytes = await archivo.arrayBuffer()
  const utf8 = new TextDecoder('utf-8').decode(bytes)
  return utf8.includes('�') ? new TextDecoder('windows-1252').decode(bytes) : utf8
}

/** CSV con comillas; detecta si el separador es coma o punto y coma. */
export function parsearCsv(texto: string): string[][] {
  const primera = texto.slice(0, texto.indexOf('\n') === -1 ? texto.length : texto.indexOf('\n'))
  const separador = (primera.match(/;/g)?.length ?? 0) > (primera.match(/,/g)?.length ?? 0) ? ';' : ','
  const filas: string[][] = []
  let fila: string[] = []
  let celda = ''
  let entreComillas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (entreComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          celda += '"'
          i++
        } else entreComillas = false
      } else celda += c
    } else if (c === '"') entreComillas = true
    else if (c === separador) {
      fila.push(celda)
      celda = ''
    } else if (c === '\n') {
      fila.push(celda.replace(/\r$/, ''))
      filas.push(fila)
      fila = []
      celda = ''
    } else celda += c
  }
  if (celda || fila.length) {
    fila.push(celda)
    filas.push(fila)
  }
  return filas
}

/** "02-01-26", "02/01/26" o "02/01/2026" → "2026-01-02" */
export function fechaIso(valor: string | undefined): string | null {
  const m = /^\s*(\d{1,2})[-/](\d{1,2})[-/](\d{2}|\d{4})\s*$/.exec(valor ?? '')
  if (!m) return null
  const anio = m[3].length === 2 ? `20${m[3]}` : m[3]
  return `${anio}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

/** "3.222.184,35", "-1.156.894,74", "(1.156.894,74)" o "$ 1.000" → número */
export function importe(valor: string | undefined): number {
  const texto = (valor ?? '').trim()
  const negativo = texto.startsWith('-') || (texto.startsWith('(') && texto.endsWith(')'))
  const limpio = texto.replace(/[^\d,]/g, '').replace(',', '.')
  const n = Number(limpio)
  return Number.isFinite(n) ? (negativo ? -n : n) : 0
}

const slug = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

function estadoDesdePlanilla(
  estado: string,
  tipo: 'FC' | 'NC',
  fechas: { drive: string | null; presentacion: string | null; cobro: string | null },
): EstadoComprobante {
  if (tipo === 'NC') return 'nota_credito'
  const e = estado.trim().toLowerCase()
  if (e.startsWith('anul')) return 'anulada'
  if (e.startsWith('cobr') || fechas.cobro) return 'cobrada'
  if (fechas.presentacion || e.startsWith('vencid') || e.startsWith('al d')) return 'presentada'
  if (fechas.drive || e.startsWith('p. pend')) return 'en_gestion'
  return 'pendiente_drive'
}

/** Lee las columnas opcionales de reclamos (S, T, U). */
function leerReclamos(f: string[]): Reclamo[] {
  const marca = (f[COL.reclamado] ?? '').trim().toLowerCase()
  const cantidad = Number((f[COL.cantidadReclamos] ?? '').replace(/\D/g, '')) || 0
  const ultimo = fechaIso(f[COL.ultimoReclamo])
  const reclamada = cantidad > 0 || ultimo !== null || ['x', '✓', '✔', 'si', 'sí', 'true', 'verdadero'].includes(marca)
  if (!reclamada) return []
  const fecha = ultimo ?? ''
  return Array.from({ length: Math.max(1, cantidad) }, (): Reclamo => ({ fecha, medio: 'mail', autor: 'Auditoría', nota: 'Registrado en la planilla' }))
}

export function importarPlanilla(texto: string, hoy: string): ResultadoImportacion {
  const filas = parsearCsv(texto)

  // Validar que sea la hoja Diario: en el encabezado tienen que estar "Sucursal" y "Estado"
  const encabezado = filas
    .slice(0, 10)
    .find((f) => /sucursal/i.test(f[COL.sucursal] ?? '') && /estado/i.test(f[COL.estado] ?? ''))
  if (!encabezado) {
    throw new Error(
      'No reconozco el formato. Descargá la hoja "Diario" como CSV: la columna C tiene que ser "Sucursal" y la O "Estado".',
    )
  }

  const aseguradoras = new Map<string, Aseguradora>()
  const sucursales = new Map<string, Sucursal>()
  const comprobantes: Comprobante[] = []
  let ignoradas = 0
  let ultimaFecha = ''

  filas.forEach((f, i) => {
    const fecha = fechaIso(f[COL.fecha])
    const sucursal = (f[COL.sucursal] ?? '').trim()
    const compania = (f[COL.compania] ?? '').trim()
    if (!fecha || !sucursal) {
      if (f.some((c) => c.trim() !== '') && i > 3) ignoradas++
      return
    }
    if (fecha > ultimaFecha) ultimaFecha = fecha

    const tipo = (f[COL.cte] ?? '').trim().toUpperCase().startsWith('NC') ? 'NC' : 'FC'
    const [pv, nro] = (f[COL.numero] ?? '').split('-').map((x) => Number(x.replace(/\D/g, '')) || 0)

    if (!aseguradoras.has(compania)) {
      // Razón social y CUIT de la pestaña CP: así la carga del ERP reconoce la compañía
      const cp = datosCompania(compania)
      aseguradoras.set(compania, {
        id: slug(compania) || 'sin-compania',
        nombre: compania || 'Sin compañía',
        razonSocial: cp?.razonSocial,
        cuit: cp?.cuit,
        email: '',
        // Plazo de pago desde la presentación: 30 días, salvo Federación Patronal (7)
        plazoPagoDias: cp?.plazo ?? (/patronal/i.test(compania) ? 7 : 30),
      })
    }
    if (!sucursales.has(sucursal)) {
      sucursales.set(sucursal, { nombre: sucursal, puntoVenta: pv ?? 0, gerente: `Gerente de ${sucursal}`, personas: [] })
    }
    const aseguradora = aseguradoras.get(compania)!

    const drive = fechaIso(f[COL.drive])
    const presentacion = fechaIso(f[COL.presentacion])
    const cobro = fechaIso(f[COL.cobro])
    const estado = estadoDesdePlanilla(f[COL.estado] ?? '', tipo, { drive, presentacion, cobro })
    const estadoTexto = (f[COL.estado] ?? '').trim().toLowerCase()

    // La planilla no detalla cada documento: si se recibió en el Drive (o figura "P. Pend."),
    // se considera revisado y aprobado; si no, faltan la factura, la orden y la firma.
    const completo = drive !== null || estadoTexto.startsWith('p. pend') || presentacion !== null
    const documentos: Documento[] =
      tipo === 'NC'
        ? []
        : DOCUMENTOS_REQUERIDOS.map((t): Documento => ({ tipo: t, estado: completo ? 'ok' : 'faltante' }))

    const total = importe(f[COL.total])
    comprobantes.push({
      id: `p-${i}`,
      ref: (f[COL.ref] ?? '').trim(),
      tipo,
      fecha,
      sucursal,
      puntoVenta: pv ?? 0,
      numero: nro ?? 0,
      aseguradoraId: aseguradora.id,
      siniestro: (f[COL.siniestro] ?? '').trim(),
      patente: '',
      total: tipo === 'NC' ? -Math.abs(total) : total,
      fechaDrive: drive,
      subidoPor: null,
      // En la planilla, la fecha de la columna Drive es la de la documentación completa
      fechaAprobacion: tipo === 'NC' || !completo ? null : (drive ?? presentacion),
      fechaPresentacion: estado === 'anulada' ? null : presentacion,
      vencimiento:
        estado === 'anulada' || !presentacion
          ? null
          : (fechaIso(f[COL.vencimiento]) ?? sumarDias(presentacion, aseguradora.plazoPagoDias)),
      fechaCobro: estado === 'cobrada' ? cobro : null,
      estado,
      ncReferencia: null,
      // La planilla no registra si la sucursal avisó la NC: no se generan alertas por eso
      ncInformada: tipo === 'NC' ? true : null,
      compromiso: null,
      reclamos: leerReclamos(f),
      observaciones: (f[COL.observaciones] ?? '').trim(),
      documentos,
      eventos: [],
    })
  })

  if (comprobantes.length === 0) {
    throw new Error('El archivo no tiene filas con fecha y sucursal. ¿Descargaste la hoja "Diario"?')
  }

  return {
    datos: {
      aseguradoras: [...aseguradoras.values()],
      comprobantes,
      cobrosPrevistos: [],
      meta: { fechaCorte: hoy, sucursales: [...sucursales.values()] },
    },
    filasLeidas: comprobantes.length,
    filasIgnoradas: ignoradas,
    ultimoMes: mesDe(ultimaFecha),
  }
}
