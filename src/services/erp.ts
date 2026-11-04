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
import { importeAcreditable, saldoSinCobro } from '../domain/importes'
import { fechaIso, importe, parsearCsv } from './planilla'

const COL = { ref: 0, fecha: 1, tc: 2, pv: 4, numero: 5, nombre: 6, cuit: 8, perIibb: 14, perIibbCap: 15, total: 16 }

export interface ResultadoErp {
  nuevas: Comprobante[]
  /** ya estaban cargadas (misma referencia o mismo número) */
  repetidas: number
  /** filas que no son de una compañía de seguros conocida o no se pudieron leer */
  ignoradas: number
  /**
   * notas de crédito que se vincularon con el aviso de la sucursal:
   * total → la factura queda anulada; parcial → se resta del saldo
   */
  vinculadas: { facturaId: string; ncId: string; tipo: 'total' | 'parcial'; importe: number }[]
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
  const resultado: ResultadoErp = { nuevas: [], repetidas: 0, ignoradas: 0, vinculadas: [] }

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
    // Las percepciones de IIBB no se acreditan en la nota de crédito: se guardan para compararla
    const percepciones = Math.abs(importe(f[COL.perIibb])) + Math.abs(importe(f[COL.perIibbCap]))
    resultado.nuevas.push({
      id: `ref-${ref}`,
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
      percepciones,
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
  vincularNotasDeCredito(resultado, existentes)
  return resultado
}

/** Diferencia aceptada al comparar importes (redondeos). */
const TOLERANCIA = 1

/**
 * ¿Esta nota de crédito anula toda la factura? Las percepciones no se acreditan, así que la NC
 * total vale "total − percepciones". Si la factura no trae percepciones (vino de la planilla), se
 * acepta una NC de entre el 90 % y el 100 % del saldo.
 */
export function esNotaTotal(nc: number, f: Comprobante): boolean {
  const saldo = saldoSinCobro(f)
  const acreditable = importeAcreditable(f)
  if (acreditable !== null && f.percepciones) return Math.abs(nc - (acreditable - (f.acreditado ?? 0))) <= TOLERANCIA
  return nc <= saldo + TOLERANCIA && nc >= saldo * 0.9
}

/**
 * Cada nota de crédito nueva busca su factura (misma sucursal y compañía):
 * 1. Las facturas en las que la sucursal avisó una NC: total (el importe coincide con el saldo sin
 *    percepciones) o parcial (el importe coincide con el que avisó, con un margen del 2 %).
 * 2. Si nadie avisó y hay una sola factura que coincide como NC total, se deja vinculada pero
 *    "sin aviso": Auditoría la confirma. Las parciales sin aviso las vincula Auditoría a mano.
 */
function vincularNotasDeCredito(r: ResultadoErp, existentes: Comprobante[]) {
  const usadas = new Set<string>()
  for (const nc of r.nuevas.filter((c) => c.tipo === 'NC')) {
    const importeNc = Math.abs(nc.total)
    const candidatas = [...existentes, ...r.nuevas].filter(
      (f) =>
        f.tipo === 'FC' &&
        f.estado !== 'anulada' &&
        !usadas.has(f.id) &&
        f.sucursal === nc.sucursal &&
        f.aseguradoraId === nc.aseguradoraId &&
        importeNc <= saldoSinCobro(f) + TOLERANCIA,
    )
    const coincideConAviso = (f: Comprobante) => {
      const aviso = f.anulacionInformada
      if (!aviso) return null
      if (aviso.parcial && aviso.importe) {
        return Math.abs(importeNc - aviso.importe) <= Math.max(TOLERANCIA, aviso.importe * 0.02) ? 'parcial' : null
      }
      return esNotaTotal(importeNc, f) ? 'total' : null
    }
    const conAviso = candidatas
      .map((f) => ({ f, tipo: coincideConAviso(f) }))
      .filter((x): x is { f: Comprobante; tipo: 'total' | 'parcial' } => x.tipo !== null)
      .sort((a, b) => b.f.fecha.localeCompare(a.f.fecha))[0]
    if (conAviso) {
      usadas.add(conAviso.f.id)
      nc.ncReferencia = conAviso.f.id
      nc.ncInformada = true
      r.vinculadas.push({ facturaId: conAviso.f.id, ncId: nc.id, tipo: conAviso.tipo, importe: importeNc })
      continue
    }
    const totales = candidatas.filter((f) => esNotaTotal(importeNc, f))
    if (totales.length === 1) {
      usadas.add(totales[0].id)
      nc.ncReferencia = totales[0].id
    }
  }
}
