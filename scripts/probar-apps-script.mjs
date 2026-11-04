/**
 * Prueba de google/Codigo.gs sin Google: simula la planilla, Drive, el correo y las cuentas,
 * y recorre un día de trabajo completo con los tres roles. Corre en GitHub Actions
 * (npm run test:apps-script) y también en cualquier compu con Node.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const codigo = readFileSync(join(raiz, 'google', 'Codigo.gs'), 'utf8')
const demo = JSON.parse(readFileSync(join(raiz, 'public', 'datos-demo', 'comprobantes.json'), 'utf8'))

// ── Google simulado ──────────────────────────────────────────────────────────
const comoTexto = (v) => (v === true ? 'TRUE' : v === false ? 'FALSE' : v instanceof Date ? v : String(v)) // celdas con formato texto
function crearHoja(nombre) {
  const filas = []
  const hoja = {
    nombre,
    filas,
    getLastRow: () => filas.length,
    getMaxRows: () => Math.max(1000, filas.length),
    setFrozenRows: () => {},
    appendRow: (v) => filas.push(v.map(comoTexto)),
    getRange: (r, c, nr = 1, nc = 1) => ({
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => filas[r - 1 + i]?.[c - 1 + j] ?? '')),
      setValues: (vals) => {
        vals.forEach((fila, i) => {
          filas[r - 1 + i] ??= []
          fila.forEach((v, j) => (filas[r - 1 + i][c - 1 + j] = comoTexto(v)))
        })
        return { setFontWeight: () => {} }
      },
      setNumberFormat: () => {},
      setFontWeight: () => {},
    }),
  }
  return hoja
}
const hojas = {}
const libro = {
  getSheetByName: (n) => hojas[n] ?? null,
  insertSheet: (n) => (hojas[n] = crearHoja(n)),
}
let emailActual = ''
const mails = []
const archivos = []
function carpeta(ruta) {
  const hijas = {}
  return {
    ruta,
    getFoldersByName: (n) => {
      let dado = false
      return { hasNext: () => !!hijas[n] && !dado, next: () => ((dado = true), hijas[n]) }
    },
    createFolder: (n) => (hijas[n] = carpeta(`${ruta}/${n}`)),
    createFile: (blob) => {
      archivos.push(`${ruta}/${blob.name}`)
      return { getName: () => blob.name, getUrl: () => `https://drive.google.com/${ruta}/${blob.name}`, setDescription: () => {} }
    },
  }
}
const raizDrive = carpeta('CobroSync')
const contexto = {
  SpreadsheetApp: { getActive: () => libro },
  Session: { getActiveUser: () => ({ getEmail: () => emailActual }) },
  LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
  DriveApp: { getFolderById: (id) => { if (id !== 'carpeta-123') throw new Error('carpeta inexistente'); return raizDrive } },
  Utilities: {
    formatDate: (d) => d.toISOString().slice(0, 10),
    newBlob: (_bytes, _mime, name) => ({ name }),
    base64Decode: (b) => Buffer.from(b, 'base64'),
  },
  MailApp: { sendEmail: (m) => mails.push(m) },
  ScriptApp: { getProjectTriggers: () => [], deleteTrigger: () => {}, newTrigger: () => ({ timeBased: () => ({ everyDays: () => ({ atHour: () => ({ create: () => {} }) }), onWeekDay: () => ({ atHour: () => ({ create: () => {} }) }) }) }), WeekDay: { MONDAY: 1 } },
  HtmlService: { createHtmlOutputFromFile: () => ({ setTitle: () => ({ addMetaTag: () => ({}) }) }) },
  console,
}
vm.createContext(contexto)
vm.runInContext(codigo, contexto)
const gs = (fn, ...args) => contexto[fn](...JSON.parse(JSON.stringify(args)))
const como = (email) => (emailActual = email)

// ── Pruebas ──────────────────────────────────────────────────────────────────
let fallas = 0
function prueba(nombre, fn) {
  try {
    fn()
    console.log(`ok   ${nombre}`)
  } catch (e) {
    fallas++
    console.log(`FAIL ${nombre}\n      ${e.message}`)
  }
}
const esperar = (cond, msg) => { if (!cond) throw new Error(msg) }
const falla = (fn, texto) => {
  try { fn() } catch (e) { esperar(e.message.includes(texto), `mensaje inesperado: ${e.message}`); return }
  throw new Error(`debía fallar con "${texto}"`)
}
const fila = (nombre, valores) => hojas[nombre].appendRow(valores)

prueba('configurarPlanilla crea todas las pestañas', () => {
  gs('configurarPlanilla')
  for (const n of ['Config', 'Usuarios', 'Sucursales', 'Aseguradoras', 'Comprobantes', 'CobrosPrevistos']) esperar(hojas[n], `falta ${n}`)
  esperar(hojas.Config.getLastRow() > 1, 'Config sin valores iniciales')
})

// Completar la configuración como lo haría Auditoría
const cfg = hojas.Config.filas
const setCfg = (clave, valor) => (cfg.find((f) => f[0] === clave)[1] = valor)
setCfg('carpetaDriveId', 'carpeta-123')
setCfg('correosGerencia', 'gerencia.general@svaauto.com.ar')
setCfg('avisosPorMail', 'SI')
fila('Usuarios', ['auditoria@svaauto.com.ar', 'Auditoría', 'Auditoría', ''])
fila('Usuarios', ['Rocamora@SVAAUTO.com.ar', 'Facturación Rocamora', 'Sucursal', 'rocamora '])
fila('Usuarios', ['gerencia.general@svaauto.com.ar', 'Gerencia General', 'Gerencia', ''])
fila('Sucursales', ['Rocamora', '35, 37', 'Gerente de Rocamora', 'gerente.rocamora@svaauto.com.ar'])
fila('Sucursales', ['Warnes', '16, 14', 'Gerente de Warnes', 'gerente.warnes@svaauto.com.ar'])

const lote = demo.filter((c) => c.sucursal === 'Rocamora' || c.sucursal === 'Warnes').slice(0, 400).map((c) => ({ ...c, id: `ref-${c.ref}`, eventos: [] })) // como llegan de la planilla: sin historial

prueba('una cuenta de afuera de la empresa no entra', () => {
  como('alguien@gmail.com')
  falla(() => gs('obtenerDatos'), 'cuenta de la empresa')
})
prueba('una cuenta de la empresa que no está en Usuarios no entra', () => {
  como('otro@svaauto.com.ar')
  falla(() => gs('obtenerDatos'), 'no tiene acceso')
})
prueba('Auditoría pasa la planilla y se guardan las facturas', () => {
  como('auditoria@svaauto.com.ar')
  const r = gs('sincronizarDesdePlanilla', lote)
  esperar(r.nuevas === lote.length && r.actualizadas === 0, JSON.stringify(r))
})
prueba('pasar la planilla otra vez no duplica y actualiza cobros', () => {
  const sinCobrar = lote.find((c) => c.tipo === 'FC' && c.estado === 'presentada')
  const otraVez = lote.map((c) => (c.id === sinCobrar.id ? { ...c, estado: 'cobrada', fechaCobro: '2026-11-03' } : c))
  const r = gs('sincronizarDesdePlanilla', otraVez)
  esperar(r.nuevas === 0 && r.actualizadas === 1, JSON.stringify(r))
  const leida = gs('obtenerDatos').datos.comprobantes.find((c) => c.id === sinCobrar.id)
  esperar(leida.estado === 'cobrada' && leida.fechaCobro === '2026-11-03', 'el cobro no se guardó')
})
prueba('los datos vuelven con el mismo formato que usa la aplicación', () => {
  const c = gs('obtenerDatos').datos.comprobantes.find((x) => x.tipo === 'FC')
  const original = lote.find((x) => x.id === c.id)
  esperar(typeof c.total === 'number' && c.total === original.total, `total ${c.total}`)
  esperar(typeof c.numero === 'number', 'numero no es número')
  esperar(typeof c.ref === 'string', 'ref no es texto')
  esperar(Array.isArray(c.documentos) && Array.isArray(c.eventos) && Array.isArray(c.reclamos), 'listas mal leídas')
  esperar(c.fecha === original.fecha, `fecha ${c.fecha}`)
})
prueba('la sucursal solo recibe sus facturas (aunque el nombre esté escrito distinto)', () => {
  como('rocamora@svaauto.com.ar')
  const d = gs('obtenerDatos')
  esperar(d.usuario.rol === 'sucursal', `rol ${d.usuario.rol}`)
  esperar(d.datos.comprobantes.length > 0, 'no recibió ninguna')
  esperar(d.datos.comprobantes.every((c) => c.sucursal === 'Rocamora'), 'recibió facturas de otra sucursal')
})
prueba('la sucursal carga documentos pero no puede cambiar el importe', () => {
  const c = gs('obtenerDatos').datos.comprobantes.find((x) => x.tipo === 'FC')
  const cambiado = { ...c, total: 1, documentos: c.documentos.map((d) => ({ ...d, estado: 'en_revision', archivo: 'x.pdf' })) }
  gs('guardarComprobante', cambiado)
  como('auditoria@svaauto.com.ar')
  const leido = gs('obtenerDatos').datos.comprobantes.find((x) => x.id === c.id)
  esperar(leido.total === c.total, 'la sucursal pudo cambiar el importe')
  esperar(leido.documentos.every((d) => d.estado === 'en_revision'), 'no se guardaron los documentos')
})
prueba('la sucursal no puede tocar facturas de otra sucursal', () => {
  como('auditoria@svaauto.com.ar')
  const ajena = gs('obtenerDatos').datos.comprobantes.find((x) => x.sucursal === 'Warnes')
  como('rocamora@svaauto.com.ar')
  falla(() => gs('guardarComprobante', { ...ajena, observaciones: 'x' }), 'otra sucursal')
  falla(() => gs('subirArchivo', ajena.id, 'factura', 'f.pdf', 'application/pdf', 'AAAA'), 'otra sucursal')
})
prueba('Gerencia solo consulta', () => {
  como('gerencia.general@svaauto.com.ar')
  const d = gs('obtenerDatos')
  esperar(d.usuario.rol === 'gerencia' && d.datos.comprobantes.length === lote.length, 'Gerencia no ve todo')
  falla(() => gs('guardarComprobante', d.datos.comprobantes[0]), 'solo puede consultar')
})
prueba('Auditoría aprueba y registra el cobro', () => {
  como('auditoria@svaauto.com.ar')
  const c = gs('obtenerDatos').datos.comprobantes.find((x) => x.estado === 'presentada')
  gs('guardarComprobante', { ...c, estado: 'cobrada', fechaCobro: '2026-11-04', eventos: [...c.eventos, { fecha: '2026-11-04', autor: 'Auditoría', area: 'auditoria', tipo: 'mensaje', texto: 'Cobro registrado' }] })
  const leido = gs('obtenerDatos').datos.comprobantes.find((x) => x.id === c.id)
  esperar(leido.estado === 'cobrada' && leido.eventos.at(-1).texto === 'Cobro registrado', 'no se guardó el cobro')
})
prueba('la sucursal sube un archivo y queda en Drive en la carpeta de la factura', () => {
  como('rocamora@svaauto.com.ar')
  const c = gs('obtenerDatos').datos.comprobantes.find((x) => x.tipo === 'FC')
  const r = gs('subirArchivo', c.id, 'firma', 'foto celular.jpg', 'image/jpeg', Buffer.from('hola').toString('base64'))
  esperar(r.url.startsWith('https://drive.google.com/'), 'sin link')
  esperar(archivos.at(-1).startsWith(`CobroSync/Rocamora/${c.fecha.slice(0, 7)}/FC ${c.puntoVenta}-`), archivos.at(-1))
})
prueba('Auditoría carga facturas nuevas del ERP y no se duplican', () => {
  como('auditoria@svaauto.com.ar')
  const nueva = { ...lote[0], id: 'erp-999', ref: '9999999' }
  esperar(gs('agregarComprobantes', [nueva, nueva]) === 1, 'duplicó o no agregó')
})
prueba('avisos diarios: un mail por gerente y no se repiten', () => {
  mails.length = 0
  gs('avisosDiarios')
  const destinatarios = mails.map((m) => m.to)
  esperar(destinatarios.includes('gerente.rocamora@svaauto.com.ar'), `mails a: ${destinatarios.join(', ')}`)
  esperar(new Set(destinatarios).size === destinatarios.length, 'más de un mail por persona')
  const antes = mails.length
  gs('avisosDiarios')
  esperar(mails.length === antes, 'se repitieron los avisos')
})
prueba('resumen semanal para cada gerente de sucursal', () => {
  mails.length = 0
  gs('resumenSemanal')
  esperar(mails.length === 2 && mails.every((m) => m.subject.includes('Resumen semanal')), `${mails.length} mails`)
})
prueba('con los avisos desactivados no sale ningún mail', () => {
  setCfg('avisosPorMail', 'NO')
  mails.length = 0
  gs('avisosDiarios')
  gs('resumenSemanal')
  esperar(mails.length === 0, 'salieron mails')
})
prueba('instalarDisparadores no falla', () => gs('instalarDisparadores'))

if (fallas) process.exit(1)
