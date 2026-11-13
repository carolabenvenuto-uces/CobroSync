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
const esFecha = (v) => Object.prototype.toString.call(v) === '[object Date]' // sirve para fechas de Node y del script
const comoTexto = (v) => (v === true ? 'TRUE' : v === false ? 'FALSE' : esFecha(v) ? v : String(v)) // celdas con formato texto
function crearHoja(nombre) {
  const filas = []
  const formulas = {} // "fila,columna" → fórmula
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
      getFormulas: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => formulas[`${r + i},${c + j}`] ?? '')),
      setValue: (v) => {
        if (formulas[`${r},${c}`]) throw new Error('se pisó una fórmula')
        filas[r - 1] ??= []
        filas[r - 1][c - 1] = comoTexto(v)
      },
    }),
    formulas,
    getLastColumn: () => Math.max(0, ...filas.map((f) => f.length)),
    clearContents: () => (filas.length = 0),
  }
  return hoja
}
const hojas = {}
const hojasControl = { Diario: crearHoja('Diario'), Quiter: crearHoja('Quiter') } // la planilla de control de Cobranzas
const planillaControl = { getSheetByName: (n) => hojasControl[n] ?? null, insertSheet: (n) => (hojasControl[n] = crearHoja(n)) }
const libro = {
  getSheetByName: (n) => hojas[n] ?? null,
  insertSheet: (n) => (hojas[n] = crearHoja(n)),
}
let emailActual = ''
const mails = []
const archivos = []
let siguienteId = 1
function carpeta(ruta) {
  const hijas = {}
  const propios = []
  const yo = {
    ruta,
    archivos: propios,
    getFoldersByName: (n) => {
      let dado = false
      return { hasNext: () => !!hijas[n] && !dado, next: () => ((dado = true), hijas[n]) }
    },
    createFolder: (n) => (hijas[n] = carpeta(`${ruta}/${n}`)),
    getFiles: () => {
      const copia = [...propios]
      let i = 0
      return { hasNext: () => i < copia.length, next: () => copia[i++] }
    },
    createFile: (blob) => {
      archivos.push(`${ruta}/${blob.name}`)
      const f = {
        id: `archivo-${siguienteId++}`,
        nombre: blob.name,
        padre: yo,
        getId: () => f.id,
        getName: () => f.nombre,
        getUrl: () => `https://drive.google.com/${f.padre.ruta}/${f.nombre}`,
        setDescription: () => {},
        setSharing: (acceso, permiso) => { f.compartido = `${acceso}/${permiso}` },
        moveTo: (destino) => {
          f.padre.archivos.splice(f.padre.archivos.indexOf(f), 1)
          destino.archivos.push(f)
          f.padre = destino
          archivos.push(`${destino.ruta}/${f.nombre}`)
        },
      }
      propios.push(f)
      return f
    },
  }
  return yo
}
const raizDrive = carpeta('CobroSync')
const contexto = {
  SpreadsheetApp: { getActive: () => libro, openById: (id) => { if (id !== 'planilla-control') throw new Error('planilla inexistente'); return planillaControl } },
  Session: { getActiveUser: () => ({ getEmail: () => emailActual }) },
  LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
  DriveApp: {
    Access: { DOMAIN_WITH_LINK: 'DOMAIN_WITH_LINK' },
    Permission: { VIEW: 'VIEW' },
    getFolderById: (id) => { if (id !== 'carpeta-123') throw new Error('carpeta inexistente'); return raizDrive },
    getFileById: (id) => ({ getBlob: () => { const b = { name: '', id, setName: (n) => { b.name = n; return b } }; return b } }),
  },
  Utilities: {
    formatDate: (d) => d.toISOString().slice(0, 10),
    newBlob: (_bytes, _mime, name) => ({ name }),
    base64Decode: (b) => Buffer.from(b, 'base64'),
    base64Encode: (bytes) => Buffer.from(bytes).toString('base64'),
    zip: (blobs, nombre) => ({ nombre, getBytes: () => Buffer.from(JSON.stringify(blobs.map((b) => b.name))) }),
  },
  MailApp: { sendEmail: (m) => mails.push(m) },
  ScriptApp: { getProjectTriggers: () => [], deleteTrigger: () => {}, newTrigger: () => ({ timeBased: () => ({ everyHours: () => ({ create: () => {} }), everyDays: () => ({ atHour: () => ({ create: () => {} }) }), onWeekDay: () => ({ atHour: () => ({ create: () => {} }) }) }) }), WeekDay: { MONDAY: 1 } },
  HtmlService: { createHtmlOutputFromFile: () => ({ setTitle: () => ({ addMetaTag: () => ({}) }) }) },
  console,
}
vm.createContext(contexto)
vm.runInContext(codigo, contexto)
const gs = (fn, ...args) => contexto[fn](...JSON.parse(JSON.stringify(args)))
const HOJAS_COLUMNAS = vm.runInContext('HOJAS.comprobantes.columnas', contexto)
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
  for (const n of ['Config', 'Usuarios', 'Sucursales', 'Aseguradoras', 'Comprobantes', 'CobrosPrevistos', 'Lecturas']) esperar(hojas[n], `falta ${n}`)
  esperar(hojas.Config.getLastRow() > 1, 'Config sin valores iniciales')
})

// Completar la configuración como lo haría Cobranzas
const cfg = hojas.Config.filas
const setCfg = (clave, valor) => (cfg.find((f) => f[0] === clave)[1] = valor)
setCfg('carpetaDriveId', 'carpeta-123')
setCfg('correosGerencia', 'gerencia.general@svaauto.com.ar')
setCfg('avisosPorMail', 'SI')
fila('Usuarios', ['auditoria@svaauto.com.ar', 'Cobranzas', 'Cobranzas', ''])
fila('Usuarios', ['Rocamora@SVAAUTO.com.ar', 'Facturación Rocamora', 'Sucursal', 'rocamora '])
fila('Usuarios', ['gerencia.general@svaauto.com.ar', 'Gerencia General', 'Gerencia', ''])
// Cobranzas que además escanea lo de su propia sucursal
fila('Usuarios', ['escaneo@svaauto.com.ar', 'Cobranzas de Rocamora', 'Cobranzas', 'Rocamora'])
fila('Sucursales', ['Rocamora', '35, 37', 'Gerente de Rocamora', 'gerente.rocamora@svaauto.com.ar'])
fila('Sucursales', ['Warnes', '16, 14', 'Gerente de Warnes', 'gerente.warnes@svaauto.com.ar'])

const deLaPrueba = demo.filter((c) => c.sucursal === 'Rocamora' || c.sucursal === 'Warnes')
const lote = [...deLaPrueba.slice(0, 300), ...deLaPrueba.slice(300).filter((c) => c.estado === 'pendiente_drive' || c.estado === 'en_gestion' || c.estado === 'presentada')].map((c) => ({ ...c, id: `ref-${c.ref}`, eventos: [] })) // como llegan de la planilla: sin historial

prueba('una cuenta de afuera de la empresa no entra', () => {
  como('alguien@gmail.com')
  falla(() => gs('obtenerDatos'), 'cuenta de la empresa')
})
prueba('una cuenta de la empresa que no está en Usuarios no entra', () => {
  como('otro@svaauto.com.ar')
  falla(() => gs('obtenerDatos'), 'no tiene acceso')
})
prueba('Cobranzas pasa la planilla y se guardan las facturas', () => {
  como('auditoria@svaauto.com.ar')
  const r = gs('sincronizarDesdePlanilla', lote)
  esperar(r.nuevas === lote.length && r.actualizadas === 0, JSON.stringify(r))
})
prueba('pasar la planilla deja afuera las sucursales que no están en la prueba', () => {
  const otra = demo.find((c) => c.sucursal !== 'Rocamora' && c.sucursal !== 'Warnes')
  const r = gs('sincronizarDesdePlanilla', [{ ...otra, id: `ref-${otra.ref}` }])
  esperar(r.nuevas === 0 && r.omitidas === 1, JSON.stringify(r))
})
prueba('pasar la planilla otra vez no duplica y actualiza cobros', () => {
  const sinCobrar = lote.find((c) => c.tipo === 'FC' && c.estado === 'presentada')
  const otraVez = lote.map((c) => (c.id === sinCobrar.id ? { ...c, estado: 'cobrada', fechaCobro: '2026-11-03' } : c))
  const r = gs('sincronizarDesdePlanilla', otraVez)
  esperar(r.nuevas === 0 && r.actualizadas === 1, JSON.stringify(r))
  const leida = gs('obtenerDatos').datos.comprobantes.find((c) => c.id === sinCobrar.id)
  esperar(leida.estado === 'cobrada' && leida.fechaCobro === '2026-11-03', 'el cobro no se guardó')
})
prueba('una factura sin referencia no se duplica al pasar la planilla otra vez', () => {
  const base = lote.find((c) => c.tipo === 'FC')
  const sinRef = { ...base, ref: '', numero: 99999, id: `pl-FC-${base.puntoVenta}-99999` }
  esperar(gs('sincronizarDesdePlanilla', [sinRef]).nuevas === 1, 'no se agregó')
  esperar(gs('sincronizarDesdePlanilla', [sinRef]).nuevas === 0, 'se duplicó')
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
  gs('aplicarCambios', [{ id: c.id, campos: { total: 1 }, documentos: c.documentos.map((d) => ({ ...d, estado: 'en_revision', archivo: 'x.pdf' })) }])
  como('auditoria@svaauto.com.ar')
  const leido = gs('obtenerDatos').datos.comprobantes.find((x) => x.id === c.id)
  esperar(leido.total === c.total, 'la sucursal pudo cambiar el importe')
  esperar(leido.documentos.every((d) => d.estado === 'en_revision'), 'no se guardaron los documentos')
})
prueba('Cobranzas da de alta una compañía, le carga varios mails, la pausa y la reactiva', () => {
  como('auditoria@svaauto.com.ar')
  gs('guardarAseguradoras', [{ id: 'seguros-del-sur', nombre: 'Seguros del Sur', email: '', canal: 'portal', plazoPagoDias: 30 }])
  gs('guardarAseguradoras', [{ id: 'seguros-del-sur', email: 'a@sur.example, b@sur.example', portalUrl: 'https://portal.sur.example' }], true, true)
  gs('guardarAseguradoras', [{ id: 'seguros-del-sur', pausada: true }], true, true)
  let a = gs('obtenerDatos').datos.aseguradoras.find((x) => x.id === 'seguros-del-sur')
  esperar(a && a.pausada === true && a.email === 'a@sur.example, b@sur.example' && a.plazoPagoDias === 30, 'no quedó pausada con sus datos')
  gs('guardarAseguradoras', [{ id: 'seguros-del-sur', pausada: false, email: '' }], true, true)
  a = gs('obtenerDatos').datos.aseguradoras.find((x) => x.id === 'seguros-del-sur')
  esperar(a.pausada === false && !a.email && a.portalUrl === 'https://portal.sur.example', 'no se reactivó o no se pudo vaciar el mail')
  como('rocamora@svaauto.com.ar')
  let error = ''
  try { gs('guardarAseguradoras', [{ id: 'otra', nombre: 'Otra' }]) } catch (e) { error = String(e) }
  esperar(error, 'una sucursal pudo dar de alta una compañía')
})
prueba('la sucursal no puede aprobar sus propios documentos', () => {
  como('rocamora@svaauto.com.ar')
  const c = gs('obtenerDatos').datos.comprobantes.find((x) => x.tipo === 'FC' && x.documentos.some((d) => d.estado === 'faltante'))
  gs('aplicarCambios', [{ id: c.id, documentos: c.documentos.map((d) => ({ ...d, estado: 'ok', archivo: 'x.pdf' })) }])
  como('auditoria@svaauto.com.ar')
  const leido = gs('obtenerDatos').datos.comprobantes.find((x) => x.id === c.id)
  esperar(!leido.documentos.some((d) => d.estado === 'ok' && c.documentos.find((o) => o.tipo === d.tipo).estado !== 'ok'), 'la sucursal aprobó documentos')
  esperar(!leido.fechaAprobacion, 'quedó con fecha de aprobación')
})
prueba('Cobranzas con sucursal propia sube lo suyo, pero lo aprueba otra persona de Cobranzas', () => {
  como('escaneo@svaauto.com.ar')
  const d = gs('obtenerDatos')
  esperar(d.usuario.rol === 'auditoria' && d.usuario.sucursalPropia === 'Rocamora', 'no quedó como Cobranzas con sucursal propia')
  const c = d.datos.comprobantes.find((x) => x.tipo === 'FC' && x.sucursal === 'Rocamora' && x.documentos.some((y) => y.estado === 'faltante'))
  const tipo = c.documentos.find((y) => y.estado === 'faltante').tipo
  gs('aplicarCambios', [{ id: c.id, documentos: [{ tipo, estado: 'en_revision', archivo: 'escaneo.pdf', url: 'u1' }] }])
  let doc = gs('obtenerDatos').datos.comprobantes.find((x) => x.id === c.id).documentos.find((y) => y.tipo === tipo)
  esperar(doc.estado === 'en_revision' && doc.subidoPor === 'Cobranzas de Rocamora', 'no quedó firmado por quien lo subió')
  gs('aplicarCambios', [{ id: c.id, documentos: [{ ...doc, estado: 'ok' }] }])
  doc = gs('obtenerDatos').datos.comprobantes.find((x) => x.id === c.id).documentos.find((y) => y.tipo === tipo)
  esperar(doc.estado === 'en_revision', 'se aprobó su propio escaneo')
  como('auditoria@svaauto.com.ar')
  gs('aplicarCambios', [{ id: c.id, documentos: [{ ...doc, estado: 'ok' }] }])
  doc = gs('obtenerDatos').datos.comprobantes.find((x) => x.id === c.id).documentos.find((y) => y.tipo === tipo)
  esperar(doc.estado === 'ok', 'la otra persona de Cobranzas no pudo aprobarlo')
})
prueba('la sucursal puede quitar un documento subido por error, pero no uno aprobado', () => {
  como('rocamora@svaauto.com.ar')
  const c = gs('obtenerDatos').datos.comprobantes.find((x) => x.tipo === 'FC' && x.documentos.some((d) => d.estado === 'en_revision'))
  const enRevision = c.documentos.find((d) => d.estado === 'en_revision')
  gs('aplicarCambios', [{ id: c.id, documentos: [{ tipo: enRevision.tipo, estado: 'faltante' }] }])
  let leido = gs('obtenerDatos').datos.comprobantes.find((x) => x.id === c.id)
  esperar(leido.documentos.find((d) => d.tipo === enRevision.tipo).estado === 'faltante', 'no se pudo quitar')
  const aprobado = gs('obtenerDatos').datos.comprobantes.find((x) => x.tipo === 'FC' && x.documentos.some((d) => d.estado === 'ok'))
  const ok = aprobado.documentos.find((d) => d.estado === 'ok')
  gs('aplicarCambios', [{ id: aprobado.id, documentos: [{ tipo: ok.tipo, estado: 'faltante' }] }])
  leido = gs('obtenerDatos').datos.comprobantes.find((x) => x.id === aprobado.id)
  esperar(leido.documentos.find((d) => d.tipo === ok.tipo).estado === 'ok', 'la sucursal pudo quitar un documento aprobado')
  // Se vuelve a dejar para la revisión de la prueba siguiente
  gs('aplicarCambios', [{ id: c.id, documentos: [{ ...enRevision }] }])
})
prueba('la fecha de aprobación se pone al aprobar todo y se vacía si se observa algo', () => {
  como('auditoria@svaauto.com.ar')
  const c = gs('obtenerDatos').datos.comprobantes.find((x) => x.tipo === 'FC' && x.documentos.some((d) => d.estado === 'en_revision'))
  gs('aplicarCambios', [{ id: c.id, documentos: c.documentos.slice(0, 1).map((d) => ({ ...d, estado: 'ok' })) }])
  let leido = gs('obtenerDatos').datos.comprobantes.find((x) => x.id === c.id)
  esperar(!leido.fechaAprobacion, 'se puso la fecha con documentos sin aprobar')
  gs('aplicarCambios', [{ id: c.id, documentos: c.documentos.map((d) => ({ ...d, estado: 'ok' })) }])
  leido = gs('obtenerDatos').datos.comprobantes.find((x) => x.id === c.id)
  esperar(/^\d{4}-\d{2}-\d{2}$/.test(leido.fechaAprobacion ?? ''), `fecha: ${leido.fechaAprobacion}`)
  gs('aplicarCambios', [{ id: c.id, documentos: [{ ...c.documentos[1], estado: 'observado', motivo: 'Ilegible' }] }])
  leido = gs('obtenerDatos').datos.comprobantes.find((x) => x.id === c.id)
  esperar(leido.fechaAprobacion === null, 'no se vació al observar')
})
prueba('la sucursal no puede tocar facturas de otra sucursal', () => {
  como('auditoria@svaauto.com.ar')
  const ajena = gs('obtenerDatos').datos.comprobantes.find((x) => x.sucursal === 'Warnes')
  como('rocamora@svaauto.com.ar')
  const r = gs('aplicarCambios', [{ id: ajena.id, campos: { observaciones: 'x' } }])
  esperar(r.errores?.[0]?.mensaje.includes('otra sucursal'), JSON.stringify(r.errores))
  falla(() => gs('subirArchivo', ajena.id, 'factura', 'f.pdf', 'application/pdf', 'AAAA'), 'otra sucursal')
})
prueba('Gerencia solo consulta', () => {
  como('gerencia.general@svaauto.com.ar')
  const d = gs('obtenerDatos')
  esperar(d.usuario.rol === 'gerencia' && d.datos.comprobantes.length === lote.length + 1, 'Gerencia no ve todo') // + la factura sin referencia de la prueba anterior
  falla(() => gs('aplicarCambios', [{ id: d.datos.comprobantes[0].id, campos: { observaciones: 'x' } }]), 'solo puede consultar')
})
prueba('Cobranzas aprueba y registra el cobro', () => {
  como('auditoria@svaauto.com.ar')
  const c = gs('obtenerDatos').datos.comprobantes.find((x) => x.estado === 'presentada')
  gs('aplicarCambios', [{ id: c.id, campos: { estado: 'cobrada', fechaCobro: '2026-11-04' } }, { id: c.id, evento: { tipo: 'mensaje', texto: 'Cobro registrado' } }])
  const leido = gs('obtenerDatos').datos.comprobantes.find((x) => x.id === c.id)
  esperar(leido.estado === 'cobrada' && leido.eventos.at(-1).texto === 'Cobro registrado', 'no se guardó el cobro')
})
prueba('dos personas en la misma factura a la vez: no se pisan', () => {
  como('auditoria@svaauto.com.ar')
  const c = gs('obtenerDatos').datos.comprobantes.find((x) => x.sucursal === 'Rocamora' && x.tipo === 'FC' && x.estado !== 'cobrada')
  // Las dos abrieron la factura igual; cada una guarda su cambio sin ver el de la otra
  como('rocamora@svaauto.com.ar')
  gs('aplicarCambios', [{ id: c.id, documentos: [{ tipo: 'orden', estado: 'en_revision', archivo: 'orden firmada.jpg' }] }, { id: c.id, evento: { tipo: 'subida', texto: 'Subió la orden firmada' } }])
  como('auditoria@svaauto.com.ar')
  gs('aplicarCambios', [{ id: c.id, campos: { observaciones: 'Revisar la orden' } }, { id: c.id, evento: { tipo: 'mensaje', texto: 'Ojo con la orden' } }])
  const final = gs('obtenerDatos').datos.comprobantes.find((x) => x.id === c.id)
  esperar(final.documentos.find((d) => d.tipo === 'orden').archivo === 'orden firmada.jpg', 'se perdió la orden de la sucursal')
  esperar(final.observaciones === 'Revisar la orden', 'se perdió la observación de Cobranzas')
  const textos = final.eventos.map((e) => e.texto)
  esperar(textos.includes('Subió la orden firmada') && textos.includes('Ojo con la orden'), `conversación: ${textos.join(' | ')}`)
  const deSucursal = final.eventos.find((e) => e.texto === 'Subió la orden firmada')
  esperar(deSucursal.autor === 'Facturación Rocamora' && deSucursal.area === 'sucursal', 'el servidor no firmó el mensaje')
})
prueba('notas de crédito parciales y cobro por otro importe se guardan bien', () => {
  como('rocamora@svaauto.com.ar')
  const c = gs('obtenerDatos').datos.comprobantes.find((x) => x.tipo === 'FC' && x.estado !== 'cobrada' && x.estado !== 'anulada')
  // La sucursal avisa una NC parcial, pero no puede tocar el saldo
  gs('aplicarCambios', [{ id: c.id, campos: { anulacionInformada: { fecha: '2026-11-04', motivo: 'Repuesto', parcial: true, importe: 1000 }, acreditado: 999999 } }])
  como('auditoria@svaauto.com.ar')
  let leido = gs('obtenerDatos').datos.comprobantes.find((x) => x.id === c.id)
  esperar(leido.anulacionInformada?.parcial === true && leido.anulacionInformada.importe === 1000, 'no se guardó el aviso de la sucursal')
  esperar(leido.acreditado === null, `la sucursal pudo cambiar el saldo: ${leido.acreditado}`)
  // Cobranzas vincula la NC parcial y registra el cobro por otro importe
  gs('aplicarCambios', [{ id: c.id, campos: { acreditado: 1000, anulacionInformada: null, estado: 'cobrada', fechaCobro: '2026-11-04', importeCobrado: 5000.5, percepciones: 120.25 } }])
  leido = gs('obtenerDatos').datos.comprobantes.find((x) => x.id === c.id)
  esperar(leido.acreditado === 1000 && leido.importeCobrado === 5000.5 && leido.percepciones === 120.25, JSON.stringify([leido.acreditado, leido.importeCobrado, leido.percepciones]))
  esperar(leido.anulacionInformada === null, 'no se limpió el aviso')
})
prueba('un cambio rechazado no traba a los demás', () => {
  como('rocamora@svaauto.com.ar')
  const propias = gs('obtenerDatos').datos.comprobantes.filter((x) => x.tipo === 'FC')
  const r = gs('aplicarCambios', [{ id: 'no-existe', campos: { observaciones: 'x' } }, { id: propias[0].id, evento: { tipo: 'mensaje', texto: 'Sigue funcionando' } }])
  esperar(r.errores.length === 1 && r.errores[0].id === 'no-existe', JSON.stringify(r.errores))
  esperar(r.comprobantes.some((x) => x.id === propias[0].id && x.eventos.at(-1).texto === 'Sigue funcionando'), 'el segundo cambio no se guardó')
})
prueba('cada minuto llegan solo los cambios nuevos', () => {
  como('auditoria@svaauto.com.ar')
  const desde = gs('obtenerDatos').ahora
  const c = gs('obtenerDatos').datos.comprobantes[5]
  esperar(gs('obtenerCambios', desde).comprobantes.length === 0, 'trajo cambios viejos')
  const espera = Date.now() + 5
  while (Date.now() < espera);
  como('rocamora@svaauto.com.ar')
  const propia = gs('obtenerDatos').datos.comprobantes.find((x) => x.tipo === 'FC')
  gs('aplicarCambios', [{ id: propia.id, evento: { tipo: 'mensaje', texto: 'Hola Cobranzas' } }])
  como('auditoria@svaauto.com.ar')
  const cambios = gs('obtenerCambios', desde).comprobantes
  esperar(cambios.length === 1 && cambios[0].id === propia.id, `trajo ${cambios.length}`)
  como('rocamora@svaauto.com.ar')
  esperar(gs('obtenerCambios', desde).comprobantes.every((x) => x.sucursal === 'Rocamora'), 'la sucursal recibió cambios ajenos')
  void c
})
prueba('las notificaciones leídas se guardan en la cuenta', () => {
  como('auditoria@svaauto.com.ar')
  gs('marcarLeidas', ['a', 'b'])
  gs('marcarLeidas', ['b', 'c'])
  const leidas = gs('obtenerDatos').leidas
  esperar(leidas.join(',') === 'a,b,c', leidas.join(','))
  como('rocamora@svaauto.com.ar')
  esperar(gs('obtenerDatos').leidas.length === 0, 'se mezclaron las leídas de otra cuenta')
})
prueba('la sucursal sube un archivo y queda en Drive en la carpeta de la factura', () => {
  como('rocamora@svaauto.com.ar')
  const c = gs('obtenerDatos').datos.comprobantes.find((x) => x.tipo === 'FC')
  const datos = Buffer.from('hola').toString('base64')
  const numero = `${c.puntoVenta}-${c.numero}`
  falla(() => gs('subirArchivo', c.id, 'orden', `${numero} orden.jpg`, 'image/jpeg', datos), 'Solo se aceptan PDF')
  falla(() => gs('subirArchivo', c.id, 'orden', 'scan0001.pdf', 'application/pdf', datos), 'número de la factura')
  const r = gs('subirArchivo', c.id, 'orden', `${numero} orden.pdf`, 'application/pdf', datos)
  esperar(r.url.startsWith('https://drive.google.com/'), 'sin link')
  const subido = raizDrive.getFoldersByName('Rocamora').next().getFoldersByName(c.fecha.slice(0, 7)).next().getFoldersByName(`FC ${c.puntoVenta}-${c.numero}`).next().getFiles()
  let ultimo = null
  while (subido.hasNext()) ultimo = subido.next()
  esperar(ultimo && ultimo.compartido === 'DOMAIN_WITH_LINK/VIEW', 'el archivo no quedó visible para la empresa con el link')
  esperar(archivos.at(-1).startsWith(`CobroSync/Rocamora/${c.fecha.slice(0, 7)}/FC ${c.puntoVenta}-`), archivos.at(-1))
})
prueba('Cobranzas carga facturas nuevas del ERP y no se duplican', () => {
  como('auditoria@svaauto.com.ar')
  const nueva = { ...lote[0], id: 'erp-999', ref: '9999999' }
  esperar(gs('agregarComprobantes', [nueva, nueva]) === 1, 'duplicó o no agregó')
  const otra = { ...lote[1], id: 'erp-1000', ref: '9999998' }
  gs('aplicarCambios', [{ id: otra.id, nuevo: otra }, { id: otra.id, nuevo: otra }])
  esperar(gs('obtenerDatos').datos.comprobantes.filter((x) => x.id === 'erp-1000').length === 1, 'se duplicó al cargar desde la app')
  como('rocamora@svaauto.com.ar')
  const r = gs('aplicarCambios', [{ id: 'erp-x', nuevo: { ...otra, id: 'erp-x' } }])
  esperar(r.errores.length === 1 && r.errores[0].mensaje.includes('Solo Cobranzas'), JSON.stringify(r.errores))
  como('auditoria@svaauto.com.ar')
})
prueba('todos los días no sale ningún mail: solo se marca en CobroSync lo atrasado y lo crítico', () => {
  hojas.Comprobantes.filas.forEach((f, i) => { if (i > 0) f[HOJAS_COLUMNAS.indexOf('eventos')] = '' })
  mails.length = 0
  gs('avisosDiarios')
  esperar(mails.length === 0, `salieron ${mails.length} mails en el día`)
  const eventos = hojas.Comprobantes.filas.slice(1).map((f) => f[HOJAS_COLUMNAS.indexOf('eventos')]).join(' ')
  esperar(eventos.includes('resumen del lunes') && eventos.includes('gerencia general'), 'no quedaron los avisos para las notificaciones')
  const antes = eventos.length
  gs('avisosDiarios')
  esperar(hojas.Comprobantes.filas.slice(1).map((f) => f[HOJAS_COLUMNAS.indexOf('eventos')]).join(' ').length === antes, 'se repitieron los avisos')
})
prueba('el lunes no se reclama una factura con fecha comprometida que todavía no pasó', () => {
  como('rocamora@svaauto.com.ar')
  const pendiente = gs('obtenerDatos').datos.comprobantes.find((x) => x.tipo === 'FC' && !x.fechaPresentacion && x.estado !== 'cobrada' && x.estado !== 'anulada' && !x.anulacionInformada && x.documentos.some((d) => d.estado === 'faltante') && x.fecha < '2026-10-01')
  gs('aplicarCambios', [{ id: pendiente.id, campos: { compromiso: { fecha: '2099-01-01', motivo: 'El vehículo sigue en el taller' } } }])
  como('auditoria@svaauto.com.ar')
  mails.length = 0
  gs('resumenSemanal')
  const numero = `${pendiente.tipo} E ${pendiente.puntoVenta}-${pendiente.numero}`
  esperar(mails.length > 0, 'no salió ningún resumen')
  esperar(!mails.some((m) => m.body.includes(numero)), 'se reclamó una factura con fecha comprometida vigente')
})
prueba('el lunes: un resumen por sucursal con pendientes y un solo mail a Gerencia', () => {
  // Una factura vencida con 3 reclamos sin respuesta
  const iRec = hojas.Comprobantes.filas.findIndex((f, i) => i > 0 && f[HOJAS_COLUMNAS.indexOf('tipo')] === 'FC')
  const f = hojas.Comprobantes.filas[iRec]
  f[HOJAS_COLUMNAS.indexOf('estado')] = 'presentada'
  f[HOJAS_COLUMNAS.indexOf('vencimiento')] = '2026-01-01'
  f[HOJAS_COLUMNAS.indexOf('reclamos')] = JSON.stringify([1, 2, 3].map(() => ({ fecha: '2026-02-01', medio: 'mail', autor: 'Cobranzas', nota: '' })))
  mails.length = 0
  gs('resumenSemanal')
  const deSucursal = mails.filter((m) => m.subject.includes('Resumen semanal'))
  const aGerencia = mails.filter((m) => m.to === 'gerencia.general@svaauto.com.ar')
  // Un mail por sucursal con atrasadas (las que no tienen nada pendiente no reciben)
  esperar(deSucursal.some((m) => m.to === 'gerente.rocamora@svaauto.com.ar'), `resúmenes a: ${deSucursal.map((m) => m.to)}`)
  esperar(new Set(deSucursal.map((m) => m.to)).size === deSucursal.length, 'más de un resumen por sucursal')
  esperar(deSucursal[0].body.includes(' días'), 'el resumen de la sucursal no lista las facturas')
  esperar(aGerencia.length === 1 && mails.length === deSucursal.length + 1, `${aGerencia.length} mails a Gerencia, ${mails.length} en total`)
  const cuerpo = aGerencia[0].body
  esperar(cuerpo.includes('Cobranzas solicita su apoyo') && cuerpo.includes('Se solicita su intervención'), cuerpo.slice(0, 300))
  esperar(!cuerpo.includes(' E 3'), 'el mail a Gerencia lista facturas una por una')
})
prueba('si una sucursal no tiene nada pendiente, no le llega ningún mail', () => {
  const col = (n) => HOJAS_COLUMNAS.indexOf(n)
  hojas.Comprobantes.filas.forEach((f, i) => {
    if (i > 0 && f[col('sucursal')] === 'Warnes' && f[col('tipo')] === 'FC') {
      f[col('documentos')] = JSON.stringify(['factura', 'orden'].map((t) => ({ tipo: t, estado: 'ok' })))
    }
  })
  mails.length = 0
  gs('resumenSemanal')
  esperar(!mails.some((m) => m.to === 'gerente.warnes@svaauto.com.ar'), 'le llegó un mail a una sucursal sin pendientes')
  esperar(mails.some((m) => m.to === 'gerente.rocamora@svaauto.com.ar'), 'no le llegó a la que sí tiene')
})
prueba('pedidos: Cobranzas pide; la sucursal responde pero no puede borrar ni inventar pedidos', () => {
  como('auditoria@svaauto.com.ar')
  const c = gs('obtenerDatos').datos.comprobantes.find((x) => x.sucursal === 'Rocamora' && x.tipo === 'FC')
  gs('aplicarCambios', [{ id: c.id, campos: { pedidos: [{ id: 'p1', fecha: '2026-11-04', tipo: 'error_factura', detalle: 'El importe no coincide', autor: 'cualquiera' }] } }])
  como('rocamora@svaauto.com.ar')
  gs('aplicarCambios', [{ id: c.id, campos: { pedidos: [] } }])
  let leido = gs('obtenerDatos').datos.comprobantes.find((x) => x.id === c.id)
  esperar(leido.pedidos.length === 1, 'la sucursal pudo borrar el pedido')
  esperar(leido.pedidos[0].autor !== 'cualquiera', 'el pedido no quedó firmado por quien lo hizo')
  gs('aplicarCambios', [{ id: c.id, campos: { pedidos: [{ ...leido.pedidos[0], respuesta: { texto: 'Se refacturó con la FC 35-12000', autor: 'otro' } }, { id: 'falso', tipo: 'otro', detalle: 'x' }] } }])
  leido = gs('obtenerDatos').datos.comprobantes.find((x) => x.id === c.id)
  esperar(leido.pedidos.length === 1 && leido.pedidos[0].respuesta.texto.includes('35-12000'), JSON.stringify(leido.pedidos))
  esperar(leido.pedidos[0].respuesta.autor === 'Facturación Rocamora', 'la respuesta no la firma el servidor')
})
prueba('descargar los documentos de varias facturas en un .zip, con el número en cada nombre; la sucursal no puede', () => {
  como('auditoria@svaauto.com.ar')
  const c = gs('obtenerDatos').datos.comprobantes.find((x) => x.tipo === 'FC')
  gs('aplicarCambios', [{ id: c.id, documentos: [{ tipo: 'factura', estado: 'ok', url: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view' }] }])
  const r = gs('descargarDocumentos', [c.id], 'Sancor 2026-11-04')
  const nombres = JSON.parse(Buffer.from(r.base64, 'base64').toString())
  esperar(r.nombre === 'Sancor 2026-11-04.zip' && r.cantidad === 1, JSON.stringify(r))
  esperar(nombres[0] === `FC E ${c.puntoVenta}-${c.numero} factura.pdf`, nombres[0])
  como('rocamora@svaauto.com.ar')
  falla(() => gs('descargarDocumentos', [c.id], 'x'), 'Solo Cobranzas')
})
prueba('un reporte técnico le llega solo a la desarrolladora', () => {
  como('rocamora@svaauto.com.ar')
  falla(() => gs('reportarProblema', 'No carga', {}), 'correo de soporte')
  setCfg('correoSoporte', 'desarrolladora@svaauto.com.ar')
  mails.length = 0
  esperar(gs('reportarProblema', 'No me deja subir un PDF', { pantalla: '#/app', navegador: 'Chrome' }) === true, 'no devolvió true')
  esperar(mails.length === 1 && mails[0].to === 'desarrolladora@svaauto.com.ar', `mails: ${mails.map((m) => m.to)}`)
  esperar(mails[0].body.includes('No me deja subir un PDF') && mails[0].body.includes('rocamora@svaauto.com.ar'), mails[0].body.slice(0, 200))
  esperar(mails[0].replyTo === 'rocamora@svaauto.com.ar', 'sin responder a')
})
prueba('con el correo de soporte cargado, los ajustes los cambia solo esa cuenta', () => {
  setCfg('correoSoporte', 'desarrolladora@svaauto.com.ar')
  como('auditoria@svaauto.com.ar')
  falla(() => gs('guardarAjustes', { plazos: {}, companiasSinFce: [], avisos: {} }), 'solo la administradora')
  setCfg('correoSoporte', '')
})
prueba('Ajustes: Cobranzas cambia los plazos y las compañías con FCE; la sucursal no puede', () => {
  como('rocamora@svaauto.com.ar')
  falla(() => gs('guardarAjustes', { plazos: {}, companiasSinFce: [], avisos: {} }), 'Solo Cobranzas')
  como('auditoria@svaauto.com.ar')
  const antes = gs('obtenerDatos')
  esperar(antes.datos.meta.plazos.comun === 10 && antes.datos.meta.plazos.mipyme === 5, JSON.stringify(antes.datos.meta.plazos))
  esperar(antes.datos.meta.avisos && antes.datos.meta.avisos.porMail === true, 'Cobranzas no recibe la configuración de avisos')
  gs('guardarAjustes', {
    plazos: { comun: 12, mipyme: 6, criticaComun: 25, criticaMipyme: 14, montoMinimoMipyme: 6000000, puntosVentaMipyme: [50] },
    companiasSinFce: ['allianz'],
    avisos: { porMail: true, correosGerencia: 'gerencia.general@svaauto.com.ar' },
  })
  gs('guardarAjustes', {
    plazos: { comun: 12, mipyme: 6, criticaComun: 25, criticaMipyme: 14, montoMinimoMipyme: 6000000, puntosVentaMipyme: [50] },
    companiasSinFce: ['allianz'],
    avisos: { porMail: true, correosGerencia: 'gerencia.general@svaauto.com.ar' },
    textos: { apoyo: 'Necesitamos ayuda con {compania}', critica: '' },
  })
  const d = gs('obtenerDatos').datos
  esperar(d.meta.textos.apoyo === 'Necesitamos ayuda con {compania}' && d.meta.textos.critica === '', JSON.stringify(d.meta.textos))
  esperar(d.meta.plazos.comun === 12 && d.meta.plazos.puntosVentaMipyme[0] === 50, JSON.stringify(d.meta.plazos))
  const allianz = d.aseguradoras.find((x) => x.id === 'allianz')
  if (allianz) esperar(allianz.recibeFce === false, 'no se guardó que Allianz no recibe FCE')
  como('rocamora@svaauto.com.ar')
  esperar(gs('obtenerDatos').datos.meta.avisos === undefined, 'la sucursal ve los correos de Gerencia')
  como('auditoria@svaauto.com.ar')
  // Se vuelve a los plazos de siempre para las pruebas siguientes
  gs('guardarAjustes', { plazos: { comun: 10, mipyme: 5, criticaComun: 21, criticaMipyme: 12, montoMinimoMipyme: 5549862, puntosVentaMipyme: [] }, companiasSinFce: [], avisos: { porMail: true, correosGerencia: 'gerencia.general@svaauto.com.ar' } })
})
prueba('una factura MiPyME entra en el resumen del lunes a los 6 días; una común, no', () => {
  const col = (n) => HOJAS_COLUMNAS.indexOf(n)
  const hoyReal = new Date().toISOString().slice(0, 10) // el simulador usa la fecha real
  const menos = (dias) => new Date(Date.parse(hoyReal) - dias * 86400000).toISOString().slice(0, 10)
  const base = hojas.Comprobantes.filas.find((f, i) => i > 0 && f[col('sucursal')] === 'Rocamora' && f[col('tipo')] === 'FC')
  const nueva = (id, total) => {
    const f = [...base]
    f[col('id')] = id; f[col('ref')] = id; f[col('numero')] = String(90000 + hojas.Comprobantes.filas.length)
    f[col('fecha')] = menos(6); f[col('total')] = String(total); f[col('estado')] = 'pendiente_drive'
    f[col('fechaPresentacion')] = ''; f[col('vencimiento')] = ''; f[col('fechaCobro')] = ''; f[col('compromiso')] = ''; f[col('anulacionInformada')] = ''
    f[col('documentos')] = JSON.stringify(['factura', 'orden'].map((t) => ({ tipo: t, estado: 'faltante' })))
    hojas.Comprobantes.filas.push(f)
    return f
  }
  const fMipyme = nueva('mipyme-1', 18853739.6)
  const fComun = nueva('comun-1', 1000000)
  mails.length = 0
  gs('resumenSemanal')
  const cuerpo = mails.find((m) => m.to === 'gerente.rocamora@svaauto.com.ar')?.body ?? ''
  const nro = (f) => `FC E ${f[col('puntoVenta')]}-${f[col('numero')]}`
  esperar(cuerpo.includes(nro(fMipyme)) && cuerpo.includes('MiPyME'), 'la MiPyME de 6 días no está en el resumen')
  esperar(!cuerpo.includes(nro(fComun)), 'la común de 6 días está en el resumen (todavía está en plazo)')
})
prueba('con los avisos desactivados no sale ningún mail', () => {
  setCfg('avisosPorMail', 'NO')
  mails.length = 0
  gs('avisosDiarios')
  gs('resumenSemanal')
  esperar(mails.length === 0, 'salieron mails')
})
prueba('sin id de planilla de control no se toca nada', () => {
  esperar(gs('actualizarPlanillaDeControl') === 0, 'completó sin id')
  como('auditoria@svaauto.com.ar')
  esperar(gs('agregarAQuiter', [['123']]).configurada === false, 'agregó sin id')
  falla(() => gs('actualizarMiPlanilla'), 'planillaControlId')
})
// Planilla de control como la del sector: Quiter con el ERP pegado y Diario que lo toma por referencia
const comprobantesGuardados = () => (como('auditoria@svaauto.com.ar'), gs('obtenerDatos').datos.comprobantes)
const diario = hojasControl.Diario
diario.appendRow(['', '', 'Sucursal', 'CTE.', 'Número', 'Compañia', 'Siniestro/Patente', 'Total', 'Drive', '', 'Presentación', '', 'Vto.', 'Cobro', 'Estado', 'Anula'])
const facturasGuardadas = comprobantesGuardados().filter((c) => c.tipo === 'FC')
const anuladaGuardada = facturasGuardadas.find((c) => c.estado === 'anulada')
const enDiario = [...facturasGuardadas.filter((c) => c.estado !== 'anulada').slice(0, 119), anuladaGuardada]
esperar(anuladaGuardada, 'los datos de prueba no tienen una factura anulada')
enDiario.forEach((c, i) => {
  diario.appendRow([c.fecha, Number(c.ref), c.sucursal, 'FC E', '', '', '', c.total, '', '', '', '', '', '', '', ''])
  diario.formulas[`${i + 2},15`] = `=SI(P${i + 2}="X";"Anulada";SI(N${i + 2}<>"";"Cobrado";""))` // Estado lo calcula la planilla
})
diario.appendRow(['01/11/2026', 8888888, 'Triunvirato', 'FC E', '', '', '', 1, '', '', '', '', '', '', '', '']) // otra sucursal
hojasControl.Quiter.appendRow(['Refer.', 'Fecha', 'TC', 'Clase', 'BOCA', 'Número', 'Nombre', 'TIVA', 'CUIT'])
hojasControl.Quiter.appendRow([7990001, vm.runInContext('new Date(2026, 9, 30, 12)', contexto), 'FC E'])

prueba('al cargar el ERP, las filas nuevas se agregan al final de Quiter tal cual', () => {
  setCfg('planillaControlId', 'planilla-control')
  como('auditoria@svaauto.com.ar')
  const r = gs('agregarAQuiter', [
    ['7990001', '30/10/2026', 'FC E'], // ya estaba
    ['7990002', '31/10/2026', 'FC E', 'A', '21', 'De 00004571 a 00004571', 'ALLIANZ', 'RI', '30500037217', '0', '1000000', '210000', '0', '0', '12345,67', '0', '1222345,67'],
    ['7990003', '31/10/2026', 'NC E', 'A', '21', 'De 00000101 a 00000101', 'ALLIANZ', 'RI', '30500037217', '0', '-1000000', '-210000', '0', '0', '0', '0', '-1210000,00'],
    ['7990002', '31/10/2026', 'FC E'], // repetida en el mismo archivo
  ])
  const q = hojasControl.Quiter.filas
  esperar(r.completadas > 0, 'después de cargar el ERP no completó Diario')
  esperar(r.agregadas === 2 && q.length === 4, `${r.agregadas} agregadas, ${q.length} filas`)
  esperar(q[2][0] === '7990002' && q[3][0] === '7990003', 'no respetó el orden')
  esperar(esFecha(q[2][1]) && q[2][1].getDate() === 31, 'la fecha no quedó como fecha')
  esperar(q[2][5] === 'De 00004571 a 00004571' && q[2][14] === '12345.67' && q[3][16] === '-1210000', `valores: ${q[2][14]} ${q[3][16]}`)
  esperar(gs('agregarAQuiter', [['7990002', '31/10/2026']]).agregadas === 0, 'duplicó al cargar otra vez')
})
prueba('cada hora se completan Drive, Presentación, Cobro y la X de Anula en Diario, sin tocar Estado', () => {
  const guardados = Object.fromEntries(comprobantesGuardados().map((c) => [c.ref, c]))
  gs('actualizarPlanillaDeControl')
  const f = diario.filas
  let revisadas = 0
  enDiario.forEach((c0, i) => {
    const c = guardados[c0.ref]
    const fila = f[i + 1]
    const dia = (v) => (esFecha(v) ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}` : v)
    if (c.fechaAprobacion) esperar(dia(fila[8]) === c.fechaAprobacion, `Drive de ${c.ref}: ${fila[8]} / ${c.fechaAprobacion}`)
    else esperar(fila[8] === '', `Drive puesto sin aprobación en ${c.ref}`)
    if (c.fechaPresentacion) esperar(dia(fila[10]) === c.fechaPresentacion, `Presentación de ${c.ref}`)
    if (c.fechaCobro) esperar(dia(fila[13]) === c.fechaCobro, `Cobro de ${c.ref}`)
    esperar(fila[14] === '', 'escribió en Estado')
    esperar(fila[15] === (c.estado === 'anulada' ? 'X' : ''), `Anula de ${c.ref}: "${fila[15]}"`)
    revisadas++
  })
  esperar(revisadas === enDiario.length, 'faltaron filas')
  esperar(f.at(-1).slice(8).every((v) => v === ''), 'tocó una fila de otra sucursal')
  esperar(gs('actualizarPlanillaDeControl') === 0, 'la segunda vez volvió a escribir')
})
prueba('nunca se borra un dato de la planilla', () => {
  const i = enDiario.findIndex((c) => !c.fechaCobro)
  diario.filas[i + 1][13] = vm.runInContext('new Date(2026, 10, 1, 12)', contexto) // alguien lo cargó a mano
  gs('actualizarPlanillaDeControl')
  esperar(esFecha(diario.filas[i + 1][13]), 'se borró un dato cargado a mano')
})
prueba('solo Cobranzas actualiza la planilla desde la aplicación', () => {
  como('rocamora@svaauto.com.ar')
  falla(() => gs('actualizarMiPlanilla'), 'Solo Cobranzas')
  falla(() => gs('agregarAQuiter', [['1']]), 'Solo Cobranzas')
  como('auditoria@svaauto.com.ar')
  esperar(typeof gs('actualizarMiPlanilla').completadas === 'number', 'no respondió')
})
prueba('PDF de una factura de hoy: queda en espera y se marca al unirse', () => {
  como('rocamora@svaauto.com.ar')
  const e = gs('subirEnEspera', 37, 999001, 'documentacion', '22365', '37-999001 siniestro 22365.pdf', 'application/pdf', 'AAAA')
  esperar(e.id && e.url !== undefined, 'no devolvió el registro')
  falla(() => gs('subirEnEspera', 16, 999002, 'factura', '', '16-999002.pdf', 'application/pdf', 'AAAA'), 'no es de la sucursal')
  const existente = gs('obtenerDatos').datos.comprobantes.find((x) => x.tipo === 'FC')
  falla(() => gs('subirEnEspera', existente.puntoVenta, existente.numero, 'factura', '', 'x.pdf', 'application/pdf', 'AAAA'), 'ya está cargada')
  esperar(gs('obtenerDatos').datos.enEspera.some((x) => x.id === e.id), 'la sucursal no lo ve en espera')
  como('gerencia.general@svaauto.com.ar')
  esperar(!gs('obtenerDatos').datos.enEspera.some((x) => x.id === e.id), 'Gerencia ve los PDF en espera')
  como('rocamora@svaauto.com.ar')
  falla(() => gs('marcarEsperaAsociada', [{ id: e.id, comprobanteId: 'x' }]), 'Solo Cobranzas')
  como('auditoria@svaauto.com.ar')
  esperar(gs('marcarEsperaAsociada', [{ id: e.id, comprobanteId: 'x' }]) === 1, 'no lo marcó')
  esperar(!gs('obtenerDatos').datos.enEspera.some((x) => x.id === e.id), 'sigue en espera después de unirse')
})
prueba('instalarDisparadores no falla', () => gs('instalarDisparadores'))

if (fallas) process.exit(1)
