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
const expo = (media) => -Math.log(1 - azar()) * media
/** Normal estándar (Box-Muller), para montos con distribución log-normal */
const normal = () => Math.sqrt(-2 * Math.log(1 - azar())) * Math.cos(2 * Math.PI * azar())
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

// ── Catálogos ───────────────────────────────────────────────────────────────
// Compañías y sucursales son las reales; sus PESOS, demoras y plazos salen de las
// estadísticas de la planilla de control (no de sus filas).
// Plazo de pago desde la presentación: 30 días, salvo Federación Patronal (7).
const ASEGURADORAS = [
  { id: 'fed-patronal', nombre: 'Federación Patronal', plazoPagoDias: 7, peso: 2761, siniestro: '999-9-999999' },
  { id: 'allianz', nombre: 'Allianz', plazoPagoDias: 30, peso: 972, siniestro: '99999999999' },
  { id: 'san-cristobal', nombre: 'San Cristóbal', plazoPagoDias: 30, peso: 858, siniestro: '99999999999' },
  { id: 'sancor', nombre: 'Sancor', plazoPagoDias: 30, peso: 836, siniestro: '9999999999' },
  { id: 'zurich', nombre: 'Zurich', plazoPagoDias: 30, peso: 636, siniestro: '99999999' },
  { id: 'la-segunda', nombre: 'La Segunda', plazoPagoDias: 30, peso: 616, siniestro: '9999999' },
  { id: 'rivadavia', nombre: 'Rivadavia', plazoPagoDias: 30, peso: 570, siniestro: '99 99 999999' },
  { id: 'la-caja', nombre: 'La Caja', plazoPagoDias: 30, peso: 266, siniestro: '9999-9999999' },
  { id: 'rda', nombre: 'RDA', plazoPagoDias: 30, peso: 205, siniestro: 'AA 999999' },
  { id: 'nacion', nombre: 'Nación Seguros', plazoPagoDias: 30, peso: 149, siniestro: '999999' },
  { id: 'mapfre', nombre: 'Mapfre', plazoPagoDias: 30, peso: 145, siniestro: '99999999999' },
  { id: 'smg', nombre: 'SMG', plazoPagoDias: 30, peso: 134, siniestro: '99999999' },
  { id: 'iutrace', nombre: 'Iutrace', plazoPagoDias: 30, peso: 110, siniestro: '99999999999' },
  { id: 'mercantil-andina', nombre: 'Mercantil Andina', plazoPagoDias: 30, peso: 104, siniestro: '999999999999' },
  { id: 'galicia', nombre: 'Galicia Seguros', plazoPagoDias: 30, peso: 50, siniestro: '999999999999' },
  { id: 'segurcoop', nombre: 'Segurcoop', plazoPagoDias: 30, peso: 42, siniestro: '999999' },
  { id: 'meridional', nombre: 'Meridional', plazoPagoDias: 30, peso: 39, siniestro: '9999-99999999999' },
  { id: 'barbuss', nombre: 'Barbuss', plazoPagoDias: 30, peso: 32, siniestro: '999999' },
  { id: 'holando', nombre: 'Holando Sudamericana', plazoPagoDias: 30, peso: 32, siniestro: '99999999' },
  { id: 'chubb', nombre: 'Chubb', plazoPagoDias: 30, peso: 24, siniestro: '99999999' },
  { id: 'victoria', nombre: 'Victoria', plazoPagoDias: 30, peso: 11, siniestro: '99999999' },
  { id: 'parana', nombre: 'Paraná Seguros', plazoPagoDias: 30, peso: 11, siniestro: '99999999' },
]

// Demoras medidas en la planilla (días entre la factura y la subida al Drive):
// `demora`: media de los que llegan a tiempo · `atraso`: % que pasa los 7 días
// `presentacion`: días promedio entre la subida y la presentación.
const SUCURSALES = [
  { nombre: 'Alvarez Thomas', pvs: [{ pv: 21, peso: 3389 }, { pv: 30, peso: 189 }], peso: 3578, demora: 1.8, atraso: 0.1, presentacion: 3.1, errores: 0.05 },
  { nombre: 'Triunvirato', pvs: [{ pv: 19, peso: 3291 }, { pv: 29, peso: 65 }], peso: 3356, demora: 1.6, atraso: 0.04, presentacion: 1.8, errores: 0.04 },
  { nombre: 'Vicente Lopez', pvs: [{ pv: 23, peso: 719 }, { pv: 43, peso: 203 }, { pv: 31, peso: 61 }, { pv: 44, peso: 18 }], peso: 1001, demora: 1.3, atraso: 0.05, presentacion: 1.5, errores: 0.04 },
  { nombre: 'Rocamora', pvs: [{ pv: 35, peso: 485 }, { pv: 37, peso: 65 }], peso: 551, demora: 1.6, atraso: 0.09, presentacion: 2, errores: 0.05 },
  { nombre: 'San Miguel', pvs: [{ pv: 50, peso: 16 }, { pv: 49, peso: 92 }], peso: 108, demora: 0.2, atraso: 0.01, presentacion: 3.4, errores: 0.03 },
  { nombre: 'Warnes', pvs: [{ pv: 16, peso: 39 }, { pv: 14, peso: 6 }], peso: 45, demora: 2, atraso: 0.18, presentacion: 6.6, errores: 0.08 },
].map((s) => ({
  ...s,
  // Personas genéricas: en la demo no se usan nombres reales de empleados
  gerente: `Gerente de ${s.nombre}`,
  personas: [`Facturación ${s.nombre} 1`, `Facturación ${s.nombre} 2`],
}))

// Facturas por mes y peso de cada día del mes (de la planilla: pico a fin de mes)
const FACTURAS_POR_MES = { 1: 647, 2: 480, 3: 756, 4: 862, 5: 941, 6: 1079, 7: 924, 8: 903, 9: 1064, 10: 977 }
const PESO_DIA = [24, 45, 58, 64, 80, 135, 164, 137, 202, 190, 247, 179, 339, 360, 243, 335, 210, 195, 212, 254, 306, 271, 283, 286, 286, 412, 458, 499, 886, 863, 416]

const AUDITORIA = ['Carola B.', 'Melina']

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
const letra = () => elegir(LETRAS)
// Patentes con formato real: AA999AA (nuevas) o AAA999 (viejas), con valores al azar
const patente = () =>
  azar() < 0.8 ? `${letra()}${letra()}${entre(100, 999)}${letra()}${letra()}` : `${letra()}${letra()}${letra()}${entre(100, 999)}`
// Siniestro con el formato de cada compañía (9 = dígito, A = letra) y números al azar
const siniestroCon = (formato) => formato.replace(/9/g, () => String(entre(0, 9))).replace(/A/g, letra)
const TIPOS_DOC = ['factura', 'orden_reparacion', 'remito', 'conformidad']
const NOMBRE_DOC = { factura: 'factura', orden_reparacion: 'orden de reparación', remito: 'remito', conformidad: 'conformidad' }

// ── Generación de comprobantes ───────────────────────────────────────────────
const comprobantes = []
// Los números de comprobante y las referencias se asignan al final, en orden de fecha

function crearFactura(fecha) {
  const sucursal = elegirPonderado(SUCURSALES)
  const aseguradora = elegirPonderado(ASEGURADORAS)
  const persona = elegir(sucursal.personas)
  const puntoVenta = elegirPonderado(sucursal.pvs).pv
  const edad = diffDias(fecha, FECHA_CORTE)
  const eventos = []
  const siniestro = siniestroCon(aseguradora.siniestro)
  const nombreArchivo = (tipo) => `${tipo}_${siniestro.replace(/\W/g, '')}.pdf`

  // Montos log-normales con la misma forma que la planilla (mediana cercana a $1 millón)
  const total = Math.round(Math.min(25_000_000, Math.max(60_000, 950_000 * Math.exp(1.05 * normal()))) * 100) / 100

  // 1) Cuándo sube la sucursal los documentos (la mayoría el mismo día o a los pocos días)
  const seAtrasa = azar() < sucursal.atraso
  const demora = seAtrasa ? entre(8, 40) : Math.min(7, Math.floor(expo(sucursal.demora)))
  let fechaDrive = sumarDias(fecha, demora)
  if (fechaDrive > FECHA_CORTE) fechaDrive = null

  // 2) Qué subió y en qué estado
  let documentos
  if (!fechaDrive) {
    documentos = TIPOS_DOC.map((tipo) => ({ tipo, estado: tipo === 'factura' ? 'ok' : 'faltante' }))
  } else {
    // Los legajos viejos ya se corrigieron casi todos; los recientes tienen más problemas.
    const factor = edad > 90 ? 0.01 : edad > 45 ? 0.08 : edad > 21 ? 0.5 : 1
    documentos = TIPOS_DOC.map((tipo) => {
      if (tipo === 'factura' || azar() >= sucursal.errores * factor) {
        return { tipo, estado: 'ok', archivo: nombreArchivo(tipo) }
      }
      const estado = elegir(tipo === 'remito' ? ['faltante', 'ilegible'] : ['faltante', 'ilegible', 'sin_firma'])
      return estado === 'faltante' ? { tipo, estado } : { tipo, estado, archivo: nombreArchivo(tipo) }
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

  // Si lo que subió tiene problemas, auditoría lo observa al día siguiente
  const conProblemas = documentos.filter((d) => d.estado === 'ilegible' || d.estado === 'sin_firma')
  if (fechaDrive && conProblemas.length > 0 && sumarDias(fechaDrive, 1) <= FECHA_CORTE) {
    eventos.push({
      fecha: sumarDias(fechaDrive, 1),
      autor: elegir(AUDITORIA),
      area: 'auditoria',
      tipo: 'rechazo',
      texto: `Observación: ${conProblemas.map((d) => `${NOMBRE_DOC[d.tipo]} ${d.estado === 'ilegible' ? 'ilegible' : 'sin firma'}`).join(', ')}. Por favor, volver a subir.`,
    })
  }

  // 3) Algunos legajos completos fueron rechazados por la compañía y corregidos después
  let fechaPresentacion = null
  if (completo && fechaDrive) {
    let p = sumarDias(fechaDrive, Math.floor(expo(sucursal.presentacion)))
    let rechazadoSinResolver = false
    // Más rechazos en las últimas semanas, que todavía pueden estar sin respuesta
    if (p <= FECHA_CORTE && azar() < (edad < 30 ? 0.18 : 0.08)) {
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
      // Algunos rechazos recientes todavía no tienen respuesta de la sucursal
      if (respuesta <= FECHA_CORTE && !(edad < 30 && azar() < 0.5)) {
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
    // Muchas compañías pagan antes del vencimiento (así se ve en la planilla)
    const r = azar()
    const desvio = r < 0.1 ? entre(-28, -15) : r < 0.5 ? entre(-14, -3) : r < 0.9 ? entre(-2, 3) : entre(4, 20)
    const c = sumarDias(vencimiento, Math.max(-diffDias(fechaPresentacion, vencimiento) + 1, desvio))
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
        texto: `Pasaron ${PLAZO_ESCANEO} días sin legajo completo: se avisó a ${sucursal.gerente} (gerente de ${sucursal.nombre})`,
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
    ref: '0',
    tipo: 'FC',
    fecha,
    sucursal: sucursal.nombre,
    puntoVenta,
    numero: 0,
    aseguradoraId: aseguradora.id,
    siniestro,
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

// Fechas de factura: cantidad por mes y peso de cada día como en la planilla (sin domingos)
const fechasDeFactura = []
for (const [mes, cantidad] of Object.entries(FACTURAS_POR_MES)) {
  const diasDelMes = new Date(Date.UTC(2026, Number(mes), 0)).getUTCDate()
  const dias = PESO_DIA.slice(0, diasDelMes).map((peso, i) => ({ dia: i + 1, peso }))
  for (let i = 0; i < cantidad; i++) {
    let fecha
    do {
      fecha = `2026-${String(mes).padStart(2, '0')}-${String(elegirPonderado(dias).dia).padStart(2, '0')}`
    } while (new Date(Date.parse(fecha)).getUTCDay() === 0 || fecha === '2026-01-01' || fecha > FECHA_CORTE)
    fechasDeFactura.push(fecha)
  }
}
fechasDeFactura.sort()

for (const fecha of fechasDeFactura) {
  const factura = crearFactura(fecha)
  comprobantes.push(factura)
  const edad = diffDias(fecha, FECHA_CORTE)

  // ~3 % se anula con una nota de crédito por el mismo importe (como en la planilla)
  if (edad > 5 && azar() < 0.03) {
    const informada = azar() < 0.55
    const fechaNc = sumarDias(fecha, entre(1, Math.min(10, edad)))
    factura.estado = 'anulada'
    factura.fechaPresentacion = null
    factura.vencimiento = null
    factura.fechaCobro = null
    factura.compromiso = null
    factura.eventos = factura.eventos.filter((e) => e.tipo !== 'aviso')
    factura.observaciones = elegir([
      'Factura emitida a la compañía equivocada',
      'Error en el importe: se refactura',
      'Factura vencida, se refactura con fecha actual',
    ])
    const nc = {
      id: `nc-${comprobantes.length + 1}`,
      ref: '0',
      tipo: 'NC',
      fecha: fechaNc,
      sucursal: factura.sucursal,
      puntoVenta: factura.puntoVenta,
      numero: 0,
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
for (const c of comprobantes) delete c._persona

// Numeración correlativa por punto de venta y referencias crecientes, en orden de fecha
comprobantes.sort((a, b) => a.fecha.localeCompare(b.fecha))
const numeradores = {}
let ref = 6_960_000
for (const c of comprobantes) {
  numeradores[c.puntoVenta] ??= entre(3000, 9000)
  c.numero = ++numeradores[c.puntoVenta]
  ref += entre(1, 3)
  c.ref = String(ref)
}

// Para que el archivo no pese de más: lo viejo y ya cobrado guarda solo lo relevante
for (const c of comprobantes) {
  if (c.estado === 'cobrada' && diffDias(c.fecha, FECHA_CORTE) > 60) {
    c.eventos = c.eventos.filter((e) => e.tipo === 'rechazo' || e.tipo === 'mensaje')
    c.documentos = c.documentos.map(({ tipo, estado }) => ({ tipo, estado }))
  }
}

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
  sucursales: SUCURSALES.map(({ nombre, pvs, gerente, personas }) => ({ nombre, puntoVenta: pvs[0].pv, gerente, personas })),
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
