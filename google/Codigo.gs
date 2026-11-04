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
    columnas: ['id', 'nombre', 'razonSocial', 'cuit', 'email', 'emailReclamos', 'plazoPagoDias', 'recibeFce'],
  },
  comprobantes: {
    nombre: 'Comprobantes',
    columnas: [
      'id', 'ref', 'tipo', 'fecha', 'sucursal', 'puntoVenta', 'numero', 'aseguradoraId', 'siniestro', 'patente',
      'total', 'fechaDrive', 'subidoPor', 'fechaPresentacion', 'vencimiento', 'fechaCobro', 'estado',
      'ncReferencia', 'ncInformada', 'observaciones',
      // Estas columnas guardan listas en formato JSON (no editarlas a mano)
      'compromiso', 'reclamos', 'documentos', 'eventos', 'anulacionInformada',
      'acreditado', 'importeCobrado', 'percepciones', 'actualizado',
      // Columnas agregadas después (siempre al final, para no correr las que ya tienen datos)
      'fechaAprobacion',
    ],
  },
  lecturas: { nombre: 'Lecturas', columnas: ['email', 'ids', 'actualizado'] },
  cobros: {
    nombre: 'CobrosPrevistos',
    columnas: ['id', 'comprobanteId', 'aseguradoraId', 'fechaIngreso', 'monto', 'estado'],
  },
};

var COLUMNAS_JSON = ['compromiso', 'reclamos', 'documentos', 'eventos', 'anulacionInformada'];
var COLUMNAS_NUMERO = ['puntoVenta', 'numero', 'total', 'plazoPagoDias', 'monto'];
var COLUMNAS_NUMERO_OPCIONAL = ['acreditado', 'importeCobrado', 'percepciones']; // vacío = sin dato
// Los plazos de la documentación (común y MiPyME) están en la pestaña Config y se cambian
// desde Ajustes en la aplicación: ver plazos_().
var RECLAMOS_SIN_RESPUESTA = 3; // con 3 reclamos sin respuesta, Auditoría pide apoyo a Gerencia

var CONFIG_INICIAL = [
  ['dominio', 'svaauto.com.ar', 'Solo entran cuentas de este dominio'],
  ['carpetaDriveId', '', 'Id de la carpeta de la unidad compartida donde se guardan los documentos'],
  ['correosGerencia', '', 'Correos de Gerencia General para los avisos críticos, separados por coma'],
  ['avisosPorMail', 'NO', 'SI para mandar los mails de los lunes (resumen a cada sucursal y pendientes a Gerencia General)'],
  ['plazoDocumentacion', '10', 'Días que tiene la sucursal para subir la documentación de una factura común'],
  ['plazoDocumentacionMipyme', '5', 'Ídem para una factura MiPyME (factura de crédito electrónica)'],
  ['diasCritica', '21', 'Desde estos días sin documentación, la factura común es crítica (se avisa a Gerencia)'],
  ['diasCriticaMipyme', '12', 'Ídem para una factura MiPyME'],
  ['montoMinimoMipyme', '5549862', 'Monto mínimo de la factura de crédito MiPyME (total). Se actualiza una vez por año'],
  ['puntosVentaMipyme', '', 'Puntos de venta que se usan solo para MiPyME, separados por coma (opcional)'],
  ['diasRespuestaReclamo', '7', 'Días que se espera la respuesta de la compañía a un reclamo. Después: volver a reclamar; con 3, apoyo de Gerencia'],
  ['textoAvisoApoyo', '', 'Notificación a Gerencia cuando una compañía no responde 3 reclamos (vacío = texto original). Se cambia en Ajustes'],
  ['textoAvisoCritica', '', 'Notificación a Gerencia por facturas críticas (vacío = texto original). Se cambia en Ajustes'],
  ['urlAplicacion', '', 'Link de la aplicación publicada, para incluirlo en los mails'],
  ['planillaControlId', '', 'Id de la planilla de control de Auditoría: CobroSync le agrega el ERP en Quiter y completa Diario'],
  ['pestanaQuiter', 'Quiter', 'Pestaña de la planilla de control donde se pega el Excel del ERP'],
  ['pestanaDiario', 'Diario', 'Pestaña de la planilla de control con Drive (I), Presentación (K), Cobro (N) y Anula (P)'],
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
    comprobantes = comprobantes.filter(function (c) { return mismaSucursal_(c.sucursal, usuario.sucursal); });
  }
  var sucursales = leerHoja_(HOJAS.sucursales).map(function (s) {
    var pvs = String(s.puntosVenta || '').split(/[^0-9]+/).filter(String).map(Number);
    return { nombre: s.nombre, puntoVenta: pvs[0] || 0, puntosVenta: pvs, gerente: s.gerente, personas: [] };
  });
  return {
    usuario: usuario,
    ahora: ahora_(),
    leidas: leidasDe_(usuario.email),
    datos: {
      aseguradoras: leerHoja_(HOJAS.aseguradoras),
      comprobantes: comprobantes,
      cobrosPrevistos: usuario.rol === 'sucursal' ? [] : leerHoja_(HOJAS.cobros),
      meta: {
        fechaCorte: hoy_(),
        sucursales: sucursales,
        plazos: plazos_(),
        textos: { apoyo: String(config_('textoAvisoApoyo') || ''), critica: String(config_('textoAvisoCritica') || '') },
        avisos: usuario.rol === 'auditoria' ? { porMail: config_('avisosPorMail') === 'SI', correosGerencia: String(config_('correosGerencia') || '') } : undefined,
      },
    },
  };
}

/**
 * Guarda los cambios hechos en la aplicación, uno por uno, sobre lo que hay guardado en ese momento.
 * Así, si dos personas trabajan en la misma factura a la vez, no se pisan: por ejemplo, la sucursal
 * sube la orden mientras Auditoría escribe una observación, y quedan las dos cosas.
 *
 * Cada cambio es { id, campos?, documentos?, evento?, nuevo? }:
 * - campos: datos de la factura que cambian (estado, fechas, observaciones, reclamos…)
 * - documentos: solo los documentos que cambiaron (se reemplazan por tipo: factura u orden)
 * - evento: un mensaje nuevo para la conversación (se agrega, nunca reemplaza)
 * - nuevo: una factura nueva completa (por ejemplo, desde el ERP). Solo Auditoría.
 */
var CAMPOS_SUCURSAL = ['fechaDrive', 'subidoPor', 'compromiso', 'ncInformada', 'estado', 'anulacionInformada'];

function aplicarCambios(cambios) {
  var usuario = usuarioActual_();
  if (usuario.rol === 'gerencia') throw new Error('Gerencia solo puede consultar.');
  return conBloqueo_(function () {
    var hoja = hoja_(HOJAS.comprobantes);
    var tocadas = {};
    var errores = [];
    cambios.forEach(function (op) {
      // Cada cambio se aplica por separado: si uno no se puede guardar, los demás sí
      try { aplicarUno_(hoja, usuario, op, tocadas); } catch (e) {
        errores.push({ id: op.id, mensaje: e.message });
        var f = buscarFila_(hoja, op.id);
        if (f) tocadas[op.id] = f; // se devuelve como está guardada, para que la pantalla vuelva atrás
      }
    });
    var actualizadas = Object.keys(tocadas).map(function (id) { return leerFila_(hoja, tocadas[id]); });
    return { comprobantes: actualizadas, ahora: ahora_(), errores: errores };
  });
}

function aplicarUno_(hoja, usuario, op, tocadas) {
      var fila = buscarFila_(hoja, op.id);
      if (op.nuevo) {
        if (usuario.rol !== 'auditoria') throw new Error('Solo Auditoría puede cargar facturas nuevas.');
        if (fila) return; // ya estaba
        escribirFila_(hoja, HOJAS.comprobantes, null, op.nuevo);
        tocadas[op.id] = hoja.getLastRow();
        return;
      }
      if (!fila) throw new Error('La factura no existe.');
      var c = leerFila_(hoja, fila);
      if (usuario.rol === 'sucursal' && !mismaSucursal_(c.sucursal, usuario.sucursal)) throw new Error('Esta factura es de otra sucursal.');

      if (op.campos) {
        Object.keys(op.campos).forEach(function (k) {
          if (k === 'id' || k === 'documentos' || k === 'eventos') return;
          if (usuario.rol === 'sucursal') {
            // La sucursal solo cambia lo suyo; importes, presentación y cobro quedan como estaban
            if (CAMPOS_SUCURSAL.indexOf(k) < 0) return;
            if (k === 'estado' && !(op.campos.estado === 'en_gestion' && c.estado === 'pendiente_drive')) return;
          }
          c[k] = op.campos[k];
        });
      }
      if (op.documentos) {
        var docs = c.documentos || [];
        op.documentos.forEach(function (d) {
          var i = docs.map(function (x) { return x.tipo; }).indexOf(d.tipo);
          // La sucursal sube para revisar: aprobar u observar es de Auditoría. Sí puede quitar lo que
          // subió por error mientras Auditoría no lo revisó (vuelve a "falta")
          var quita = d.estado === 'faltante' && i >= 0 && docs[i].estado === 'en_revision';
          if (usuario.rol === 'sucursal' && d.estado !== 'en_revision' && !quita && !(i >= 0 && docs[i].estado === d.estado)) return;
          if (i >= 0) docs[i] = d; else docs.push(d);
        });
        c.documentos = docs;
        // Fecha de la documentación completa (la que va a la columna Drive de la planilla):
        // el día en que Auditoría aprueba lo último. Si después se observa algo, se vacía.
        var aprobada = c.tipo === 'FC' && docs.length > 0 && docs.every(function (x) { return x.estado === 'ok'; });
        if (!aprobada) c.fechaAprobacion = null;
        else if (!c.fechaAprobacion) c.fechaAprobacion = hoy_();
      }
      if (op.evento) {
        // El servidor firma el mensaje: nadie puede escribir en nombre de otro
        (c.eventos = c.eventos || []).push({ fecha: hoy_(), autor: usuario.nombre, area: usuario.rol, tipo: op.evento.tipo, texto: String(op.evento.texto) });
      }
      escribirFila_(hoja, HOJAS.comprobantes, fila, c);
      tocadas[op.id] = fila;
}

/** Lo que cambió desde la última consulta (la aplicación pregunta cada minuto). */
function obtenerCambios(desde) {
  var usuario = usuarioActual_();
  var hoja = hoja_(HOJAS.comprobantes);
  var ahora = ahora_();
  if (hoja.getLastRow() < 2) return { comprobantes: [], ahora: ahora };
  var col = HOJAS.comprobantes.columnas.indexOf('actualizado') + 1;
  var marcas = hoja.getRange(2, col, hoja.getLastRow() - 1, 1).getValues();
  var lista = [];
  for (var i = 0; i < marcas.length; i++) {
    if (String(marcas[i][0]) > String(desde)) lista.push(leerFila_(hoja, i + 2));
  }
  if (usuario.rol === 'sucursal') lista = lista.filter(function (c) { return mismaSucursal_(c.sucursal, usuario.sucursal); });
  return { comprobantes: lista, ahora: ahora };
}

/** Las notificaciones leídas se guardan en la cuenta: valen en cualquier computadora o celular. */
function marcarLeidas(ids) {
  var email = usuarioActual_().email;
  return conBloqueo_(function () {
    var hoja = hoja_(HOJAS.lecturas);
    var fila = buscarFila_(hoja, email);
    var actuales = fila ? JSON.parse(hoja.getRange(fila, 2).getValues()[0][0] || '[]') : [];
    var todas = actuales.concat(ids.filter(function (id) { return actuales.indexOf(id) < 0; })).slice(-1500);
    var valores = [[email, JSON.stringify(todas), ahora_()]];
    if (fila) hoja.getRange(fila, 1, 1, 3).setValues(valores);
    else hoja.appendRow(valores[0]);
    return true;
  });
}

function leidasDe_(email) {
  var hoja = SpreadsheetApp.getActive().getSheetByName(HOJAS.lecturas.nombre);
  if (!hoja) return [];
  var fila = buscarFila_(hoja, email);
  return fila ? JSON.parse(hoja.getRange(fila, 2).getValues()[0][0] || '[]') : [];
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
      existentes[c.id] = true;
      if (c.ref) existentes['ref:' + c.ref] = true;
      nuevas++;
    });
    return nuevas;
  });
}

/**
 * Pasa la planilla de control a CobroSync. Se puede repetir durante la prueba (cuando se usa
 * la planilla en paralelo):
 * - las facturas nuevas (por referencia) se agregan;
 * - en las que ya están, solo se completa lo que la planilla tenga más avanzado:
 *   fecha de presentación, vencimiento y cobro. Nunca se borra ni se vuelve atrás nada,
 *   y no se tocan documentos, conversación ni reclamos.
 * Solo Auditoría.
 */
function sincronizarDesdePlanilla(lista) {
  var usuario = usuarioActual_();
  if (usuario.rol !== 'auditoria') throw new Error('Solo Auditoría puede cargar la planilla.');
  return conBloqueo_(function () {
    var hoja = hoja_(HOJAS.comprobantes);
    var actuales = leerHoja_(HOJAS.comprobantes);
    var filaPorRef = {};
    actuales.forEach(function (c, i) { if (c.ref) filaPorRef[String(c.ref)] = { c: c, fila: i + 2 }; });
    var resultado = { nuevas: 0, actualizadas: 0, omitidas: 0 };
    // Solo las sucursales cargadas en la pestaña Sucursales (las del piloto); el resto sigue en la planilla
    var delPiloto = leerHoja_(HOJAS.sucursales).map(function (s) { return s.nombre; });
    lista.forEach(function (p) {
      if (delPiloto.length && !delPiloto.some(function (n) { return mismaSucursal_(n, p.sucursal); })) {
        resultado.omitidas++;
        return;
      }
      var ref = String(p.ref || '');
      var existente = ref ? filaPorRef[ref] : null;
      if (!existente) {
        escribirFila_(hoja, HOJAS.comprobantes, null, p);
        if (ref) filaPorRef[ref] = { c: p, fila: hoja.getLastRow() };
        resultado.nuevas++;
        return;
      }
      var c = existente.c;
      var cambio = false;
      if (!c.fechaPresentacion && p.fechaPresentacion) {
        c.fechaPresentacion = p.fechaPresentacion;
        c.vencimiento = p.vencimiento;
        if (c.estado !== 'cobrada' && c.estado !== 'anulada') c.estado = 'presentada';
        cambio = true;
      }
      if (!c.fechaAprobacion && p.fechaAprobacion && (c.documentos || []).every(function (d) { return d.estado === 'ok'; })) {
        c.fechaAprobacion = p.fechaAprobacion;
        cambio = true;
      }
      if (c.estado !== 'cobrada' && p.estado === 'cobrada') {
        c.estado = 'cobrada';
        c.fechaCobro = p.fechaCobro;
        cambio = true;
      }
      if (c.estado !== 'anulada' && p.estado === 'anulada') {
        c.estado = 'anulada';
        cambio = true;
      }
      if (cambio) {
        (c.eventos = c.eventos || []).push({ fecha: hoy_(), autor: usuario.nombre, area: 'auditoria', tipo: 'mensaje', texto: 'Actualizado desde la planilla de control' });
        escribirFila_(hoja, HOJAS.comprobantes, existente.fila, c);
        resultado.actualizadas++;
      }
    });
    return resultado;
  });
}

/**
 * Agrega las compañías que todavía no estén en la pestaña "Aseguradoras" (al pasar la planilla
 * de control a CobroSync). No cambia las que ya están cargadas. Solo Auditoría.
 */
function guardarAseguradoras(lista, completarExistentes) {
  var usuario = usuarioActual_();
  if (usuario.rol !== 'auditoria') throw new Error('Solo Auditoría puede cargar compañías.');
  return conBloqueo_(function () {
    var hoja = hoja_(HOJAS.aseguradoras);
    var existentes = indexar_(leerHoja_(HOJAS.aseguradoras), 'id');
    var nuevas = 0;
    lista.forEach(function (a) {
      var actual = existentes[a.id];
      if (!actual) {
        escribirFila_(hoja, HOJAS.aseguradoras, null, a);
        nuevas++;
        return;
      }
      // Con la pestaña CP o Info. Compañías: completa razón social, CUIT, plazo y correos
      if (completarExistentes) {
        ['razonSocial', 'cuit', 'email', 'emailReclamos', 'plazoPagoDias'].forEach(function (k) { if (a[k]) actual[k] = a[k]; });
        escribirFila_(hoja, HOJAS.aseguradoras, buscarFila_(hoja, a.id), actual);
      }
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
  if (usuario.rol === 'sucursal' && !mismaSucursal_(c.sucursal, usuario.sucursal)) throw new Error('Esta factura es de otra sucursal.');

  // Solo PDF (las compañías no aceptan otros formatos) y con el número de esta factura en el nombre
  if (mime !== 'application/pdf' && !/\.pdf$/i.test(nombre)) throw new Error('Solo se aceptan PDF.');
  var numeros = [];
  var m, re = /(\d{1,5})\s*[-_ ]\s*0*(\d{1,8})/g;
  while ((m = re.exec(String(nombre))) !== null) numeros.push(Number(m[1]) + '-' + Number(m[2]));
  if (numeros.indexOf(Number(c.puntoVenta) + '-' + Number(c.numero)) < 0) {
    throw new Error('El nombre del archivo tiene que tener el número de la factura (' + c.puntoVenta + '-' + c.numero + ').');
  }
  var raiz = DriveApp.getFolderById(config_('carpetaDriveId'));
  var carpeta = subcarpeta_(subcarpeta_(subcarpeta_(raiz, c.sucursal), String(c.fecha).slice(0, 7)),
    c.tipo + ' ' + c.puntoVenta + '-' + c.numero);
  var extension = (nombre.match(/\.[a-z0-9]+$/i) || [''])[0];
  var archivo = carpeta.createFile(Utilities.newBlob(Utilities.base64Decode(base64), mime, tipoDocumento + '_' + hoy_() + extension));
  archivo.setDescription('Subido por ' + usuario.email + ' (' + nombre + ')');
  return { archivo: archivo.getName(), url: archivo.getUrl() };
}

// ── Avisos por mail ─────────────────────────────────────────────────────────

/**
 * Todos los días a las 8 (sin mails): marca en cada factura cuándo pasó el plazo de la sucursal y
 * cuándo pasó a crítica. Con eso, la sucursal y Gerencia lo ven en sus notificaciones de CobroSync.
 * Los mails salen solo los lunes (resumenSemanal), con lo que quedó pendiente.
 */
function avisosDiarios() {
  var hoy = hoy_();
  var p = plazos_();
  var sinFce = companiasSinFce_();
  var sucursales = indexar_(leerHoja_(HOJAS.sucursales), 'nombre');
  conBloqueo_(function () {
    var hoja = hoja_(HOJAS.comprobantes);
    leerHoja_(HOJAS.comprobantes).forEach(function (c, i) {
      if (!esperaALaSucursal_(c) || compromisoVigente_(c, hoy)) return;
      var eventos = c.eventos || [];
      var yaAvisado = function (marca) { return eventos.some(function (e) { return e.area === 'sistema' && e.texto.indexOf(marca) >= 0; }); };
      var dias = diasEntre_(c.fecha, hoy);
      var plazo = plazoDe_(c, p, sinFce);
      var critica = criticaDe_(c, p, sinFce);
      var cambio = false;
      if (dias > plazo && !yaAvisado('se avisó a') && !yaAvisado('resumen del lunes')) {
        var suc = sucursales[c.sucursal] || buscarSucursal_(sucursales, c.sucursal);
        eventos.push({ fecha: hoy, autor: 'CobroSync', area: 'sistema', tipo: 'aviso', texto: 'Pasaron ' + plazo + ' días sin legajo completo' + (esMipyme_(c, p, sinFce) ? ' (factura MiPyME)' : '') + ': se incluye en el resumen del lunes para ' + (suc.gerente || 'el gerente de la sucursal') });
        cambio = true;
      }
      if (dias > critica && !yaAvisado('gerencia general')) {
        eventos.push({ fecha: hoy, autor: 'CobroSync', area: 'sistema', tipo: 'aviso', texto: 'Más de ' + critica + ' días sin legajo completo: se avisó a la gerencia general' });
        cambio = true;
      }
      if (cambio) {
        c.eventos = eventos;
        escribirFila_(hoja, HOJAS.comprobantes, i + 2, c);
      }
    });
  });
}

/** La sucursal avisó para cuándo lo sube y esa fecha todavía no pasó: no se la reclama. */
function compromisoVigente_(c, hoy) {
  return !!(c.compromiso && c.compromiso.fecha && String(c.compromiso.fecha) >= hoy);
}

/**
 * Cada lunes: el resumen de la semana para el gerente de cada sucursal y, para Gerencia General,
 * un solo mail con lo que quedó pendiente y necesita su intervención. Durante la semana, Gerencia
 * lo ve en las notificaciones de CobroSync.
 */
function resumenSemanal() {
  if (config_('avisosPorMail') !== 'SI') return;
  var hoy = hoy_();
  var comprobantes = leerHoja_(HOJAS.comprobantes);
  pendientesParaGerencia_(comprobantes, hoy);
  var pesos = function (n) { return '$ ' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var p = plazos_();
  var sinFce = companiasSinFce_();
  leerHoja_(HOJAS.sucursales).forEach(function (s) {
    if (!s.correoGerente) return;
    // Solo lo que pasó el plazo (sin las que tienen una fecha comprometida que todavía no llegó)
    var atrasadas = comprobantes
      .filter(function (c) { return mismaSucursal_(c.sucursal, s.nombre) && esperaALaSucursal_(c) && !compromisoVigente_(c, hoy) && diasEntre_(c.fecha, hoy) > plazoDe_(c, p, sinFce); })
      .sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
    if (!atrasadas.length) return; // si no hay nada pendiente, no sale ningún mail
    var criticas = atrasadas.filter(function (c) { return diasEntre_(c.fecha, hoy) > criticaDe_(c, p, sinFce); }).length;
    var importe = atrasadas.reduce(function (t, c) { return t + Number(c.total || 0) - Number(c.acreditado || 0); }, 0);
    var lineas = atrasadas.slice(0, 40).map(function (c) {
      return c.tipo + ' E ' + c.puntoVenta + '-' + c.numero + ' · ' + diasEntre_(c.fecha, hoy) + ' días' +
        (esMipyme_(c, p, sinFce) ? ' · MiPyME' : '') + (c.siniestro ? ' · siniestro ' + c.siniestro : '');
    });
    if (atrasadas.length > 40) lineas.push('y ' + (atrasadas.length - 40) + ' más (están todas en CobroSync)');
    enviar_(s.correoGerente, 'CobroSync · Resumen semanal de ' + s.nombre + ': ' + atrasadas.length + (atrasadas.length === 1 ? ' factura' : ' facturas') + ' sin documentación',
      'Estas facturas pasaron el plazo para la documentación (' + p.comun + ' días; ' + p.mipyme + ' si es MiPyME)' + (criticas ? '. ' + criticas + ' ya son críticas' : '') +
      '. Importe retenido: ' + pesos(importe) + '. Se solicita revisar con el equipo que se suban esta semana:\n\n- ' + lineas.join('\n- '));
  });
}

/** Lo que sigue sin resolver al lunes: compañías que no responden 3 reclamos y documentación crítica. */
function pendientesParaGerencia_(comprobantes, hoy) {
  var gerencia = String(config_('correosGerencia')).split(',').map(function (x) { return x.trim(); }).filter(String);
  if (!gerencia.length) return;
  var companias = indexar_(leerHoja_(HOJAS.aseguradoras), 'id');
  var p = plazos_();
  var sinFce = companiasSinFce_();
  var criticas = {};
  var sinRespuesta = {};
  var sumar = function (mapa, clave, c) {
    var g = mapa[clave] = mapa[clave] || { cantidad: 0, importe: 0 };
    g.cantidad++;
    g.importe += Number(c.total || 0) - Number(c.acreditado || 0);
  };
  comprobantes.forEach(function (c) {
    if (esperaALaSucursal_(c) && diasEntre_(c.fecha, hoy) > criticaDe_(c, p, sinFce)) sumar(criticas, c.sucursal, c);
    var vencida = c.tipo === 'FC' && c.estado === 'presentada' && c.vencimiento && String(c.vencimiento) < hoy;
    // 3 reclamos y pasó la espera del último sin respuesta
    var fechas = (c.reclamos || []).map(function (r) { return String(r.fecha || ''); }).filter(String).sort();
    var esperaCumplida = !fechas.length || diasEntre_(fechas[fechas.length - 1], hoy) >= p.respuestaReclamo;
    if (vencida && (c.reclamos || []).length >= RECLAMOS_SIN_RESPUESTA && esperaCumplida) sumar(sinRespuesta, (companias[c.aseguradoraId] || {}).nombre || c.aseguradoraId, c);
  });
  var pesos = function (n) { return '$ ' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var facturas = function (n) { return n + (n === 1 ? ' factura' : ' facturas'); };
  var lista = function (mapa) {
    return Object.keys(mapa).sort(function (a, b) { return mapa[b].importe - mapa[a].importe; })
      .map(function (n) { return '- ' + n + ': ' + facturas(mapa[n].cantidad) + ' (' + pesos(mapa[n].importe) + ')'; }).join('\n');
  };
  var partes = [];
  if (Object.keys(sinRespuesta).length) {
    partes.push('Auditoría solicita su apoyo: las siguientes compañías no respondieron 3 reclamos de facturas vencidas.\n' + lista(sinRespuesta));
  }
  if (Object.keys(criticas).length) {
    partes.push('Facturas críticas: llevan más de ' + p.criticaComun + ' días sin documentación (' + p.criticaMipyme + ' si es MiPyME). Se solicita su intervención para que cada sucursal complete la documentación esta semana.\n' + lista(criticas));
  }
  if (!partes.length) return;
  gerencia.forEach(function (correo) {
    enviar_(correo, 'CobroSync · Pendientes de la semana que requieren su apoyo', 'Pendientes sin resolver al ' + hoy.split('-').reverse().join('/') + ':\n\n' + partes.join('\n\n'));
  });
}

// ── Plazos (común y MiPyME) y Ajustes ────────────────────────────────────────

function plazos_() {
  var n = function (clave, porDefecto) { var v = Number(String(config_(clave)).replace(/[^0-9]/g, '')); return v > 0 ? v : porDefecto; };
  return {
    comun: n('plazoDocumentacion', 10),
    mipyme: n('plazoDocumentacionMipyme', 5),
    criticaComun: n('diasCritica', 21),
    criticaMipyme: n('diasCriticaMipyme', 12),
    montoMinimoMipyme: n('montoMinimoMipyme', 5549862),
    puntosVentaMipyme: String(config_('puntosVentaMipyme') || '').split(/[^0-9]+/).filter(String).map(Number),
    respuestaReclamo: n('diasRespuestaReclamo', 7),
  };
}

/** Compañías marcadas con recibeFce = NO (las demás son grandes empresas y reciben FCE). */
function companiasSinFce_() {
  var o = {};
  leerHoja_(HOJAS.aseguradoras).forEach(function (a) { if (/^(no|false)$/i.test(String(a.recibeFce || ''))) o[a.id] = true; });
  return o;
}

/** Igual que en la aplicación (src/domain/plazos.ts): la regla del régimen de factura de crédito MiPyME. */
function esMipyme_(c, p, sinFce) {
  if (c.tipo !== 'FC') return false;
  if (p.puntosVentaMipyme.indexOf(Number(c.puntoVenta)) >= 0) return true;
  return !sinFce[c.aseguradoraId] && Number(c.total || 0) >= p.montoMinimoMipyme;
}
function plazoDe_(c, p, sinFce) { return esMipyme_(c, p, sinFce) ? p.mipyme : p.comun; }
function criticaDe_(c, p, sinFce) { return esMipyme_(c, p, sinFce) ? p.criticaMipyme : p.criticaComun; }

/** Pantalla Ajustes: plazos, compañías que reciben FCE y avisos por mail. Solo Auditoría. */
function guardarAjustes(a) {
  if (usuarioActual_().rol !== 'auditoria') throw new Error('Solo Auditoría puede cambiar los ajustes.');
  return conBloqueo_(function () {
    var valores = {
      plazoDocumentacion: a.plazos.comun,
      plazoDocumentacionMipyme: a.plazos.mipyme,
      diasCritica: a.plazos.criticaComun,
      diasCriticaMipyme: a.plazos.criticaMipyme,
      montoMinimoMipyme: a.plazos.montoMinimoMipyme,
      puntosVentaMipyme: (a.plazos.puntosVentaMipyme || []).join(', '),
      diasRespuestaReclamo: a.plazos.respuestaReclamo || 7,
      avisosPorMail: a.avisos.porMail ? 'SI' : 'NO',
      correosGerencia: String(a.avisos.correosGerencia || ''),
      textoAvisoApoyo: a.textos ? String(a.textos.apoyo || '') : String(config_('textoAvisoApoyo') || ''),
      textoAvisoCritica: a.textos ? String(a.textos.critica || '') : String(config_('textoAvisoCritica') || ''),
    };
    var cfg = hoja_(HOJAS.config);
    var claves = cfg.getLastRow() > 1 ? cfg.getRange(2, 1, cfg.getLastRow() - 1, 1).getValues().map(function (f) { return f[0]; }) : [];
    Object.keys(valores).forEach(function (k) {
      var i = claves.indexOf(k);
      if (i >= 0) cfg.getRange(i + 2, 2).setValue(String(valores[k]));
      else cfg.appendRow([k, String(valores[k]), '']);
    });
    var sinFce = a.companiasSinFce || [];
    var hoja = hoja_(HOJAS.aseguradoras);
    var col = HOJAS.aseguradoras.columnas.indexOf('recibeFce') + 1;
    if (hoja.getLastRow() > 1) {
      var ids = hoja.getRange(2, 1, hoja.getLastRow() - 1, 1).getValues();
      ids.forEach(function (f, i) { hoja.getRange(i + 2, col).setValue(sinFce.indexOf(String(f[0])) >= 0 ? 'NO' : 'SI'); });
    }
    return true;
  });
}

// ── La planilla de control de Auditoría se sigue llenando sola ─────────────────

/**
 * Mientras dure el piloto, la planilla de control sigue siendo la del sector, con su orden de
 * siempre. CobroSync la mantiene al día sin cambiarle la forma:
 * 1. Al cargar el Excel del ERP en CobroSync, las filas nuevas se agregan al final de la pestaña
 *    Quiter, tal cual (de todas las sucursales). La hoja Diario las toma como siempre.
 * 2. Cada hora, en la hoja Diario, se completan las columnas que hoy se escriben a mano para las
 *    facturas de las sucursales del piloto: Drive (documentación aprobada), Presentación, Cobro y la
 *    X de "Anula" si la factura se anuló con una nota de crédito. Se busca por la referencia (columna B).
 *    El Estado (columna O) no se toca: lo calcula la planilla con esas fechas.
 * Nunca se borra un dato, nunca se pisa una fórmula y no se mueve ninguna fila.
 */
var COLUMNAS_DIARIO = { ref: 2, drive: 9, presentacion: 11, cobro: 14, anula: 16 }; // B, I, K, N, P

function planillaDeControl_() {
  var id = config_('planillaControlId');
  return id ? SpreadsheetApp.openById(id) : null;
}

/** Botón de la aplicación al cargar el ERP: agrega a la pestaña Quiter las filas que no estén. Solo Auditoría. */
function agregarAQuiter(filas) {
  if (usuarioActual_().rol !== 'auditoria') throw new Error('Solo Auditoría puede cargar el ERP.');
  var libro = planillaDeControl_();
  if (!libro) return { configurada: false, agregadas: 0 };
  return conBloqueo_(function () {
    var nombre = config_('pestanaQuiter') || 'Quiter';
    var hoja = libro.getSheetByName(nombre);
    if (!hoja) throw new Error('No encuentro la pestaña "' + nombre + '" en la planilla de control.');
    var refs = {};
    if (hoja.getLastRow() > 0) {
      hoja.getRange(1, 1, hoja.getLastRow(), 1).getValues().forEach(function (f) { refs[refTexto_(f[0])] = true; });
    }
    var nuevas = [];
    filas.forEach(function (f) {
      var ref = refTexto_(f[0]);
      if (!/^\d+$/.test(ref) || refs[ref]) return;
      refs[ref] = true;
      nuevas.push(f.map(valorDeCelda_));
    });
    if (nuevas.length) {
      var ancho = Math.max.apply(null, nuevas.map(function (f) { return f.length; }));
      nuevas = nuevas.map(function (f) { while (f.length < ancho) f.push(''); return f; });
      hoja.getRange(hoja.getLastRow() + 1, 1, nuevas.length, ancho).setValues(nuevas);
    }
    var completadas = completarDiario_(libro);
    return { configurada: true, agregadas: nuevas.length, completadas: completadas };
  });
}

/** Disparador de cada hora (y botón "Actualizar mi planilla ahora"). */
function actualizarPlanillaDeControl() {
  var libro = planillaDeControl_();
  return libro ? completarDiario_(libro) : 0;
}

function actualizarMiPlanilla() {
  if (usuarioActual_().rol !== 'auditoria') throw new Error('Solo Auditoría puede actualizar la planilla.');
  if (!config_('planillaControlId')) throw new Error('Falta el id de la planilla de control en la pestaña Config (planillaControlId).');
  return { completadas: actualizarPlanillaDeControl(), ahora: ahora_() };
}

function completarDiario_(libro) {
  var hoja = libro.getSheetByName(config_('pestanaDiario') || 'Diario');
  if (!hoja || hoja.getLastRow() < 2) return 0;
  var ultima = hoja.getLastRow();
  var refs = hoja.getRange(1, COLUMNAS_DIARIO.ref, ultima, 1).getValues();
  var bloque = hoja.getRange(1, COLUMNAS_DIARIO.drive, ultima, COLUMNAS_DIARIO.anula - COLUMNAS_DIARIO.drive + 1);
  var valores = bloque.getValues();
  var formulas = bloque.getFormulas();
  var filaDeRef = {};
  refs.forEach(function (f, i) { var r = refTexto_(f[0]); if (/^\d+$/.test(r) && !filaDeRef[r]) filaDeRef[r] = i; });

  var cambios = 0;
  leerHoja_(HOJAS.comprobantes).forEach(function (c) {
    if (c.tipo !== 'FC') return;
    var i = filaDeRef[refTexto_(c.ref)];
    if (i === undefined) return;
    var poner = function (columna, valor, esFecha) {
      if (!valor) return; // nunca se borra lo que ya está
      var j = columna - COLUMNAS_DIARIO.drive;
      if (formulas[i][j]) return; // nunca se pisa una fórmula
      var actual = valores[i][j];
      var igual = esFecha ? fechaDeCelda_(actual) === valor : String(actual).trim().toUpperCase() === valor;
      if (igual) return;
      hoja.getRange(i + 1, columna).setValue(esFecha ? fechaParaCelda_(valor) : valor);
      cambios++;
    };
    poner(COLUMNAS_DIARIO.drive, c.fechaAprobacion, true);
    poner(COLUMNAS_DIARIO.presentacion, c.fechaPresentacion, true);
    poner(COLUMNAS_DIARIO.cobro, c.fechaCobro, true);
    poner(COLUMNAS_DIARIO.anula, c.estado === 'anulada' ? 'X' : null, false);
  });
  return cambios;
}

function refTexto_(v) {
  return String(v === null || v === undefined ? '' : v).trim().replace(/\.0+$/, '');
}

/** "2026-10-30" → fecha de la hoja (al mediodía, para que ningún huso horario la corra de día). */
function fechaParaCelda_(iso) {
  var p = String(iso).split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12);
}

/** Lo que hay en una celda de fecha → "AAAA-MM-DD" (acepta fecha, "30/10/2026" o "30-10-26"). */
function fechaDeCelda_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
  var m = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/.exec(String(v).trim());
  if (!m) return '';
  var a = m[3].length === 2 ? '20' + m[3] : m[3];
  return a + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
}

/** Texto del Excel del ERP → valor para la hoja: fechas como fecha, importes como número, el resto igual. */
function valorDeCelda_(v) {
  var t = String(v === null || v === undefined ? '' : v).trim();
  if (t === '') return '';
  var f = fechaDeCelda_(t);
  if (f) return fechaParaCelda_(f);
  if (/^-?\(?\d{1,3}(\.\d{3})+(,\d+)?\)?$|^-?\(?\d+,\d+\)?$/.test(t)) {
    var n = Number(t.replace(/[()]/g, '').replace(/\./g, '').replace(',', '.'));
    return /\(/.test(t) ? -Math.abs(n) : n;
  }
  if (/^-?(0|[1-9]\d{0,14})$/.test(t)) return Number(t); // sin ceros adelante (esos quedan como texto)
  return t;
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
    } else if (hoja.getLastColumn() < h.columnas.length) {
      // Columnas nuevas de una versión más reciente: se agregan al final
      var desde = hoja.getLastColumn() + 1;
      hoja.getRange(1, desde, hoja.getMaxRows(), h.columnas.length - desde + 1).setNumberFormat('@');
      hoja.getRange(1, 1, 1, h.columnas.length).setValues([h.columnas]).setFontWeight('bold');
    }
  });
  var cfg = hoja_(HOJAS.config);
  if (cfg.getLastRow() >= 2) {
    var claves = cfg.getRange(2, 1, cfg.getLastRow() - 1, 1).getValues().map(function (f) { return f[0]; });
    CONFIG_INICIAL.forEach(function (f) { if (claves.indexOf(f[0]) < 0) cfg.appendRow(f); });
  }
  var config = hoja_(HOJAS.config);
  if (config.getLastRow() < 2) config.getRange(2, 1, CONFIG_INICIAL.length, 3).setValues(CONFIG_INICIAL);
}

/** Programa los avisos diarios (8 h) y el resumen de los lunes (8 h). */
function instalarDisparadores() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('avisosDiarios').timeBased().everyDays(1).atHour(8).create();
  ScriptApp.newTrigger('resumenSemanal').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).create();
  ScriptApp.newTrigger('actualizarPlanillaDeControl').timeBased().everyHours(1).create();
}

// ── Utilidades ──────────────────────────────────────────────────────────────

function usuarioActual_() {
  var email = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  var dominio = String(config_('dominio') || '').toLowerCase();
  if (!email || (dominio && email.split('@')[1] !== dominio)) throw new Error('Hay que ingresar con la cuenta de la empresa.');
  var u = leerHoja_(HOJAS.usuarios).filter(function (x) { return String(x.email).toLowerCase() === email; })[0];
  if (!u) throw new Error('La cuenta ' + email + ' no tiene acceso. Auditoría puede habilitarla.');
  var rol = String(u.rol).toLowerCase().indexOf('geren') === 0 ? 'gerencia' : String(u.rol).toLowerCase().indexOf('audit') === 0 ? 'auditoria' : 'sucursal';
  if (rol === 'sucursal' && !u.sucursal) throw new Error('El usuario no tiene una sucursal asignada.');
  return { email: email, nombre: u.nombre || email, rol: rol, sucursal: rol === 'sucursal' ? u.sucursal : null };
}

function hoja_(h) {
  var hoja = SpreadsheetApp.getActive().getSheetByName(h.nombre);
  if (!hoja) throw new Error('Falta la pestaña "' + h.nombre + '". Falta correr configurarPlanilla().');
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
    if (COLUMNAS_JSON.indexOf(col) >= 0) v = v ? JSON.parse(v) : (col === 'compromiso' || col === 'anulacionInformada' ? null : []);
    // La firma ya no es un documento aparte (va en la orden firmada)
    if (col === 'documentos' && Array.isArray(v)) v = v.filter(function (d) { return d && d.tipo !== 'firma'; });
    else if (COLUMNAS_NUMERO.indexOf(col) >= 0) v = v === '' ? 0 : Number(v);
    else if (COLUMNAS_NUMERO_OPCIONAL.indexOf(col) >= 0) v = v === '' ? null : Number(v);
    else if (col === 'ncInformada') v = v === '' ? null : v === true || v === 'TRUE' || v === 'SI';
    else if (col === 'recibeFce') v = v === '' || v === null || v === undefined ? null : !/^(no|false)$/i.test(String(v));
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
    if (col === 'actualizado') return ahora_();
    var v = o[col];
    if (COLUMNAS_JSON.indexOf(col) >= 0) return v === null || v === undefined ? '' : JSON.stringify(v);
    return v === null || v === undefined ? '' : v;
  });
  if (fila) hoja.getRange(fila, 1, 1, valores.length).setValues([valores]);
  else hoja.appendRow(valores);
}

function leerFila_(hoja, fila) {
  return filaAObjeto_(HOJAS.comprobantes, hoja.getRange(fila, 1, 1, HOJAS.comprobantes.columnas.length).getValues()[0]);
}

function ahora_() {
  return new Date().toISOString();
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

/** Compara nombres de sucursal sin importar mayúsculas, tildes ni espacios de más. */
function mismaSucursal_(a, b) {
  var n = function (x) { return String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' '); };
  return n(a) !== '' && n(a) === n(b);
}

function esperaALaSucursal_(c) {
  if (c.tipo !== 'FC' || c.estado === 'anulada' || c.estado === 'cobrada' || c.fechaPresentacion || (c.anulacionInformada && !c.anulacionInformada.parcial)) return false;
  var docs = c.documentos || [];
  return docs.length === 0 || docs.some(function (d) { return d.estado === 'faltante' || d.estado === 'observado'; });
}

function hoy_() {
  return Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
}

function diasEntre_(desde, hasta) {
  return Math.round((new Date(hasta + 'T00:00:00Z') - new Date(String(desde) + 'T00:00:00Z')) / 86400000);
}

function buscarSucursal_(indice, nombre) {
  var claves = Object.keys(indice);
  for (var i = 0; i < claves.length; i++) if (mismaSucursal_(claves[i], nombre)) return indice[claves[i]];
  return {};
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
