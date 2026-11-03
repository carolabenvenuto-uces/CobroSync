/**
 * Genera los datos de DEMO de CobroSync (100 % ficticios).
 *
 *   npm run datos:demo
 *
 * - Compañías, sucursales, personas, patentes, siniestros y montos son inventados.
 * - Los correos usan el dominio reservado ".example", que no existe.
 * - Usa una "semilla" fija: cada vez que se ejecuta genera exactamente los mismos
 *   datos, así los tests y las capturas son reproducibles.
 *
 * Imita el COMPORTAMIENTO real (no los valores):
 * - más facturación a fin de mes;
 * - cada sucursal tiene su ritmo para escanear (hay dos que se atrasan seguido);
 * - documentos ilegibles o sin firma, rechazos y su conversación;
 * - sucursales que avisan "no puedo subirlo todavía" con una fecha comprometida;
 * - notas de crédito que la sucursal no siempre informa.
 *
 * Escribe los JSON en public/datos-demo/, que la app lee con fetch().
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SEMILLA = 20261103
const FECHA_INICIO = '2026-01-02'
const FECHA_CORTE = '2026-10-31' // el "hoy" de la demo
const PLAZO_ESCANEO = 7

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
// Plazo de pago desde la presentación: 30 días en general, 7 en algunas compañías.
const ASEGURADORAS = [
  { id: 'ceibo', nombre: 'Ceibo Seguros', plazoPagoDias: 30, peso: 20 },
  { id: 'quebracho', nombre: 'Quebracho Seguros', plazoPagoDias: 30, peso: 16 },
  { id: 'lapacho', nombre: 'Lapacho Cía. de Seguros', plazoPagoDias: 7, peso: 12 },
  { id: 'ombu', nombre: 'Ombú Seguros', plazoPagoDias: 30, peso: 10 },
  { id: 'jacaranda', nombre: 'Jacarandá Seguros', plazoPagoDias: 30, peso: 9 },
  { id: 'algarrobo', nombre: 'Algarrobo Seguros', plazoPagoDias: 7, peso: 8 },
  { id: 'calden', nombre: 'Caldén Seguros', plazoPagoDias: 30, peso: 7 },
  { id: 'tipa', nombre: 'Tipa Aseguradora', plazoPagoDias: 30, peso: 6 },
  { id: 'nandubay', nombre: 'Ñandubay Seguros', plazoPagoDias: 7, peso: 5 },
  { id: 'palo-santo', nombre: 'Palo Santo Seguros', plazoPagoDias: 30, peso: 4 },
]

// `atraso`: probabilidad de que la sucursal se demore con el escaneo.
// `errores`: probabilidad de subir un documento ilegible, sin firma o de menos.
const SUCURSALES = [
  { nombre: 'Sucursal Centro', puntoVenta: 21, gerente: 'R. Medina', personas: ['Lucía P.', 'Tomás R.', 'Ana G.'], peso: 26, atraso: 0.1, errores: 0.05 },
  { nombre: 'Sucursal Norte', puntoVenta: 35, gerente: 'S. Ferreyra', personas: ['Martín L.', 'Paula S.'], peso: 20, atraso: 0.35, errores: 0.1 },
  { nombre: 'Sucursal Sur', puntoVenta: 37, gerente: 'G. Ibáñez', personas: ['Diego C.', 'Valeria M.', 'Hernán B.'], peso: 16, atraso: 0.15, errores: 0.06 },
  { nombre: 'Sucursal Oeste', puntoVenta: 19, gerente: 'M. Quiroga', personas: ['Julián A.'], peso: 14, atraso: 0.45, errores: 0.12 },
  { nombre: 'Sucursal Este', puntoVenta: 42, gerente: 'L. Benítez', personas: ['Carla D.', 'Nicolás F.'], peso: 13, atraso: 0.12, errores: 0.04 },
  { nombre: 'Sucursal Ribera', puntoVenta: 48, gerente: 'F. Acosta', personas: ['Sofía V.', 'Pablo E.', 'Inés K.', 'Bruno T.'], peso: 11, atraso: 0.2, errores: 0.08 },
]

const AUDITORIA = ['Carola B.', 'Melina A.']

const MOTIVOS_COMPROMISO = [
  'El vehículo sigue en el taller',
  'Se facturó por adelantado: falta la firma del cliente',
  'Esperando el remito del proveedor de repuestos',
  'El cliente retira el auto la semana próxima',
]

const MOTIVOS_RECHAZO = {
  ilegible: ['La compañía no puede leer el escaneo, reenviar con mejor calidad', 'El escaneo está cortado: falta la parte inferior'],
  sin_firma: ['La orden no tiene la firma del cliente', 'La conformidad no tiene sello del taller'],
}

const RESPUESTAS_SUCURSAL = [
  'Lo vuelvo a escanear hoy.',
  'El cliente viene el jueves, ahí la firma.',
  'Ya lo subí de nuevo, ¿lo ven?',
  'Lo busco en el taller y lo subo.',
]

const LETRAS = 'ABCDEFGHJKLMNPRSTUVWXYZ'
const patente = () => `${elegir(LETRAS)}${elegir(LETRAS)} ${entre(100, 999)} ${elegir(LETRAS)}${elegir(LETRAS)}`
const TIPOS_DOC = ['factura', 'orden_reparacion', 'remito', 'conformidad']
const NOMBRE_DOC = { factura: 'factura', orden_reparacion: 'orden de reparación', remito: 'remito', conformidad: 'conformidad' }

// ── Generación de comprobantes ───────────────────────────────────────────────
const comprobantes = []
const numeradores = Object.fromEntries(SUCURSALES.map((s) => [s.puntoVenta, entre(4000, 9000)]))
let ref = 6_900_000
const nuevoNumero = (pv) => ++numeradores[pv]

function crearFactura(fecha) {
  const sucursal = elegirPonderado(SUCURSALES)
  const aseguradora = elegirPonderado(ASEGURADORAS)
  const persona = elegir(sucursal.personas)
  const edad = diffDias(fecha, FECHA_CORTE)
  const eventos = []
  ref += entre(1, 9)

  const total = Math.round((azar() < 0.12 ? entre(4_000_000, 15_000_000) : entre(300_000, 4_000_000)) * 100) / 100

  // 1) Cuándo sube la sucursal los documentos
  const seAtrasa = azar() < sucursal.atraso
  const demora = seAtrasa ? entre(8, 40) : entre(0, 5)
  let fechaDrive = sumarDias(fecha, demora)
  if (fechaDrive > FECHA_CORTE) fechaDrive = null

  // 2) Qué subió y en qué estado
  let documentos
  if (!fechaDrive) {
    documentos = TIPOS_DOC.map((tipo) => ({ tipo, estado: tipo === 'factura' ? 'ok' : 'faltante' }))
  } else {
    // Los legajos viejos ya se corrigieron casi todos; los recientes tienen más problemas.
    const factor = edad > 75 ? 0.15 : edad > 30 ? 0.6 : 1
    documentos = TIPOS_DOC.map((tipo) => {
      if (tipo === 'factura' || azar() >= sucursal.errores * factor) {
        return { tipo, estado: 'ok', archivo: `${tipo}-${ref}.pdf` }
      }
      const estado = elegir(tipo === 'remito' ? ['faltante', 'ilegible'] : ['faltante', 'ilegible', 'sin_firma'])
      return estado === 'faltante' ? { tipo, estado } : { tipo, estado, archivo: `${tipo}-${ref}.pdf` }
    })
    eventos.push({
      fecha: fechaDrive,
      autor: persona,
      area: 'sucursal',
      tipo: 'subida',
      texto: `Subió ${documentos.filter((d) => d.archivo && d.tipo !== 'factura').map((d) => NOMBRE_DOC[d.tipo]).join(', ') || 'el legajo'}`,
    })
  }
  let completo = documentos.every((d) => d.estado === 'ok')

  // 3) Algunos legajos completos fueron rechazados por la compañía y corregidos después
  let fechaPresentacion = null
  if (completo && fechaDrive) {
    let p = sumarDias(fechaDrive, entre(0, 3))
    let rechazadoSinResolver = false
    if (p <= FECHA_CORTE && azar() < 0.08) {
      const tipo = elegir(['orden_reparacion', 'conformidad'])
      const problema = elegir(['ilegible', 'sin_firma'])
      eventos.push({
        fecha: p,
        autor: elegir(AUDITORIA),
        area: 'auditoria',
        tipo: 'rechazo',
        texto: `Rechazo de ${aseguradora.nombre}: ${elegir(MOTIVOS_RECHAZO[problema])}.`,
      })
      const respuesta = sumarDias(p, entre(1, 6))
      if (respuesta <= FECHA_CORTE) {
        eventos.push({ fecha: respuesta, autor: persona, area: 'sucursal', tipo: 'mensaje', texto: elegir(RESPUESTAS_SUCURSAL) })
        p = sumarDias(respuesta, entre(0, 2))
      } else {
        // sigue rechazado hoy
        documentos = documentos.map((d) => (d.tipo === tipo ? { ...d, estado: problema } : d))
        completo = false
        rechazadoSinResolver = true
      }
    }
    if (!rechazadoSinResolver && p <= FECHA_CORTE) {
      fechaPresentacion = p
      eventos.push({
        fecha: p,
        autor: elegir(AUDITORIA),
        area: 'auditoria',
        tipo: 'presentacion',
        texto: `Presentado a ${aseguradora.nombre}`,
      })
    }
  }

  const vencimiento = fechaPresentacion ? sumarDias(fechaPresentacion, aseguradora.plazoPagoDias) : null
  let fechaCobro = null
  if (vencimiento) {
    const c = sumarDias(vencimiento, entre(-3, 15))
    if (c <= FECHA_CORTE && azar() < 0.97) fechaCobro = c
  }

  // 4) Pendientes de la sucursal: avisos automáticos, compromisos y reclamos
  let compromiso = null
  if (!completo && !fechaPresentacion) {
    const atraso = edad - PLAZO_ESCANEO
    if (atraso > 0) {
      eventos.push({
        fecha: sumarDias(fecha, PLAZO_ESCANEO + 1),
        autor: 'CobroSync',
        area: 'sistema',
        tipo: 'aviso',
        texto: `Escaneo atrasado: se avisó a ${sucursal.gerente} (gerente de ${sucursal.nombre})`,
      })
    }
    if (edad > 21) {
      eventos.push({
        fecha: sumarDias(fecha, 22),
        autor: 'CobroSync',
        area: 'sistema',
        tipo: 'aviso',
        texto: 'Más de 21 días sin legajo completo: se avisó a la gerencia general',
      })
    }
    if (edad > 2 && azar() < 0.45) {
      const fechaAviso = sumarDias(fecha, entre(1, Math.min(edad, 6)))
      compromiso = { fecha: sumarDias(fechaAviso, entre(3, 12)), motivo: elegir(MOTIVOS_COMPROMISO) }
      eventos.push({
        fecha: fechaAviso,
        autor: persona,
        area: 'sucursal',
        tipo: 'compromiso',
        texto: `${compromiso.motivo}. Se compromete a subirlo el ${compromiso.fecha.split('-').reverse().join('/')}.`,
      })
    }
  }

  const estado = fechaCobro ? 'cobrada' : fechaPresentacion ? 'presentada' : fechaDrive ? 'en_gestion' : 'pendiente_drive'

  return {
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
    subidoPor: fechaDrive ? persona : null,
    fechaPresentacion,
    vencimiento,
    fechaCobro,
    estado,
    ncReferencia: null,
    ncInformada: null,
    compromiso,
    observaciones: '',
    documentos,
    eventos: eventos.sort((a, b) => a.fecha.localeCompare(b.fecha)),
    _persona: persona,
  }
}

for (let fecha = FECHA_INICIO; fecha <= FECHA_CORTE; fecha = sumarDias(fecha, 1)) {
  if (!esDiaHabil(fecha)) continue
  // A fin de mes se factura mucho más
  const dia = Number(fecha.slice(8, 10))
  const cantidad = dia >= 25 ? entre(4, 9) : entre(1, 3)

  for (let i = 0; i < cantidad; i++) {
    const factura = crearFactura(fecha)
    comprobantes.push(factura)
    const edad = diffDias(fecha, FECHA_CORTE)

    // ~5 % se anula con una nota de crédito por el mismo importe
    if (factura.estado !== 'cobrada' && edad > 5 && azar() < 0.05) {
      const informada = azar() < 0.55
      const fechaNc = sumarDias(fecha, entre(1, Math.min(10, edad)))
      factura.estado = 'anulada'
      factura.fechaPresentacion = null
      factura.vencimiento = null
      factura.compromiso = null
      factura.eventos = factura.eventos.filter((e) => e.tipo !== 'aviso')
      factura.observaciones = elegir([
        'Factura emitida a la compañía equivocada',
        'Error en el importe: se refactura',
        'Factura vencida, se refactura con fecha actual',
      ])
      const nc = {
        id: `nc-${comprobantes.length + 1}`,
        ref: String((ref += 1)),
        tipo: 'NC',
        fecha: fechaNc,
        sucursal: factura.sucursal,
        puntoVenta: factura.puntoVenta,
        numero: nuevoNumero(factura.puntoVenta),
        aseguradoraId: factura.aseguradoraId,
        siniestro: factura.siniestro,
        patente: factura.patente,
        total: -factura.total,
        fechaDrive: null,
        subidoPor: null,
        fechaPresentacion: null,
        vencimiento: null,
        fechaCobro: null,
        estado: 'nota_credito',
        ncReferencia: factura.id,
        // Las viejas ya las revisó auditoría; las recientes pueden estar sin informar
        ncInformada: informada || diffDias(fechaNc, FECHA_CORTE) > 90,
        compromiso: null,
        observaciones: factura.observaciones,
        documentos: [],
        eventos: informada
          ? [{ fecha: fechaNc, autor: factura._persona, area: 'sucursal', tipo: 'nota_credito', texto: `Informó la NC: ${factura.observaciones.toLowerCase()}` }]
          : [],
      }
      comprobantes.push(nc)
    }
  }
}
for (const c of comprobantes) delete c._persona

// ── Cobros previstos ─────────────────────────────────────────────────────────
const cobrosPrevistos = []
for (const c of comprobantes) {
  if (c.tipo !== 'FC') continue
  // Lo que se ve "en proceso de pago" en los portales de las compañías
  if (c.estado === 'presentada' && azar() < 0.35) {
    const base = c.vencimiento >= FECHA_CORTE ? c.vencimiento : FECHA_CORTE
    cobrosPrevistos.push({
      id: `cp-${cobrosPrevistos.length + 1}`,
      comprobanteId: c.id,
      aseguradoraId: c.aseguradoraId,
      fechaIngreso: sumarDias(base, entre(1, 8)),
      monto: c.total,
      estado: 'informado',
    })
  }
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
const meta = {
  fechaCorte: FECHA_CORTE,
  sucursales: SUCURSALES.map(({ nombre, puntoVenta, gerente, personas }) => ({ nombre, puntoVenta, gerente, personas })),
}

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
