/**
 * Lee la exportación de facturas del ERP (Quiter) guardada como CSV y arma
 * las facturas nuevas en "Doc. pendiente".
 *
 * Por ahora es solo para ver cómo funcionaría: lo que se carga queda en el
 * navegador y se pierde al recargar. Guardarlo en serio es parte de la etapa 2.
 *
 * Columnas de la exportación (hoja "Quiter"):
 *  0 Refer. · 1 Fecha · 2 TC ("FC E") · 3 Clase · 4 BOCA (punto de venta) · 5 Número ("De 00004570 a 00004570")
 *  6 Nombre (razón social) · 7 TIVA · 8 CUIT · 9 Exento · 10 Base imp. · 11 IVA 21 · 12 IVA 10,5
 *  13 Internos · 14 Per. IIBB · 15 Per. IIBB Cap. · 16 Imp. total
 */
import type { Aseguradora, Comprobante, Sucursal } from '../domain/tipos'
import { fechaIso, importe, parsearCsv } from './planilla'

const COL = { ref: 0, fecha: 1, tc: 2, pv: 4, numero: 5, nombre: 6, cuit: 8, total: 16 }

export interface ResultadoErp {
  nuevas: Comprobante[]
  /** ya estaban cargadas (misma referencia o mismo número) */
  repetidas: number
  /** filas que no son de una compañía de seguros conocida o no se pudieron leer */
  ignoradas: number
}

const soloDigitos = (texto: string | undefined) => (texto ?? '').replace(/\D/g, '')
const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

/** "De 00004570 a 00004570" → 4570 */
export function numeroDesde(valor: string | undefined): number | null {
  const m = /(\d+)/.exec(valor ?? '')
  return m ? Number(m[1]) : null
}

export function importarErp(
  texto: string,
  existentes: Comprobante[],
  aseguradoras: Aseguradora[],
  sucursales: Sucursal[],
  hoy: string,
): ResultadoErp {
  const filas = parsearCsv(texto)
  const inicio = filas.findIndex((f) => /refer/i.test(f[COL.ref] ?? '') && /cuit/i.test(f[COL.cuit] ?? ''))
  if (inicio === -1) {
    throw new Error('No reconozco el formato. Tiene que ser la exportación de facturas del ERP: columna A "Refer." y columna I "CUIT".')
  }

  const porCuit = new Map(aseguradoras.filter((a) => a.cuit).map((a) => [soloDigitos(a.cuit), a]))
  const porNombre = new Map(aseguradoras.map((a) => [normalizar(a.razonSocial ?? a.nombre), a]))
  const sucursalDePv = new Map<number, string>()
  for (const s of sucursales) for (const pv of s.puntosVenta ?? [s.puntoVenta]) sucursalDePv.set(pv, s.nombre)

  const refs = new Set(existentes.map((c) => c.ref))
  const numeros = new Set(existentes.map((c) => `${c.tipo}-${c.puntoVenta}-${c.numero}`))
  const resultado: ResultadoErp = { nuevas: [], repetidas: 0, ignoradas: 0 }

  for (const f of filas.slice(inicio + 1)) {
    if (f.every((c) => !c.trim())) continue
    const ref = (f[COL.ref] ?? '').trim()
    const fecha = fechaIso(f[COL.fecha])
    const tipo = /^\s*NC/i.test(f[COL.tc] ?? '') ? 'NC' : /^\s*FC/i.test(f[COL.tc] ?? '') ? 'FC' : null
    const puntoVenta = Number(soloDigitos(f[COL.pv]))
    const numero = numeroDesde(f[COL.numero])
    const aseguradora = porCuit.get(soloDigitos(f[COL.cuit])) ?? porNombre.get(normalizar(f[COL.nombre] ?? ''))
    const sucursal = sucursalDePv.get(puntoVenta)
    if (!ref || !fecha || !tipo || !numero || !aseguradora || !sucursal) {
      resultado.ignoradas++
      continue
    }
    if (refs.has(ref) || numeros.has(`${tipo}-${puntoVenta}-${numero}`)) {
      resultado.repetidas++
      continue
    }
    refs.add(ref)
    const total = Math.abs(importe(f[COL.total])) * (tipo === 'NC' ? -1 : 1)
    resultado.nuevas.push({
      id: `erp-${ref}`,
      ref,
      tipo,
      fecha,
      sucursal,
      puntoVenta,
      numero,
      aseguradoraId: aseguradora.id,
      siniestro: '',
      patente: '',
      total,
      fechaDrive: null,
      subidoPor: null,
      fechaPresentacion: null,
      vencimiento: null,
      fechaCobro: null,
      estado: tipo === 'NC' ? 'nota_credito' : 'pendiente_drive',
      ncReferencia: null,
      ncInformada: tipo === 'NC' ? false : null,
      compromiso: null,
      reclamos: [],
      observaciones: '',
      documentos:
        tipo === 'NC'
          ? []
          : (['factura', 'orden', 'firma'] as const).map((t) => ({ tipo: t, estado: 'faltante' as const })),
      eventos: [{ fecha: hoy, autor: 'Sistema', area: 'sistema', tipo: 'aviso', texto: 'Factura cargada desde el Excel del ERP' }],
    })
  }
  return resultado
}
