/**
 * CobroSync · servidor en Google Apps Script (etapa 2, prueba piloto)
 *
 * Qué hace:
 * - Publica la aplicación como "aplicación web" dentro del dominio de la empresa.
 * - Guarda los datos en esta misma planilla de Google (una pestaña por tipo de dato).
 * - Guarda los PDF y fotos de cada factura en una carpeta del Drive de la empresa.
 * - Reconoce a cada persona por su cuenta de la empresa y le da su rol
 *   (pestaña "Usuarios"): Gerencia, Auditoría o Sucursal.
 * - Manda los avisos por mail (día 8 y día 22 sin documentación) y un resumen semanal
 *   a cada gerente de sucursal.
 *
 * Cómo se instala: ver google/LEEME.md.
 *
 * Seguridad:
 * - La aplicación se ejecuta con la cuenta del sector (la dueña de esta planilla), así las
 *   sucursales no necesitan acceso a la planilla ni a la carpeta de Drive.
 * - Solo entra gente del dominio de la empresa que figure en la pestaña "Usuarios".
 * - Una sucursal solo recibe y solo puede modificar sus propias facturas.
 * - Gerencia solo consulta: no puede modificar nada.
 */

// ── Pestañas de la planilla ──────────────────────────────────────────────────

var HOJAS = {
  config: { nombre: 'Config', columnas: ['clave', 'valor', 'para qué sirve'] },
  usuarios: { nombre: 'Usuarios', columnas: ['email', 'nombre', 'rol', 'sucursal'] },
  sucursales: { nombre: 'Sucursales', columnas: ['nombre', 'puntosVenta', 'gerente', 'correoGerente'] },
  aseguradoras: {
    nombre: 'Aseguradoras',
    columnas: ['id', 'nombre', 'razonSocial', 'cuit', 'email', 'emailReclamos', 'plazoPagoDias'],
  },
  comprobantes: {
    nombre: 'Comprobantes',
    columnas: [
      'id', 'ref', 'tipo', 'fecha', 'sucursal', 'puntoVenta', 'numero', 'aseguradoraId', 'siniestro', 'patente',
      'total', 'fechaDrive', 'subidoPor', 'fechaPresentacion', 'vencimiento', 'fechaCobro', 'estado',
      'ncReferencia', 'ncInformada', 'observaciones',
      // Estas columnas guardan listas en formato JSON (no editarlas a mano)
      'compromiso', 'reclamos', 'documentos', 'eventos', 'actualizado',
    ],
  },
  cobros: {
    nombre: 'CobrosPrevistos',
    columnas: ['id', 'comprobanteId', 'aseguradoraId', 'fechaIngreso', 'monto', 'estado'],
  },
};

var COLUMNAS_JSON = ['compromiso', 'reclamos', 'documentos', 'eventos'];
var COLUMNAS_NUMERO = ['puntoVenta', 'numero', 'total', 'plazoPagoDias', 'monto'];
var PLAZO_DOCUMENTACION = 7; // días que tiene la sucursal
var DIAS_GERENCIA_GENERAL = 21; // desde el día 22 se avisa también a Gerencia General

var CONFIG_INICIAL = [
  ['dominio', 'svaauto.com.ar', 'Solo entran cuentas de este dominio'],
  ['carpetaDriveId', '', 'Id de la carpeta de la unidad compartida donde se guardan los documentos'],
  ['correosGerencia', '', 'Correos de Gerencia General para los avisos críticos, separados por coma'],
  ['avisosPorMail', 'NO', 'SI para mandar los avisos y el resumen semanal por mail'],
  ['urlAplicacion', '', 'Link de la aplicación publicada, para incluirlo en los mails'],
];

// ── Aplicación web ──────────────────────────────────────────────────────────

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('CobroSync')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Lo primero que pide la aplicación: quién es la persona y qué datos puede ver. */
function obtenerDatos() {
  var usuario = usuarioActual_();
  var comprobantes = leerHoja_(HOJAS.comprobantes);
  if (usuario.rol === 'sucursal') {
    comprobantes = comprobantes.filter(function (c) { return c.sucursal === usuario.sucursal; });
  }
  var sucursales = leerHoja_(HOJAS.sucursales).map(function (s) {
    var pvs = String(s.puntosVenta || '').split(/[^0-9]+/).filter(String).map(Number);
    return { nombre: s.nombre, puntoVenta: pvs[0] || 0, puntosVenta: pvs, gerente: s.gerente, personas: [] };
  });
  return {
    usuario: usuario,
    datos: {
      aseguradoras: leerHoja_(HOJAS.aseguradoras),
      comprobantes: comprobantes,
      cobrosPrevistos: usuario.rol === 'sucursal' ? [] : leerHoja_(HOJAS.cobros),
      meta: { fechaCorte: hoy_(), sucursales: sucursales },
    },
  };
}

/** Guarda una factura completa (estado, documentos, conversación, reclamos). */
function guardarComprobante(c) {
  var usuario = usuarioActual_();
  if (usuario.rol === 'gerencia') throw new Error('Gerencia solo puede consultar.');
  return conBloqueo_(function () {
    var hoja = hoja_(HOJAS.comprobantes);
    var fila = buscarFila_(hoja, c.id);
    if (usuario.rol === 'sucursal') {
      // Una sucursal solo puede tocar facturas suyas que ya existan
      if (!fila) throw new Error('La factura no existe.');
      var actual = filaAObjeto_(HOJAS.comprobantes, hoja.getRange(fila, 1, 1, HOJAS.comprobantes.columnas.length).getValues()[0]);
      if (actual.sucursal !== usuario.sucursal) throw new Error('Esta factura es de otra sucursal.');
      // La sucursal solo cambia lo suyo: documentos, aviso de demora, conversación y aviso de NC.
      // Importes, fechas de presentación y cobro quedan como estaban.
      ['documentos', 'fechaDrive', 'subidoPor', 'compromiso', 'eventos', 'ncInformada'].forEach(function (k) {
        if (k in c) actual[k] = c[k];
      });
      if (c.estado === 'en_gestion' && actual.estado === 'pendiente_drive') actual.estado = 'en_gestion';
      c = actual;
    }
    escribirFila_(hoja, HOJAS.comprobantes, fila, c);
    return true;
  });
}

/** Agrega facturas nuevas (por ejemplo, desde la exportación del ERP). Solo Auditoría. */
function agregarComprobantes(lista) {
  var usuario = usuarioActual_();
  if (usuario.rol !== 'auditoria') throw new Error('Solo Auditoría puede cargar facturas nuevas.');
  return conBloqueo_(function () {
    var hoja = hoja_(HOJAS.comprobantes);
    var existentes = {};
    leerHoja_(HOJAS.comprobantes).forEach(function (c) { existentes[c.id] = true; existentes['ref:' + c.ref] = true; });
    var nuevas = 0;
    lista.forEach(function (c) {
      if (existentes[c.id] || existentes['ref:' + c.ref]) return;
      escribirFila_(hoja, HOJAS.comprobantes, null, c);
      nuevas++;
    });
    return nuevas;
  });
}

/**
 * Agrega las compañías que todavía no estén en la pestaña "Aseguradoras" (al pasar la planilla
 * de control a CobroSync). No cambia las que ya están cargadas. Solo Auditoría.
 */
function guardarAseguradoras(lista) {
  var usuario = usuarioActual_();
  if (usuario.rol !== 'auditoria') throw new Error('Solo Auditoría puede cargar compañías.');
  return conBloqueo_(function () {
    var hoja = hoja_(HOJAS.aseguradoras);
    var existentes = indexar_(leerHoja_(HOJAS.aseguradoras), 'id');
    var nuevas = 0;
    lista.forEach(function (a) {
      if (existentes[a.id]) return;
      escribirFila_(hoja, HOJAS.aseguradoras, null, a);
      nuevas++;
    });
    return nuevas;
  });
}

/**
 * Guarda un PDF o una foto en Drive: carpeta de la sucursal → mes → factura.
 * Devuelve el nombre y el link del archivo.
 */
function subirArchivo(comprobanteId, tipoDocumento, nombre, mime, base64) {
  var usuario = usuarioActual_();
  if (usuario.rol === 'gerencia') throw new Error('Gerencia solo puede consultar.');
  var c = leerHoja_(HOJAS.comprobantes).filter(function (x) { return x.id === comprobanteId; })[0];
  if (!c) throw new Error('La factura no existe.');
  if (usuario.rol === 'sucursal' && c.sucursal !== usuario.sucursal) throw new Error('Esta factura es de otra sucursal.');

  var raiz = DriveApp.getFolderById(config_('carpetaDriveId'));
  var carpeta = subcarpeta_(subcarpeta_(subcarpeta_(raiz, c.sucursal), String(c.fecha).slice(0, 7)),
    c.tipo + ' ' + c.puntoVenta + '-' + ('00000000' + c.numero).slice(-8));
  var extension = (nombre.match(/\.[a-z0-9]+$/i) || [''])[0];
  var archivo = carpeta.createFile(Utilities.newBlob(Utilities.base64Decode(base64), mime, tipoDocumento + '_' + hoy_() + extension));
  archivo.setDescription('Subido por ' + usuario.email + ' (' + nombre + ')');
  return { archivo: archivo.getName(), url: archivo.getUrl() };
}

// ── Avisos por mail ─────────────────────────────────────────────────────────

/**
 * Todos los días: avisa al gerente de la sucursal desde el día 8 sin documentación completa
 * y a Gerencia General desde el día 22. Cada aviso se manda una sola vez por factura
 * y queda registrado en la conversación de la factura.
 */
function avisosDiarios() {
  if (config_('avisosPorMail') !== 'SI') return;
  var hoy = hoy_();
  var sucursales = indexar_(leerHoja_(HOJAS.sucursales), 'nombre');
  var porDestinatario = {};

  conBloqueo_(function () {
    var hoja = hoja_(HOJAS.comprobantes);
    leerHoja_(HOJAS.comprobantes).forEach(function (c, i) {
      if (!esperaALaSucursal_(c)) return;
      var dias = diasEntre_(c.fecha, hoy);
      var eventos = c.eventos || [];
      var yaAvisado = function (marca) { return eventos.some(function (e) { return e.area === 'sistema' && e.texto.indexOf(marca) >= 0; }); };
      var cambio = false;
      var numero = c.tipo + ' E ' + c.puntoVenta + '-' + ('00000000' + c.numero).slice(-8);
      var suc = sucursales[c.sucursal] || {};

      if (dias > PLAZO_DOCUMENTACION && !yaAvisado('se avisó a') && suc.correoGerente) {
        agregar_(porDestinatario, suc.correoGerente, c.sucursal + ' · ' + numero + ' · ' + dias + ' días sin documentación completa');
        eventos.push({ fecha: hoy, autor: 'CobroSync', area: 'sistema', tipo: 'aviso', texto: 'Pasaron ' + PLAZO_DOCUMENTACION + ' días sin legajo completo: se avisó a ' + suc.gerente });
        cambio = true;
      }
      if (dias > DIAS_GERENCIA_GENERAL && !yaAvisado('gerencia general')) {
        String(config_('correosGerencia')).split(',').map(function (s) { return s.trim(); }).filter(String).forEach(function (correo) {
          agregar_(porDestinatario, correo, c.sucursal + ' · ' + numero + ' · ' + dias + ' días sin documentación completa');
        });
        eventos.push({ fecha: hoy, autor: 'CobroSync', area: 'sistema', tipo: 'aviso', texto: 'Más de ' + DIAS_GERENCIA_GENERAL + ' días sin legajo completo: se avisó a la gerencia general' });
        cambio = true;
      }
      if (cambio) {
        c.eventos = eventos;
        escribirFila_(hoja, HOJAS.comprobantes, i + 2, c);
      }
    });
  });

  Object.keys(porDestinatario).forEach(function (correo) {
    var lineas = porDestinatario[correo];
    enviar_(correo, 'CobroSync · ' + lineas.length + ' facturas con documentación pendiente',
      'Las siguientes facturas superaron el plazo para cargar la documentación:\n\n- ' + lineas.join('\n- '));
  });
}

/** Cada lunes: resumen de la semana para el gerente de cada sucursal. */
function resumenSemanal() {
  if (config_('avisosPorMail') !== 'SI') return;
  var hoy = hoy_();
  var comprobantes = leerHoja_(HOJAS.comprobantes);
  leerHoja_(HOJAS.sucursales).forEach(function (s) {
    if (!s.correoGerente) return;
    var pendientes = comprobantes.filter(function (c) { return c.sucursal === s.nombre && esperaALaSucursal_(c); });
    var criticas = pendientes.filter(function (c) { return diasEntre_(c.fecha, hoy) > DIAS_GERENCIA_GENERAL; });
    var atrasadas = pendientes.filter(function (c) { var d = diasEntre_(c.fecha, hoy); return d > PLAZO_DOCUMENTACION && d <= DIAS_GERENCIA_GENERAL; });
    var importe = pendientes.reduce(function (t, c) { return t + Number(c.total || 0); }, 0);
    enviar_(s.correoGerente, 'CobroSync · Resumen semanal de ' + s.nombre,
      'Facturas con documentación pendiente: ' + pendientes.length + '\n' +
      '- Atrasadas (8 a 21 días): ' + atrasadas.length + '\n' +
      '- Críticas (más de 21 días): ' + criticas.length + '\n' +
      'Importe retenido: $ ' + importe.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  });
}

// ── Instalación (se corren una vez, desde el editor de Apps Script) ───────────

/** Crea las pestañas con sus encabezados y la configuración inicial. */
function configurarPlanilla() {
  Object.keys(HOJAS).forEach(function (k) {
    var h = HOJAS[k];
    var hoja = SpreadsheetApp.getActive().getSheetByName(h.nombre) || SpreadsheetApp.getActive().insertSheet(h.nombre);
    if (hoja.getLastRow() === 0) {
      // Todo como texto: así Google no convierte fechas, CUIT, siniestros ni referencias por su cuenta
      hoja.getRange(1, 1, hoja.getMaxRows(), h.columnas.length).setNumberFormat('@');
      hoja.getRange(1, 1, 1, h.columnas.length).setValues([h.columnas]).setFontWeight('bold');
      hoja.setFrozenRows(1);
    }
  });
  var config = hoja_(HOJAS.config);
  if (config.getLastRow() < 2) config.getRange(2, 1, CONFIG_INICIAL.length, 3).setValues(CONFIG_INICIAL);
}

/** Programa los avisos diarios (8 h) y el resumen de los lunes (8 h). */
function instalarDisparadores() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('avisosDiarios').timeBased().everyDays(1).atHour(8).create();
  ScriptApp.newTrigger('resumenSemanal').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).create();
}

// ── Utilidades ──────────────────────────────────────────────────────────────

function usuarioActual_() {
  var email = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  var dominio = String(config_('dominio') || '').toLowerCase();
  if (!email || (dominio && email.split('@')[1] !== dominio)) throw new Error('Ingresá con tu cuenta de la empresa.');
  var u = leerHoja_(HOJAS.usuarios).filter(function (x) { return String(x.email).toLowerCase() === email; })[0];
  if (!u) throw new Error('Tu cuenta (' + email + ') no tiene acceso. Pedíselo a Auditoría.');
  var rol = String(u.rol).toLowerCase().indexOf('geren') === 0 ? 'gerencia' : String(u.rol).toLowerCase().indexOf('audit') === 0 ? 'auditoria' : 'sucursal';
  if (rol === 'sucursal' && !u.sucursal) throw new Error('Tu usuario no tiene una sucursal asignada.');
  return { email: email, nombre: u.nombre || email, rol: rol, sucursal: rol === 'sucursal' ? u.sucursal : null };
}

function hoja_(h) {
  var hoja = SpreadsheetApp.getActive().getSheetByName(h.nombre);
  if (!hoja) throw new Error('Falta la pestaña "' + h.nombre + '". Corré configurarPlanilla().');
  return hoja;
}

function leerHoja_(h) {
  var hoja = hoja_(h);
  if (hoja.getLastRow() < 2) return [];
  return hoja.getRange(2, 1, hoja.getLastRow() - 1, h.columnas.length).getValues()
    .filter(function (f) { return String(f[0]) !== ''; })
    .map(function (f) { return filaAObjeto_(h, f); });
}

function filaAObjeto_(h, fila) {
  var o = {};
  h.columnas.forEach(function (col, i) {
    var v = fila[i];
    if (v instanceof Date) v = Utilities.formatDate(v, 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
    if (COLUMNAS_JSON.indexOf(col) >= 0) v = v ? JSON.parse(v) : (col === 'compromiso' ? null : []);
    else if (COLUMNAS_NUMERO.indexOf(col) >= 0) v = v === '' ? 0 : Number(v);
    else if (col === 'ncInformada') v = v === '' ? null : v === true || v === 'TRUE' || v === 'SI';
    else if (v === '') v = null;
    else if (typeof v === 'number') v = String(v);
    o[col] = v;
  });
  if (o.observaciones === null) o.observaciones = '';
  if (o.siniestro === null) o.siniestro = '';
  if (o.patente === null) o.patente = '';
  return o;
}

function escribirFila_(hoja, h, fila, o) {
  var valores = h.columnas.map(function (col) {
    if (col === 'actualizado') return new Date();
    var v = o[col];
    if (COLUMNAS_JSON.indexOf(col) >= 0) return v === null || v === undefined ? '' : JSON.stringify(v);
    return v === null || v === undefined ? '' : v;
  });
  if (fila) hoja.getRange(fila, 1, 1, valores.length).setValues([valores]);
  else hoja.appendRow(valores);
}

function buscarFila_(hoja, id) {
  if (hoja.getLastRow() < 2) return null;
  var ids = hoja.getRange(2, 1, hoja.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return null;
}

function conBloqueo_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function config_(clave) {
  var fila = leerHoja_(HOJAS.config).filter(function (x) { return x.clave === clave; })[0];
  return fila ? fila.valor : '';
}

function subcarpeta_(padre, nombre) {
  var it = padre.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : padre.createFolder(nombre);
}

function esperaALaSucursal_(c) {
  if (c.tipo !== 'FC' || c.estado === 'anulada' || c.estado === 'cobrada' || c.fechaPresentacion) return false;
  var docs = c.documentos || [];
  return docs.length === 0 || docs.some(function (d) { return d.estado === 'faltante' || d.estado === 'observado'; });
}

function hoy_() {
  return Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
}

function diasEntre_(desde, hasta) {
  return Math.round((new Date(hasta + 'T00:00:00Z') - new Date(String(desde) + 'T00:00:00Z')) / 86400000);
}

function indexar_(lista, clave) {
  var o = {};
  lista.forEach(function (x) { o[x[clave]] = x; });
  return o;
}

function agregar_(mapa, clave, valor) {
  (mapa[clave] = mapa[clave] || []).push(valor);
}

function enviar_(para, asunto, cuerpo) {
  var url = config_('urlAplicacion');
  MailApp.sendEmail({
    to: para,
    subject: asunto,
    body: cuerpo + (url ? '\n\nVer en CobroSync: ' + url : '') + '\n\n— Mensaje automático de CobroSync (Auditoría)',
    name: 'CobroSync · Auditoría',
  });
}
