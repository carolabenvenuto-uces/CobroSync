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
// `demora`: media de los que llegan a tiempo · `atraso`: probabilidad de pasar los 7 días
// `cola`: cuánto se estira un atraso (días promedio extra).
// `olvido`: probabilidad de que la factura quede sin subir hasta hoy. Reproduce las
//   facturas sin presentar de la planilla (filas en lila): la mayoría del último mes,
//   pero también algunas de hace meses, casi todas de Alvarez Thomas.
// `presentacion`: días promedio entre la subida y la presentación.
// `errores`: probabilidad de que un documento subido esté ilegible o sin firma.
const SUCURSALES = [
  { nombre: 'Alvarez Thomas', pvs: [{ pv: 21, peso: 3389 }, { pv: 30, peso: 189 }], peso: 3578, demora: 1.8, atraso: 0.1, cola: 8, olvido: 0.012, presentacion: 3.1, errores: 0.012 },
  { nombre: 'Triunvirato', pvs: [{ pv: 19, peso: 3291 }, { pv: 29, peso: 65 }], peso: 3356, demora: 1.6, atraso: 0.04, cola: 6, olvido: 0.002, presentacion: 1.8, errores: 0.008 },
  { nombre: 'Vicente Lopez', pvs: [{ pv: 23, peso: 719 }, { pv: 43, peso: 203 }, { pv: 31, peso: 61 }, { pv: 44, peso: 18 }], peso: 1001, demora: 1.3, atraso: 0.05, cola: 6, olvido: 0.002, presentacion: 1.5, errores: 0.008 },
  { nombre: 'Rocamora', pvs: [{ pv: 35, peso: 485 }, { pv: 37, peso: 65 }], peso: 551, demora: 1.6, atraso: 0.09, cola: 6, olvido: 0.002, presentacion: 2, errores: 0.01 },
  { nombre: 'San Miguel', pvs: [{ pv: 50, peso: 16 }, { pv: 49, peso: 92 }], peso: 108, demora: 0.2, atraso: 0, cola: 3, olvido: 0, presentacion: 3.4, errores: 0.005 },
  { nombre: 'Warnes', pvs: [{ pv: 16, peso: 39 }, { pv: 14, peso: 6 }], peso: 45, demora: 2, atraso: 0.18, cola: 8, olvido: 0.01, presentacion: 6.6, errores: 0.02 },
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

// Motivos con los que Auditoría (o la compañía) observa un documento
const MOTIVOS_OBSERVACION = {
  orden: ['Ilegible o cortado', 'No corresponde a esta factura', 'Incompleto'],
  firma: ['Sin firma del cliente', 'Ilegible o cortado'],
  factura: ['Ilegible o cortado'],
}
const MOTIVOS_RECHAZO_CIA = ['la compañía no puede leer el escaneo', 'falta la firma del cliente en la orden', 'la orden no coincide con el siniestro']

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
// Lo que Auditoría tilda en cada legajo
const TIPOS_DOC = ['factura', 'orden', 'firma']
const NOMBRE_DOC = { factura: 'factura', orden: 'orden de reparación o repuestos', firma: 'firma del cliente' }

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
  // A fin de mes se factura mucho y el escaneo se demora más
  const finDeMes = Number(fecha.slice(8, 10)) >= 25
  const olvidada = azar() < sucursal.olvido
  const demora = olvidada
    ? 9999
    : seAtrasa
    ? 8 + Math.floor(expo(sucursal.cola))
    : Math.min(7, Math.floor(expo(sucursal.demora * (finDeMes ? 1.5 : 1))))
  let fechaDrive = sumarDias(fecha, demora)
  if (fechaDrive > FECHA_CORTE) fechaDrive = null

  // 2) Qué subió y en qué estado
  let documentos
  if (!fechaDrive) {
    documentos = TIPOS_DOC.map((tipo) => ({ tipo, estado: 'faltante' }))
  } else {
    // Auditoría revisa al día siguiente de la subida: lo subido ayer o hoy está "para revisar".
    const revisado = diffDias(fechaDrive, FECHA_CORTE) >= 1
    // Los legajos viejos ya se corrigieron casi todos; los recientes tienen más observaciones.
    const factor = edad > 90 ? 0.01 : edad > 45 ? 0.08 : edad > 21 ? 0.5 : 1
    documentos = TIPOS_DOC.map((tipo) => {
      const archivo = nombreArchivo(tipo)
      if (!revisado) return { tipo, estado: 'en_revision', archivo }
      if (azar() >= sucursal.errores * 1.5 * factor) return { tipo, estado: 'ok', archivo }
      return { tipo, estado: 'observado', archivo, motivo: elegir(MOTIVOS_OBSERVACION[tipo]) }
    })
    eventos.push({ fecha: fechaDrive, autor: persona, area: 'sucursal', tipo: 'subida', texto: 'Subió la factura, la orden y la firma' })
  }
  let completo = documentos.every((d) => d.estado === 'ok')

  // Si Auditoría observó algo, queda en la conversación
  const observados = documentos.filter((d) => d.estado === 'observado')
  if (fechaDrive && observados.length > 0) {
    eventos.push({
      fecha: sumarDias(fechaDrive, 1),
      autor: elegir(AUDITORIA),
      area: 'auditoria',
      tipo: 'rechazo',
      texto: `Observado: ${observados.map((d) => `${NOMBRE_DOC[d.tipo]} (${d.motivo.toLowerCase()})`).join(', ')}. Por favor, volver a subir.`,
    })
  } else if (fechaDrive && completo) {
    eventos.push({ fecha: sumarDias(fechaDrive, 1), autor: elegir(AUDITORIA), area: 'auditoria', tipo: 'mensaje', texto: 'Documentación revisada y aprobada' })
  }

  // 3) Algunos legajos completos fueron rechazados por la compañía y corregidos después
  let fechaPresentacion = null
  if (completo && fechaDrive) {
    // Auditoría presenta rápido una vez que el legajo está completo (en la planilla, casi nada queda "P. Pend.")
    let p = sumarDias(fechaDrive, Math.floor(expo(0.7)))
    let rechazadoSinResolver = false
    // Más rechazos en las últimas semanas, que todavía pueden estar sin respuesta
    if (p <= FECHA_CORTE && azar() < (edad < 30 ? 0.05 : 0.04)) {
      const tipo = elegir(['orden', 'firma'])
      const motivo = elegir(MOTIVOS_OBSERVACION[tipo])
      eventos.push({
        fecha: p,
        autor: elegir(AUDITORIA),
        area: 'auditoria',
        tipo: 'rechazo',
        texto: `Rechazo de ${aseguradora.nombre}: ${elegir(MOTIVOS_RECHAZO_CIA)}. Hay que reemplazar la ${NOMBRE_DOC[tipo]}.`,
      })
      const respuesta = sumarDias(p, entre(1, 6))
      // Algunos rechazos recientes todavía no tienen respuesta de la sucursal
      if (respuesta <= FECHA_CORTE && !(edad < 30 && azar() < 0.3)) {
        eventos.push({ fecha: respuesta, autor: persona, area: 'sucursal', tipo: 'mensaje', texto: elegir(RESPUESTAS_SUCURSAL) })
        p = sumarDias(respuesta, entre(0, 2))
      } else {
        // sigue rechazado hoy
        documentos = documentos.map((d) => (d.tipo === tipo ? { ...d, estado: 'observado', motivo } : d))
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

  // Día en que Auditoría aprobó toda la documentación (al día siguiente de la subida, o al presentar)
  const fechaAprobacion =
    completo && fechaDrive
      ? fechaPresentacion && fechaPresentacion < sumarDias(fechaDrive, 1)
        ? fechaPresentacion
        : sumarDias(fechaDrive, 1) > FECHA_CORTE
          ? FECHA_CORTE
          : sumarDias(fechaDrive, 1)
      : null

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
    fechaAprobacion,
    fechaPresentacion,
    vencimiento,
    fechaCobro,
    estado,
    ncReferencia: null,
    ncInformada: null,
    compromiso,
    reclamos: [],
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
      fechaAprobacion: null,
      fechaPresentacion: null,
      vencimiento: null,
      fechaCobro: null,
      estado: 'nota_credito',
      ncReferencia: factura.id,
      // Las viejas ya las revisó auditoría; las recientes pueden estar sin informar
      ncInformada: informada || diffDias(fechaNc, FECHA_CORTE) > 90,
      compromiso: null,
      reclamos: [],
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

// Reclamos a las compañías: la mayoría de las vencidas ya se reclamó alguna vez
for (const c of comprobantes) {
  if (c.tipo !== 'FC' || c.estado !== 'presentada' || !c.vencimiento || c.vencimiento >= FECHA_CORTE) continue
  const diasVencida = diffDias(c.vencimiento, FECHA_CORTE)
  if (azar() < 0.3 && diasVencida < 20) continue // todavía sin reclamar
  // Se reclama cada 2 o 3 semanas: la mayoría lleva 1 o 2 reclamos; las más viejas, 3 o más
  const cantidad = Math.min(4, 1 + Math.floor(diasVencida / entre(20, 40)))
  for (let i = 0; i < cantidad; i++) {
    const fecha = sumarDias(c.vencimiento, 2 + i * entre(14, 21))
    if (fecha > FECHA_CORTE) break
    const medio = elegir(['mail', 'mail', 'portal', 'telefono'])
    const autor = elegir(AUDITORIA)
    c.reclamos.push({ fecha, medio, autor, nota: i === 0 ? 'Se pidió fecha de pago' : 'Sin respuesta: se reitera el reclamo' })
    c.eventos.push({ fecha, autor, area: 'auditoria', tipo: 'reclamo', texto: `Reclamo ${i + 1} a la compañía por ${medio}` })
  }
}

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

// ── Facturación parcial y notas de crédito parciales ─────────────────────────
// Con su propio generador aleatorio, para no cambiar el resto de los datos de ejemplo.
{
  const azar2 = crearAleatorio(SEMILLA + 1)
  const entre2 = (min, max) => min + Math.floor(azar2() * (max - min + 1))
  const ultimoNumero = {}
  let ultimaRef = 0
  for (const c of comprobantes) {
    ultimoNumero[c.puntoVenta] = Math.max(ultimoNumero[c.puntoVenta] ?? 0, c.numero)
    ultimaRef = Math.max(ultimaRef, Number(c.ref))
  }
  const facturas = comprobantes.filter((c) => c.tipo === 'FC' && c.estado !== 'anulada')

  // 1) Mismo siniestro, varias facturas: los repuestos que faltaban se facturan días después
  const nuevas = []
  for (const original of facturas) {
    if (azar2() > 0.025 || original.estado === 'anulada') continue
    const fecha = sumarDias(original.fecha, entre2(3, 12))
    if (fecha > FECHA_CORTE) continue
    // Sigue el mismo recorrido que la original, unos días después
    const d = diffDias(original.fecha, fecha)
    const mover = (x) => (x && sumarDias(x, d) <= FECHA_CORTE ? sumarDias(x, d) : null)
    const fechaDrive = mover(original.fechaDrive)
    const fechaPresentacion = original.estado === 'anulada' ? null : mover(original.fechaPresentacion)
    const fechaCobro = mover(original.fechaCobro)
    const estado = fechaCobro ? 'cobrada' : fechaPresentacion ? 'presentada' : fechaDrive ? 'en_gestion' : 'pendiente_drive'
    // La orden y la firma son las mismas de la original; la factura es propia
    const documentos = original.documentos.map((doc) =>
      doc.tipo === 'factura' ? (fechaDrive ? { ...doc } : { tipo: 'factura', estado: 'faltante' }) : { ...doc },
    )
    const parcial = {
      ...original,
      id: `${original.id}-p2`,
      ref: String(++ultimaRef),
      fecha,
      numero: ++ultimoNumero[original.puntoVenta],
      total: Math.round(original.total * (0.15 + azar2() * 0.3) * 100) / 100,
      fechaDrive,
      subidoPor: fechaDrive ? original.subidoPor : null,
      fechaAprobacion: mover(original.fechaAprobacion),
      fechaPresentacion,
      vencimiento: fechaPresentacion ? sumarDias(original.vencimiento ?? fechaPresentacion, d) : null,
      fechaCobro,
      estado,
      compromiso: null,
      reclamos: estado === 'presentada' ? original.reclamos.map((r) => ({ ...r })) : [],
      observaciones: 'Repuestos que faltaban de la misma orden',
      documentos,
      eventos: [],
    }
    nuevas.push(parcial)
  }
  comprobantes.push(...nuevas)

  // 2) Notas de crédito parciales (un repuesto que no se usó, una diferencia de precio)
  for (const f of facturas) {
    if (azar2() > 0.02 || f.estado === 'pendiente_drive') continue
    const importe = Math.round(f.total * (0.05 + azar2() * 0.2) * 100) / 100
    const fecha = sumarDias(f.fecha, entre2(5, 20))
    if (fecha > FECHA_CORTE) continue
    const nc = {
      ...f,
      id: `${f.id}-ncp`,
      ref: String(++ultimaRef),
      tipo: 'NC',
      fecha,
      numero: ++ultimoNumero[f.puntoVenta],
      total: -importe,
      fechaDrive: null, subidoPor: null, fechaAprobacion: null, fechaPresentacion: null, vencimiento: null, fechaCobro: null,
      estado: 'nota_credito',
      ncReferencia: f.id,
      ncInformada: true,
      compromiso: null, reclamos: [], documentos: [],
      observaciones: 'Nota de crédito parcial: repuesto que no se utilizó',
      eventos: [{ fecha, autor: 'Facturación', area: 'sucursal', tipo: 'nota_credito', texto: 'Informó una nota de crédito parcial: repuesto que no se utilizó' }],
    }
    f.acreditado = importe
    f.eventos.push({ fecha, autor: 'Auditoría', area: 'auditoria', tipo: 'nota_credito', texto: `Nota de crédito parcial por $ ${importe.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` })
    comprobantes.push(nc)
  }
  comprobantes.sort((a, b) => a.fecha.localeCompare(b.fecha))
}

// ── Escritura ────────────────────────────────────────────────────────────────
// Razón social, CUIT y plazo son datos públicos (pestaña "CP" de la planilla).
// Los correos son inventados: los reales se ven solo al cargar la planilla propia.
const DATOS_FISCALES = {
  'fed-patronal': ['FEDERACION PATRONAL SEGUROS SAU', '33707366589'],
  allianz: ['ALLIANZ ARGENTINA COMPAÑIA DE SEGUROS', '30500037217'],
  'san-cristobal': ['SAN CRISTOBAL S.M.S.G.', '34500045339'],
  sancor: ['SANCOR COOPERATIVA DE SEGUROS LIMITADA', '30500049460'],
  zurich: ['ZURICH ARGENTINA COMPAÑIA DE SEG', '30500049770'],
  'la-segunda': ['LA SEGUNDA COOP. LTDA.DE SEGUROS GENERALES', '30500017704'],
  rivadavia: ['SEGUROS BERNARDINO RIVADAVIA COOP.LTDA', '30500050310'],
  'la-caja': ['CAJA DE SEGUROS', '30663205621'],
  rda: ['RDA RENTING S A', '30712257357'],
  nacion: ['NACION SEGUROS S.A.', '30678561165'],
  mapfre: ['MAPFRE ARGENTINA SEGUROS S.A.', '30500007539'],
  smg: ['S.M.G. COMPAÑIA ARGENTINA DE SEGUROS S.A.', '30500031960'],
  iutrace: ['IUTRACE S.A.S.', '30717437558'],
  'mercantil-andina': ['COMPAÑIA DE SEGUROS LA MERCANTIL ANDINA S.A.', '30500036911'],
  galicia: ['SEGUROS GALICIA S. A.', '30500000127'],
  segurcoop: ['SEGURCOOP COOPERATIVA DE SEGUROS LIMITADA', '30500057277'],
  meridional: ['LA MERIDIONAL CIA. ARGENTINA DE SEGUROS SA', '30500051163'],
  barbuss: ['BARBUSS RISK SEGUROS ARGENTINA S.A.', '30500017011'],
  holando: ['LA HOLANDO SUDAMERICANA CIA DE SEGS. S.A.', '33500038069'],
  chubb: ['CHUBB SEGUROS ARGENTINA S.A.', '30500016260'],
  victoria: ['COMPAÑIA DE SEGUROS VICTORIA S.A.', '30500032266'],
  parana: ['PARANA SOCIEDAD ANONIMA DE SEGUROS', '30500057102'],
}
const aseguradoras = ASEGURADORAS.map(({ id, nombre, plazoPagoDias }) => ({
  id,
  nombre,
  razonSocial: DATOS_FISCALES[id]?.[0] ?? nombre.toUpperCase(),
  cuit: DATOS_FISCALES[id]?.[1] ?? '',
  email: `facturacion@${id}-seguros.example`,
  emailReclamos: `cobranzas@${id}-seguros.example`,
  plazoPagoDias,
}))
const meta = {
  fechaCorte: FECHA_CORTE,
  sucursales: SUCURSALES.map(({ nombre, pvs, gerente, personas }) => ({
    nombre,
    puntoVenta: pvs[0].pv,
    puntosVenta: pvs.map((p) => p.pv),
    gerente,
    personas,
  })),
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
