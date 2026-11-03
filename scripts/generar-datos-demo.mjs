/**
 * Genera los datos de DEMO de CobroSync (100 % ficticios).
 *
 *   npm run datos:demo
 *
 * - Compañías, sucursales, patentes, siniestros y montos son inventados.
 * - Los correos usan el dominio reservado ".example", que no existe.
 * - Usa una "semilla" fija: cada vez que se ejecuta genera exactamente los mismos
 *   datos, así los tests y las capturas son reproducibles.
 *
 * Escribe los JSON en public/datos-demo/, que la app lee con fetch().
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SEMILLA = 20261103
const FECHA_INICIO = '2026-01-02'
const FECHA_CORTE = '2026-10-31' // el "hoy" de la demo

// ── Números aleatorios reproducibles (algoritmo mulberry32) ──────────────────
function crearAleatorio(semilla) {
  let a = semilla
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const azar = crearAleatorio(SEMILLA)
const entre = (min, max) => Math.floor(azar() * (max - min + 1)) + min
const elegir = (lista) => lista[Math.floor(azar() * lista.length)]
const elegirPonderado = (lista) => {
  let r = azar() * lista.reduce((s, x) => s + x.peso, 0)
  for (const x of lista) {
    r -= x.peso
    if (r <= 0) return x
  }
  return lista[lista.length - 1]
}

// ── Fechas como texto ISO ────────────────────────────────────────────────────
const DIA = 86_400_000
const sumarDias = (iso, n) => new Date(Date.parse(iso) + n * DIA).toISOString().slice(0, 10)
const diffDias = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DIA)
const esDiaHabil = (iso) => {
  const d = new Date(Date.parse(iso)).getUTCDay()
  return d !== 0 && d !== 6
}

// ── Catálogos ficticios ──────────────────────────────────────────────────────
const ASEGURADORAS = [
  { id: 'ceibo', nombre: 'Ceibo Seguros', plazoPagoDias: 30, peso: 20 },
  { id: 'quebracho', nombre: 'Quebracho Seguros', plazoPagoDias: 45, peso: 16 },
  { id: 'lapacho', nombre: 'Lapacho Cía. de Seguros', plazoPagoDias: 30, peso: 12 },
  { id: 'ombu', nombre: 'Ombú Seguros', plazoPagoDias: 60, peso: 10 },
  { id: 'jacaranda', nombre: 'Jacarandá Seguros', plazoPagoDias: 30, peso: 9 },
  { id: 'algarrobo', nombre: 'Algarrobo Seguros', plazoPagoDias: 45, peso: 8 },
  { id: 'calden', nombre: 'Caldén Seguros', plazoPagoDias: 30, peso: 7 },
  { id: 'tipa', nombre: 'Tipa Aseguradora', plazoPagoDias: 60, peso: 6 },
  { id: 'nandubay', nombre: 'Ñandubay Seguros', plazoPagoDias: 45, peso: 5 },
  { id: 'palo-santo', nombre: 'Palo Santo Seguros', plazoPagoDias: 30, peso: 4 },
]

const SUCURSALES = [
  { nombre: 'Casa Central', puntoVenta: 21, peso: 35 },
  { nombre: 'Sucursal Norte', puntoVenta: 35, peso: 30 },
  { nombre: 'Sucursal Oeste', puntoVenta: 19, peso: 20 },
  { nombre: 'Sucursal Sur', puntoVenta: 37, peso: 15 },
]

const OBSERVACIONES_ROJO = [
  'Se reclamó la orden firmada a la sucursal',
  'La compañía pidió reenviar el escaneo',
  'Conformidad firmada por persona no autorizada',
  'Remito pendiente del proveedor de repuestos',
  '',
  '',
]

const LETRAS = 'ABCDEFGHJKLMNPRSTUVWXYZ'
const patente = () =>
  `${elegir(LETRAS)}${elegir(LETRAS)} ${entre(100, 999)} ${elegir(LETRAS)}${elegir(LETRAS)}`

function documentosDelLegajo(enDrive, edad) {
  const tipos = ['factura', 'orden_reparacion', 'remito', 'conformidad']
  // La factura sale del ERP; el resto lo sube la sucursal al Drive.
  if (!enDrive) {
    return tipos.map((tipo) => ({ tipo, estado: tipo === 'factura' ? 'ok' : 'faltante' }))
  }
  // Los legajos recientes tienen más observaciones que los viejos (ya corregidos).
  const probabilidadProblema = edad > 75 ? 0.01 : edad > 30 ? 0.05 : 0.11
  return tipos.map((tipo) => {
    if (azar() >= probabilidadProblema) return { tipo, estado: 'ok' }
    const posibles =
      tipo === 'factura'
        ? ['ilegible']
        : tipo === 'remito'
          ? ['faltante', 'ilegible']
          : ['faltante', 'ilegible', 'sin_firma']
    return { tipo, estado: elegir(posibles) }
  })
}

// ── Generación ───────────────────────────────────────────────────────────────
const comprobantes = []
const numeradores = Object.fromEntries(SUCURSALES.map((s) => [s.puntoVenta, entre(4000, 9000)]))
let ref = 6_900_000

function nuevoNumero(puntoVenta) {
  numeradores[puntoVenta] += 1
  return numeradores[puntoVenta]
}

for (let fecha = FECHA_INICIO; fecha <= FECHA_CORTE; fecha = sumarDias(fecha, 1)) {
  if (!esDiaHabil(fecha)) continue
  const cantidad = entre(1, 4)

  for (let i = 0; i < cantidad; i++) {
    const sucursal = elegirPonderado(SUCURSALES)
    const aseguradora = elegirPonderado(ASEGURADORAS)
    const edad = diffDias(fecha, FECHA_CORTE)
    ref += entre(1, 9)

    // Importe: la mayoría entre $300.000 y $4 millones, algunos siniestros grandes.
    const total = Math.round((azar() < 0.12 ? entre(4_000_000, 15_000_000) : entre(300_000, 4_000_000)) * 100) / 100

    // Demora de la sucursal en subir el legajo al Drive
    const demoraDrive = azar() < 0.8 ? entre(0, 3) : entre(5, 14)
    let fechaDrive = sumarDias(fecha, demoraDrive)
    if (fechaDrive > FECHA_CORTE || (edad < 20 && azar() < 0.12)) fechaDrive = null

    const documentos = documentosDelLegajo(fechaDrive !== null, edad)
    const completo = documentos.every((d) => d.estado === 'ok')

    let fechaPresentacion = null
    if (completo && fechaDrive) {
      const p = sumarDias(fechaDrive, entre(0, 4))
      if (p <= FECHA_CORTE) fechaPresentacion = p
    }

    const vencimiento = fechaPresentacion ? sumarDias(fechaPresentacion, aseguradora.plazoPagoDias) : null

    let fechaCobro = null
    if (vencimiento) {
      const c = sumarDias(vencimiento, entre(-8, 20))
      if (c <= FECHA_CORTE && azar() < 0.97) fechaCobro = c
    }

    const estado = fechaCobro
      ? 'cobrada'
      : fechaPresentacion
        ? 'presentada'
        : fechaDrive
          ? 'en_gestion'
          : 'pendiente_drive'

    const comprobante = {
      id: `fc-${comprobantes.length + 1}`,
      ref: String(ref),
      tipo: 'FC',
      fecha,
      sucursal: sucursal.nombre,
      puntoVenta: sucursal.puntoVenta,
      numero: nuevoNumero(sucursal.puntoVenta),
      aseguradoraId: aseguradora.id,
      siniestro: String(entre(1_000_000, 9_999_999)),
      patente: patente(),
      total,
      fechaDrive,
      fechaPresentacion,
      vencimiento,
      fechaCobro,
      estado,
      ncReferencia: null,
      observaciones: completo ? '' : elegir(OBSERVACIONES_ROJO),
      documentos,
    }
    comprobantes.push(comprobante)

    // ~3 % de las facturas se anulan con una nota de crédito por el mismo importe.
    if (estado !== 'cobrada' && edad > 5 && azar() < 0.03) {
      comprobante.estado = 'anulada'
      comprobante.fechaPresentacion = null
      comprobante.vencimiento = null
      comprobante.observaciones = elegir([
        'Factura emitida a la compañía equivocada',
        'Error en el importe: se refactura',
        'Factura vencida, se refactura con fecha actual',
      ])
      const fechaNc = sumarDias(fecha, entre(1, Math.min(10, edad)))
      comprobantes.push({
        id: `nc-${comprobantes.length + 1}`,
        ref: String((ref += 1)),
        tipo: 'NC',
        fecha: fechaNc,
        sucursal: sucursal.nombre,
        puntoVenta: sucursal.puntoVenta,
        numero: nuevoNumero(sucursal.puntoVenta),
        aseguradoraId: aseguradora.id,
        siniestro: comprobante.siniestro,
        patente: comprobante.patente,
        total: -total,
        fechaDrive: null,
        fechaPresentacion: null,
        vencimiento: null,
        fechaCobro: null,
        estado: 'nota_credito',
        ncReferencia: comprobante.id,
        observaciones: `Anula ${comprobante.id}`,
        documentos: [],
      })
    }
  }
}

// ── Cobros previstos ─────────────────────────────────────────────────────────
const cobrosPrevistos = []
for (const c of comprobantes) {
  if (c.tipo !== 'FC') continue
  // Pagos que la compañía ya informó para facturas presentadas
  if (c.estado === 'presentada' && azar() < 0.65) {
    const base = c.vencimiento >= FECHA_CORTE ? c.vencimiento : FECHA_CORTE
    cobrosPrevistos.push({
      id: `cp-${cobrosPrevistos.length + 1}`,
      comprobanteId: c.id,
      aseguradoraId: c.aseguradoraId,
      fechaIngreso: sumarDias(base, entre(1, 12)),
      monto: c.total,
      estado: 'informado',
    })
  }
  // Historial reciente de lo ya cobrado
  if (c.estado === 'cobrada' && diffDias(c.fechaCobro, FECHA_CORTE) <= 60) {
    cobrosPrevistos.push({
      id: `cp-${cobrosPrevistos.length + 1}`,
      comprobanteId: c.id,
      aseguradoraId: c.aseguradoraId,
      fechaIngreso: c.fechaCobro,
      monto: c.total,
      estado: 'cobrado',
    })
  }
}

// ── Escritura ────────────────────────────────────────────────────────────────
const aseguradoras = ASEGURADORAS.map(({ id, nombre, plazoPagoDias }) => ({
  id,
  nombre,
  email: `facturacion@${id}-seguros.example`,
  plazoPagoDias,
}))
const meta = { fechaCorte: FECHA_CORTE, sucursales: SUCURSALES.map((s) => s.nombre) }

const carpeta = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'datos-demo')
mkdirSync(carpeta, { recursive: true })
const guardar = (archivo, datos) => writeFileSync(join(carpeta, archivo), JSON.stringify(datos) + '\n')
guardar('aseguradoras.json', aseguradoras)
guardar('comprobantes.json', comprobantes)
guardar('cobros-previstos.json', cobrosPrevistos)
guardar('meta.json', meta)

const porEstado = comprobantes.reduce((acc, c) => ({ ...acc, [c.estado]: (acc[c.estado] ?? 0) + 1 }), {})
console.log(`Generados ${comprobantes.length} comprobantes y ${cobrosPrevistos.length} cobros previstos`)
console.log(porEstado)
