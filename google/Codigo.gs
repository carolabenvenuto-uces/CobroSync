/**
 * CobroSync · servidor en Google Apps Script (etapa 2, prueba piloto)
 *
 * Qué hace:
 * - Publica la aplicación como "aplicación web" dentro del dominio de la empresa.
 * - Guarda los datos en esta misma planilla de Google (una pestaña por tipo de dato).
 * - Guarda los PDF y fotos de cada factura en una carpeta del Drive de la empresa.
 * - Reconoce a cada persona por su cuenta de la empresa y le da su rol
 *   (pestaña "Usuarios"): Gerencia, Cobranzas o Sucursal.
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
    columnas: ['id', 'nombre', 'razonSocial', 'cuit', 'email', 'emailReclamos', 'plazoPagoDias', 'recibeFce', 'canal', 'portalUrl', 'toleranciaReclamo', 'pausada', 'siniestrosPorMail', 'siniestrosPorPlataforma', 'usuarioPlataforma', 'clavePlataforma'],
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
      'fechaAprobacion', 'pedidos', 'atendiendo', 'reenviar',
      // Monto aprobado de la orden (lo carga Cobranzas, por siniestro, en la primera factura)
      'montoOrden',
      // Si lo anulado con nota de crédito se vuelve a facturar (JSON)
      'refacturacion',
    ],
  },
  lecturas: { nombre: 'Lecturas', columnas: ['email', 'ids', 'actualizado'] },
  // PDF de facturas que todavía no están cargadas (se factura hoy, el ERP se carga mañana)
  espera: {
    nombre: 'EnEspera',
    columnas: ['id', 'sucursal', 'puntoVenta', 'numero', 'tipo', 'siniestro', 'archivo', 'url', 'subidoPor', 'fecha', 'nombreOriginal', 'asociado'],
  },
  cobros: {
    nombre: 'CobrosPrevistos',
    columnas: ['id', 'comprobanteId', 'aseguradoraId', 'fechaIngreso', 'monto', 'estado'],
  },
};

var COLUMNAS_JSON = ['compromiso', 'reclamos', 'documentos', 'eventos', 'anulacionInformada', 'pedidos', 'atendiendo', 'refacturacion'];
var COLUMNAS_NUMERO = ['puntoVenta', 'numero', 'total', 'plazoPagoDias', 'monto'];
var COLUMNAS_NUMERO_OPCIONAL = ['acreditado', 'importeCobrado', 'percepciones', 'montoOrden']; // vacío = sin dato
// Los plazos de la documentación (común y MiPyME) están en la pestaña Config y se cambian
// desde Ajustes en la aplicación: ver plazos_().
var RECLAMOS_SIN_RESPUESTA = 3; // con 3 reclamos sin respuesta, Cobranzas pide apoyo a Gerencia

var CONFIG_INICIAL = [
  ['dominio', 'svaauto.com.ar', 'Solo entran cuentas de este dominio'],
  ['carpetaDriveId', '', 'Id de la carpeta de la unidad compartida donde se guardan los documentos'],
  ['correosGerencia', '', 'Correos de Gerencia General para los avisos críticos, separados por coma'],
  ['correoSoporte', '', 'Correo de la desarrolladora: recibe los reportes de problemas técnicos que se mandan desde Soporte técnico'],
  ['nombreSoporte', '', 'Nombre de quien da soporte a la plataforma; se muestra en la ventana de Soporte técnico'],
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
  ['planillaControlId', '', 'Id de la planilla de control de Cobranzas: CobroSync le agrega el ERP en Quiter y completa Diario'],
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
/**
 * Ingreso rápido. Leer las ~9.000 filas de Comprobantes es lo que más tarda (8 a 20 segundos), así
 * que se guarda una "foto" comprimida de todas las facturas en la memoria de Apps Script (CacheService,
 * hasta 6 horas) y en cada ingreso solo se leen las filas que cambiaron desde esa foto (columna
 * "actualizado"). Lo demás (usuario, compañías, sucursales, ajustes) se lee como siempre, que es poco.
 * La foto se rehace cada hora (con la lectura de la planilla), cuando no está o si cambiaron muchas filas.
 * Una fila borrada o editada a mano en la planilla de datos se ve en la próxima foto (como mucho, una hora).
 */
var CACHE_INGRESO_ = 'ingreso-v1';
var PARTE_CACHE_ = 90000; // caracteres por parte (el máximo de CacheService es 100 KB por valor)
var MAX_CAMBIOS_ = 80; // más filas cambiadas que esto: conviene rehacer la foto

function alcanceIngreso_(usuario) {
  return usuario.rol === 'sucursal' ? 'suc-' + slugPlanilla_(usuario.sucursal) : 'todas';
}

/** Arma la foto de las facturas (de una sucursal, o todas) y la guarda en partes. */
function armarFoto_(alcance, comprobantes, ahora) {
  var b64 = Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(JSON.stringify(comprobantes), 'application/json', 'c.json')).getBytes());
  var partes = {};
  var n = Math.ceil(b64.length / PARTE_CACHE_);
  for (var i = 0; i < n; i++) partes[CACHE_INGRESO_ + ':' + alcance + ':' + i] = b64.slice(i * PARTE_CACHE_, (i + 1) * PARTE_CACHE_);
  partes[CACHE_INGRESO_ + ':' + alcance] = JSON.stringify({ ahora: ahora, partes: n });
  try { CacheService.getScriptCache().putAll(partes, 21600); } catch (e) { console.warn('No se pudo guardar la foto: ' + e); }
  return { ahora: ahora, b64: b64 };
}

function leerFoto_(alcance) {
  var cache = CacheService.getScriptCache();
  var meta = cache.get(CACHE_INGRESO_ + ':' + alcance);
  if (!meta) return null;
  meta = JSON.parse(meta);
  var claves = [];
  for (var i = 0; i < meta.partes; i++) claves.push(CACHE_INGRESO_ + ':' + alcance + ':' + i);
  var partes = cache.getAll(claves);
  var b64 = '';
  for (var j = 0; j < claves.length; j++) {
    if (!partes[claves[j]]) return null; // se perdió una parte: hay que rehacerla
    b64 += partes[claves[j]];
  }
  return { ahora: meta.ahora, b64: b64 };
}

function fotoDeSucursalDesdeTodas_(alcance, sucursal) {
  var todas = leerFoto_('todas');
  if (!todas) return null;
  try {
    var texto = Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(todas.b64), 'application/x-gzip', 't.gz')).getDataAsString('UTF-8');
    var propias = JSON.parse(texto).filter(function (c) { return mismaSucursal_(c.sucursal, sucursal); });
    return armarFoto_(alcance, propias, todas.ahora);
  } catch (e) {
    console.warn('No se pudo armar la foto de la sucursal: ' + e);
    return null;
  }
}

/** Rehace la foto de todas las facturas (la usan Cobranzas y Gerencia). La llama la lectura de cada hora. */
function prepararIngreso() {
  var ahora = ahora_();
  return armarFoto_('todas', leerHoja_(HOJAS.comprobantes), ahora).ahora;
}

/** Las filas de Comprobantes cambiadas después de "desde" (null si son demasiadas). */
function filasCambiadas_(hoja, desde, maximo) {
  if (hoja.getLastRow() < 2) return [];
  var col = HOJAS.comprobantes.columnas.indexOf('actualizado') + 1;
  var marcas = hoja.getRange(2, col, hoja.getLastRow() - 1, 1).getValues();
  var filas = [];
  for (var i = 0; i < marcas.length; i++) {
    var m = marcas[i][0] instanceof Date ? marcas[i][0].toISOString() : String(marcas[i][0]);
    if (m > desde) filas.push(i + 2);
  }
  if (maximo && filas.length > maximo) return null;
  return filas.map(function (f) { return leerFila_(hoja, f); });
}

/**
 * Lo que necesita la pantalla al entrar, rápido: la foto comprimida de las facturas, lo que cambió
 * desde la foto, y el resto de los datos (también comprimido). La pantalla junta las dos cosas.
 */
function obtenerDatosRapidos() {
  try {
    return obtenerDatosRapidos_();
  } catch (e) {
    if (String(e.message).indexOf(MARCA_ACCESO) === 0) throw e;
    console.error('obtenerDatosRapidos: ' + (e && e.stack ? e.stack : e));
    throw new Error(MARCA_ACCESO + JSON.stringify({ motivo: 'falla', contacto: contactoAlta_() }));
  }
}

function obtenerDatosRapidos_() {
  var t0 = Date.now();
  var usuario = usuarioActual_();
  var alcance = alcanceIngreso_(usuario);
  var hoja = hoja_(HOJAS.comprobantes);
  var foto = leerFoto_(alcance);
  // Una sucursal que todavía no tiene su foto la arma con la de todas (mucho más rápido que leer la planilla)
  if (!foto && alcance !== 'todas') foto = fotoDeSucursalDesdeTodas_(alcance, usuario.sucursal);
  var hasta = ahora_(); // lo que cambie desde acá lo trae la consulta de cada minuto
  var cambios = foto ? filasCambiadas_(hoja, foto.ahora, MAX_CAMBIOS_) : null;
  var origen = 'foto';
  if (!foto || cambios === null) {
    // Sin foto (o vieja): se lee todo y se guarda para el próximo
    var ahora = ahora_();
    var todas = leerHoja_(HOJAS.comprobantes);
    if (usuario.rol === 'sucursal') todas = todas.filter(function (c) { return mismaSucursal_(c.sucursal, usuario.sucursal); });
    foto = armarFoto_(alcance, todas, ahora);
    hasta = ahora;
    cambios = [];
    origen = 'leída';
  }
  if (usuario.rol === 'sucursal') cambios = cambios.filter(function (c) { return mismaSucursal_(c.sucursal, usuario.sucursal); });
  var t1 = Date.now();
  var resto = obtenerDatosSinControl_(usuario, true);
  resto.cambios = cambios;
  resto.ahora = hasta;
  var restoB64 = Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(JSON.stringify(resto), 'application/json', 'r.json')).getBytes());
  console.log('Ingreso rápido: facturas (' + origen + ', ' + cambios.length + ' cambiadas) en ' + (t1 - t0) + ' ms, resto en ' + (Date.now() - t1) + ' ms; ' +
    Math.round(foto.b64.length / 1024) + ' KB + ' + Math.round(restoB64.length / 1024) + ' KB');
  return { facturas: foto.b64, resto: restoB64 };
}

/**
 * Lo mismo que obtenerDatos, pero comprimido (gzip en base64): con miles de facturas viaja mucho más
 * rápido como un solo texto chico que como un objeto grande. La pantalla lo descomprime.
 * En Ejecuciones de Apps Script queda cuánto tardó y cuánto pesó.
 */
function obtenerDatosComprimidos() {
  var t0 = Date.now();
  var datos = obtenerDatos();
  var t1 = Date.now();
  var texto = JSON.stringify(datos);
  var gz = Utilities.gzip(Utilities.newBlob(texto, 'application/json', 'datos.json'));
  var b64 = Utilities.base64Encode(gz.getBytes());
  console.log('Ingreso: datos en ' + (t1 - t0) + ' ms (usuario ' + TIEMPOS_.usuario + ' ms, comprobantes ' + TIEMPOS_.comprobantes + ' ms), comprimidos en ' + (Date.now() - t1) + ' ms; ' +
    (datos.datos.comprobantes || []).length + ' comprobantes, ' + Math.round(texto.length / 1024) + ' KB → ' + Math.round(b64.length / 1024) + ' KB');
  return b64;
}

function obtenerDatos() {
  try {
    return obtenerDatosSinControl_();
  } catch (e) {
    // Lo técnico no se le muestra a la persona: queda en el registro de ejecuciones de Apps Script
    if (String(e.message).indexOf(MARCA_ACCESO) === 0) throw e;
    console.error('obtenerDatos: ' + (e && e.stack ? e.stack : e));
    throw new Error(MARCA_ACCESO + JSON.stringify({ motivo: 'falla', contacto: contactoAlta_() }));
  }
}

/**
 * Errores de ingreso con lo que la pantalla necesita para explicarlo (motivo, cuenta y a quién pedir el
 * alta). La pantalla los reconoce por esta marca y nunca muestra el texto técnico.
 */
var MARCA_ACCESO = 'CobroSync-acceso:';
function errorAcceso_(motivo, email) {
  return new Error(MARCA_ACCESO + JSON.stringify({ motivo: motivo, email: email || '', dominio: String(config_('dominio') || ''), contacto: contactoAlta_() }));
}
/** A quién se le pide el alta: el correo de soporte de Ajustes (la administradora). */
function contactoAlta_() {
  try { return String(config_('correoSoporte') || ''); } catch (e) { return ''; }
}

var TIEMPOS_ = {};
/** Las compañías; el usuario y la contraseña de la plataforma solo le llegan a Cobranzas. */
function aseguradorasPara_(usuario) {
  var lista = leerHoja_(HOJAS.aseguradoras);
  if (usuario.rol === 'auditoria') return lista;
  return lista.map(function (a) { delete a.usuarioPlataforma; delete a.clavePlataforma; return a; });
}

/**
 * Usuario y contraseña de la plataforma de una compañía (las cuentas que comparte el sector). Se cargan
 * desde Presentar; los puede cambiar cualquiera de Cobranzas (no solo la administradora).
 */
function guardarAccesoPlataforma(id, usuarioPlataforma, clavePlataforma) {
  var usuario = usuarioActual_();
  if (usuario.rol !== 'auditoria') throw new Error('Solo Cobranzas puede cargar el acceso a la plataforma.');
  return conBloqueo_(function () {
    var hoja = hoja_(HOJAS.aseguradoras);
    agregarColumnasNuevas_(hoja, HOJAS.aseguradoras);
    var fila = buscarFila_(hoja, id);
    if (!fila) throw new Error('No encuentro la compañía.');
    var a = filaAObjeto_(HOJAS.aseguradoras, hoja.getRange(fila, 1, 1, HOJAS.aseguradoras.columnas.length).getValues()[0]);
    a.usuarioPlataforma = String(usuarioPlataforma || '').trim();
    a.clavePlataforma = String(clavePlataforma || '');
    escribirFila_(hoja, HOJAS.aseguradoras, fila, a);
    return { usuarioPlataforma: a.usuarioPlataforma, clavePlataforma: a.clavePlataforma };
  });
}

function obtenerDatosSinControl_(usuarioYa, sinComprobantes) {
  var t = Date.now();
  var usuario = usuarioYa || usuarioActual_();
  TIEMPOS_.usuario = Date.now() - t;
  t = Date.now();
  var comprobantes = sinComprobantes ? [] : leerHoja_(HOJAS.comprobantes);
  TIEMPOS_.comprobantes = Date.now() - t;
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
      aseguradoras: aseguradorasPara_(usuario),
      comprobantes: comprobantes,
      enEspera: usuario.rol === 'gerencia' ? [] : leerEspera_().filter(function (e) {
        return !e.asociado && (usuario.rol !== 'sucursal' || mismaSucursal_(e.sucursal, usuario.sucursal));
      }),
      cobrosPrevistos: usuario.rol === 'sucursal' ? [] : leerHoja_(HOJAS.cobros),
      meta: {
        fechaCorte: hoy_(),
        sucursales: sucursales,
        plazos: plazos_(),
        textos: { apoyo: String(config_('textoAvisoApoyo') || ''), critica: String(config_('textoAvisoCritica') || '') },
        avisos: usuario.rol === 'auditoria' ? { porMail: config_('avisosPorMail') === 'SI', correosGerencia: String(config_('correosGerencia') || ''), correoSoporte: String(config_('correoSoporte') || ''), nombreSoporte: String(config_('nombreSoporte') || '') } : undefined,
        // A quién le llegan los avisos de Soporte técnico (solo el nombre; el correo no se muestra)
        soporte: { nombre: String(config_('nombreSoporte') || '') },
        planilla: usuario.rol === 'auditoria' ? { conectada: !!config_('planillaControlId'), ultimaLectura: PropertiesService.getScriptProperties().getProperty('ultimaLecturaPlanilla') || '' } : undefined,
      },
    },
  };
}

/**
 * Guarda los cambios hechos en la aplicación, uno por uno, sobre lo que hay guardado en ese momento.
 * Así, si dos personas trabajan en la misma factura a la vez, no se pisan: por ejemplo, la sucursal
 * sube la orden mientras Cobranzas escribe una observación, y quedan las dos cosas.
 *
 * Cada cambio es { id, campos?, documentos?, evento?, nuevo? }:
 * - campos: datos de la factura que cambian (estado, fechas, observaciones, reclamos…)
 * - documentos: solo los documentos que cambiaron (se reemplazan por tipo: factura u orden)
 * - evento: un mensaje nuevo para la conversación (se agrega, nunca reemplaza)
 * - nuevo: una factura nueva completa (por ejemplo, desde el ERP). Solo Cobranzas.
 */
// siniestro: lo informa la sucursal al subir la orden (antes no se conoce)
var CAMPOS_SUCURSAL = ['fechaDrive', 'subidoPor', 'compromiso', 'ncInformada', 'estado', 'anulacionInformada', 'siniestro', 'refacturacion'];

function aplicarCambios(cambios) {
  var usuario = usuarioActual_();
  if (usuario.rol === 'gerencia') throw new Error('Gerencia solo puede consultar.');
  return conBloqueo_(function () {
    var hoja = hoja_(HOJAS.comprobantes);
    agregarColumnasNuevas_(hoja, HOJAS.comprobantes);
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

/**
 * Pedidos de Cobranzas a la sucursal. Cobranzas los crea y los cierra; la sucursal solo puede
 * responder los que están abiertos (no borrarlos ni inventarlos). El servidor firma cada respuesta.
 */
function combinarPedidos_(actuales, nuevos, usuario) {
  if (usuario.rol === 'auditoria') {
    return nuevos.map(function (p) {
      var antes = actuales.filter(function (x) { return x.id === p.id; })[0];
      if (!antes) p.autor = usuario.nombre;
      if (p.cerrado && !(antes && antes.cerrado)) p.cerrado = { fecha: hoy_(), autor: usuario.nombre };
      return p;
    });
  }
  return actuales.map(function (p) {
    var nuevo = nuevos.filter(function (x) { return x.id === p.id; })[0];
    if (!p.cerrado && !p.respuesta && nuevo && nuevo.respuesta && nuevo.respuesta.texto) {
      p.respuesta = { fecha: hoy_(), autor: usuario.nombre, texto: String(nuevo.respuesta.texto).slice(0, 2000) };
    }
    return p;
  });
}

function aplicarUno_(hoja, usuario, op, tocadas) {
      var fila = buscarFila_(hoja, op.id);
      if (op.nuevo) {
        if (usuario.rol !== 'auditoria') throw new Error('Solo Cobranzas puede cargar facturas nuevas.');
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
          if (k === 'pedidos') { c.pedidos = combinarPedidos_(c.pedidos || [], op.campos.pedidos || [], usuario); return; }
          if (k === 'atendiendo' && usuario.rol !== 'auditoria') return;
          if (usuario.rol === 'sucursal') {
            // La sucursal solo cambia lo suyo; importes, presentación y cobro quedan como estaban
            if (CAMPOS_SUCURSAL.indexOf(k) < 0) return;
            if (k === 'estado' && !(op.campos.estado === 'en_gestion' && c.estado === 'pendiente_drive')) return;
          }
          // La respuesta de si se refactura la firma el servidor (quién y cuándo)
          if (k === 'refacturacion' && op.campos[k]) {
            var r = op.campos[k];
            c[k] = { decision: r.decision === 'no' ? 'no' : 'si', importe: Number(r.importe) > 0 ? Number(r.importe) : null, motivo: String(r.motivo || '').slice(0, 300), fecha: hoy_(), autor: usuario.nombre };
            return;
          }
          c[k] = op.campos[k];
        });
      }
      if (op.documentos) {
        var docs = c.documentos || [];
        op.documentos.forEach(function (d) {
          var i = docs.map(function (x) { return x.tipo; }).indexOf(d.tipo);
          // La sucursal sube para revisar: aprobar u observar es de Cobranzas. Sí puede quitar lo que
          // subió por error mientras Cobranzas no lo revisó (vuelve a "falta")
          var quita = d.estado === 'faltante' && i >= 0 && docs[i].estado === 'en_revision';
          if (usuario.rol === 'sucursal' && d.estado !== 'en_revision' && !quita && !(i >= 0 && docs[i].estado === d.estado)) return;
          // Un archivo nuevo para revisar queda firmado por quien lo sube (lo firma el servidor)
          var nuevo = d.estado === 'en_revision' && (i < 0 || docs[i].estado !== 'en_revision' || docs[i].url !== d.url || docs[i].archivo !== d.archivo);
          if (nuevo) d.subidoPor = usuario.nombre;
          // Lo que escaneó una persona de Cobranzas lo aprueba otra: así se controla dos veces (salvo la administradora)
          if (usuario.rol === 'auditoria' && !usuario.administradora && d.estado === 'ok' && i >= 0 && docs[i].estado === 'en_revision' && docs[i].subidoPor === usuario.nombre) {
            return;
          }
          if (i >= 0) docs[i] = d; else docs.push(d);
        });
        c.documentos = docs;
        // Fecha de la documentación completa (la que va a la columna Drive de la planilla):
        // el día en que Cobranzas aprueba lo último. Si después se observa algo, se vacía.
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

/** Agrega facturas nuevas (por ejemplo, desde la exportación del ERP). Solo Cobranzas. */
function agregarComprobantes(lista) {
  var usuario = usuarioActual_();
  if (usuario.rol !== 'auditoria') throw new Error('Solo Cobranzas puede cargar facturas nuevas.');
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
 * Solo Cobranzas.
 */
function sincronizarDesdePlanilla(lista) {
  var usuario = exigirAdministradora_();
  return sincronizarLista_(lista, usuario.nombre);
}

function sincronizarLista_(lista, autor) {
  return conBloqueo_(function () {
    var hoja = hoja_(HOJAS.comprobantes);
    var actuales = leerHoja_(HOJAS.comprobantes);
    var filaPorRef = {};
    // Se busca por referencia; las que no tienen, por su id (tipo, punto de venta y número): así no se duplican al repetir la carga
    actuales.forEach(function (c, i) { filaPorRef[c.ref ? 'ref:' + c.ref : 'id:' + c.id] = { c: c, fila: i + 2 }; });
    var resultado = { nuevas: 0, actualizadas: 0, omitidas: 0 };
    // Solo las sucursales cargadas en la pestaña Sucursales (las del piloto); el resto sigue en la planilla
    var delPiloto = leerHoja_(HOJAS.sucursales).map(function (s) { return s.nombre; });
    lista.forEach(function (p) {
      if (delPiloto.length && !delPiloto.some(function (n) { return mismaSucursal_(n, p.sucursal); })) {
        resultado.omitidas++;
        return;
      }
      var ref = String(p.ref || '');
      var clave = ref ? 'ref:' + ref : 'id:' + p.id;
      var existente = filaPorRef[clave];
      if (!existente) {
        if (!(p.reclamos || []).length) {
          var rp = reclamoDePlanilla_(p.observaciones);
          if (rp) p.reclamos = [rp];
        }
        escribirFila_(hoja, HOJAS.comprobantes, null, p);
        filaPorRef[clave] = { c: p, fila: hoja.getLastRow() };
        resultado.nuevas++;
        return;
      }
      var c = existente.c;
      var cambio = false;
      // El siniestro que Google Sheets había convertido en fecha vuelve a ser el de la planilla de control
      if (c._siniestroDanado && p.siniestro) {
        c.siniestro = p.siniestro;
        cambio = true;
      }
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
      // La documentación llegó al Drive de siempre y se anotó en la planilla (mientras se usan las dos):
      // lo que faltaba en CobroSync queda aprobado, sin tocar lo que se subió o se observó en la plataforma
      var docsPlanilla = (p.documentos || []).length > 0 && (p.documentos || []).every(function (d) { return d.estado === 'ok'; });
      if (c.tipo === 'FC' && docsPlanilla && (c.documentos || []).some(function (d) { return d.estado === 'faltante'; })) {
        c.documentos = (c.documentos || []).map(function (d) { return d.estado === 'faltante' ? { tipo: d.tipo, estado: 'ok' } : d; });
        if (!c.fechaDrive && p.fechaDrive) c.fechaDrive = p.fechaDrive;
        if (!c.fechaAprobacion && c.documentos.every(function (d) { return d.estado === 'ok'; })) c.fechaAprobacion = p.fechaAprobacion || p.fechaDrive || hoy_();
        if (c.estado === 'pendiente_drive') c.estado = 'en_gestion';
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
      // Los reclamos anotados en Observaciones ("Reclamado 05/08"): si CobroSync no tiene ninguno, se toma el último
      if (!(c.reclamos || []).length) {
        var reclamo = reclamoDePlanilla_(p.observaciones);
        if (reclamo) {
          c.reclamos = [reclamo];
          cambio = true;
        }
      }
      if (cambio) {
        (c.eventos = c.eventos || []).push({ fecha: hoy_(), autor: autor, area: 'auditoria', tipo: 'mensaje', texto: 'Actualizado desde la planilla de control' });
        escribirFila_(hoja, HOJAS.comprobantes, existente.fila, c);
        resultado.actualizadas++;
      }
    });
    return resultado;
  });
}

/**
 * Reclamos anotados a mano en Observaciones de la planilla de control: "RECLAMADO 03/07. RECLAMADO 05/08",
 * "Reclamado 14/09", "recl. 9/9/26". Se toma la última fecha como un solo reclamo (con todas las fechas en la
 * nota), así la factura no figura como "sin reclamar" y, si ya pasó el plazo, queda para volver a reclamar.
 * "Reclamado a <sucursal>" no cuenta: es un pedido a la sucursal, no un reclamo a la compañía.
 * Las fechas sin año son del último año que no quede en el futuro.
 */
function reclamoDePlanilla_(observaciones) {
  var texto = String(observaciones || '');
  if (!/recl/i.test(texto)) return null;
  var hoy = hoy_();
  var anio = Number(hoy.slice(0, 4));
  var fechas = [];
  var re = /recl(?:amad[oa]s?|amo|\.)(?!\s+a\s)[^\d]{0,20}?(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/gi;
  var m;
  while ((m = re.exec(texto)) !== null) {
    var d = Number(m[1]), mes = Number(m[2]);
    if (!d || d > 31 || !mes || mes > 12) continue;
    var a = m[3] ? Number(m[3].length === 2 ? '20' + m[3] : m[3]) : anio;
    var f = a + '-' + ('0' + mes).slice(-2) + '-' + ('0' + d).slice(-2);
    if (!m[3] && f > hoy) f = (a - 1) + f.slice(4);
    fechas.push(f);
  }
  if (!fechas.length) return null;
  fechas.sort();
  var ultima = fechas[fechas.length - 1];
  return {
    fecha: ultima, medio: 'mail', autor: 'Planilla de control',
    nota: (fechas.length > 1 ? 'Reclamos anotados en la planilla: ' : 'Reclamo anotado en la planilla: ') +
      fechas.map(function (x) { return x.slice(8, 10) + '/' + x.slice(5, 7) + '/' + x.slice(2, 4); }).join(', '),
    respuesta: null,
  };
}

/**
 * Agrega las compañías que todavía no estén en la pestaña "Aseguradoras" (al pasar la planilla
 * de control a CobroSync). No cambia las que ya están cargadas. Solo Cobranzas.
 */
/**
 * Compañías: alta de las nuevas y, con completarExistentes, datos de las que ya están.
 * Con exacto (desde la pantalla Compañías), lo que se manda se guarda tal cual, también vacío:
 * así se puede borrar un mail o reactivar una compañía pausada.
 */
function guardarAseguradoras(lista, completarExistentes, exacto) {
  var usuario = exigirAdministradora_();
  return conBloqueo_(function () {
    var hoja = hoja_(HOJAS.aseguradoras);
    agregarColumnasNuevas_(hoja, HOJAS.aseguradoras);
    var existentes = indexar_(leerHoja_(HOJAS.aseguradoras), 'id');
    var nuevas = 0;
    lista.forEach(function (a) {
      a = Object.assign({}, a);
      if ('pausada' in a) a.pausada = a.pausada ? 'SI' : '';
      var actual = existentes[a.id];
      if (!actual) {
        if (!String(a.id || '').trim() || !String(a.nombre || '').trim()) throw new Error('A la compañía nueva le falta el nombre.');
        escribirFila_(hoja, HOJAS.aseguradoras, null, a);
        nuevas++;
        return;
      }
      actual.pausada = actual.pausada ? 'SI' : '';
      if (exacto) {
        Object.keys(a).forEach(function (k) { if (k !== 'id' && HOJAS.aseguradoras.columnas.indexOf(k) >= 0) actual[k] = a[k] === null || a[k] === undefined ? '' : a[k]; });
        escribirFila_(hoja, HOJAS.aseguradoras, buscarFila_(hoja, a.id), actual);
        return;
      }
      // Con la pestaña CP o Info. Compañías: completa razón social, CUIT, plazo y correos
      if (completarExistentes) {
        ['razonSocial', 'cuit', 'email', 'emailReclamos', 'plazoPagoDias'].forEach(function (k) { if (a[k]) actual[k] = a[k]; });
        // Cómo presenta y cuánta tolerancia tiene: se cambian desde la pantalla Compañías (también vacíos)
        ['canal', 'portalUrl', 'toleranciaReclamo', 'siniestrosPorMail', 'siniestrosPorPlataforma'].forEach(function (k) { if (k in a) actual[k] = a[k] === null || a[k] === undefined ? '' : a[k]; });
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
  if (!nombreTieneFactura_(nombre, c.puntoVenta, c.numero)) {
    throw new Error('El nombre del archivo tiene que tener el número de la factura (' + c.puntoVenta + '-' + c.numero + ').');
  }
  var raiz = DriveApp.getFolderById(config_('carpetaDriveId'));
  var carpeta = subcarpeta_(subcarpeta_(subcarpeta_(raiz, c.sucursal), String(c.fecha).slice(0, 7)),
    c.tipo + ' ' + c.puntoVenta + '-' + c.numero);
  var extension = (nombre.match(/\.[a-z0-9]+$/i) || [''])[0];
  // El archivo queda en Drive con el nombre que le puso la sucursal
  var archivo = carpeta.createFile(Utilities.newBlob(Utilities.base64Decode(base64), mime, nombreDeArchivo_(nombre, tipoDocumento + '_' + hoy_() + extension)));
  archivo.setDescription('Subido por ' + usuario.email + ' (' + nombre + ')');
  compartirEnLaEmpresa_(archivo);
  return { archivo: archivo.getName(), url: archivo.getUrl() };
}

/**
 * Cada documento queda visible para cualquier cuenta de la empresa que tenga el link: así la sucursal
 * y Gerencia lo abren desde CobroSync sin tener acceso a la unidad compartida (no ven la carpeta,
 * solo el archivo que abren). Si la unidad no permite compartir así, el archivo se guarda igual y
 * lo pueden abrir solo quienes tienen acceso a la unidad.
 */
function compartirEnLaEmpresa_(archivo) {
  try {
    archivo.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    console.warn('No se pudo compartir ' + archivo.getName() + ' con la empresa: ' + e);
  }
}

// ── PDF en espera: facturas de hoy que todavía no están en el ERP ──────────────────

/**
 * La sucursal escanea el mismo día que factura, pero la factura recién se carga con el Excel del
 * ERP del día siguiente. Mientras tanto el PDF queda "en espera", con el número de la factura y el
 * siniestro; al cargar el ERP, la aplicación lo une al legajo nuevo (marcarEsperaAsociada).
 * El punto de venta tiene que ser de la sucursal: así un número mal tipeado de otra sucursal no entra.
 */
function subirEnEspera(puntoVenta, numero, tipo, siniestro, nombre, mime, base64) {
  var usuario = usuarioActual_();
  if (usuario.rol !== 'sucursal' && !usuario.sucursalPropia) throw new Error('Solo las sucursales suben documentos de facturas de hoy.');
  var deQuien = usuario.rol === 'sucursal' ? usuario.sucursal : usuario.sucursalPropia;
  if (mime !== 'application/pdf' && !/\.pdf$/i.test(nombre)) throw new Error('Solo se aceptan PDF.');
  puntoVenta = Number(puntoVenta);
  numero = Number(numero);
  var suc = leerHoja_(HOJAS.sucursales).filter(function (s) { return mismaSucursal_(s.nombre, deQuien); })[0];
  var pvs = suc ? String(suc.puntosVenta || '').split(/[^0-9]+/).filter(String).map(Number) : [];
  if (pvs.indexOf(puntoVenta) < 0) throw new Error('El punto de venta ' + puntoVenta + ' no es de la sucursal.');
  var yaEsta = leerHoja_(HOJAS.comprobantes).some(function (c) { return Number(c.puntoVenta) === puntoVenta && Number(c.numero) === numero; });
  if (yaEsta) throw new Error('La factura ' + puntoVenta + '-' + numero + ' ya está cargada: el PDF se sube desde su legajo.');
  var raiz = DriveApp.getFolderById(config_('carpetaDriveId'));
  var carpeta = subcarpeta_(subcarpeta_(raiz, deQuien), 'En espera');
  var extension = (nombre.match(/\.[a-z0-9]+$/i) || [''])[0];
  var archivo = carpeta.createFile(Utilities.newBlob(Utilities.base64Decode(base64), mime, nombreDeArchivo_(nombre, puntoVenta + '-' + numero + ' ' + tipo + '_' + hoy_() + extension)));
  archivo.setDescription('Subido por ' + usuario.email + ' antes de cargar la factura (' + nombre + ')');
  compartirEnLaEmpresa_(archivo);
  var e = {
    id: 'esp-' + new Date().getTime() + '-' + Math.floor(Math.random() * 1000),
    sucursal: deQuien, puntoVenta: puntoVenta, numero: numero, tipo: tipo, siniestro: String(siniestro || ''),
    archivo: archivo.getName(), url: archivo.getUrl(), subidoPor: usuario.nombre || usuario.email, fecha: hoy_(), nombreOriginal: nombre, asociado: '',
  };
  conBloqueo_(function () { escribirFila_(hojaEspera_(), HOJAS.espera, null, e); });
  return e;
}

/** Al cargar el ERP: los PDF en espera que ya se unieron a su factura. Solo Cobranzas. */
function marcarEsperaAsociada(pares) {
  var usuario = usuarioActual_();
  if (usuario.rol !== 'auditoria') throw new Error('Solo Cobranzas carga el ERP.');
  return conBloqueo_(function () {
    var hoja = hojaEspera_();
    var n = 0;
    (pares || []).forEach(function (p) {
      var fila = buscarFila_(hoja, p.id);
      if (!fila) return;
      hoja.getRange(fila, HOJAS.espera.columnas.indexOf('asociado') + 1).setValue(p.comprobanteId);
      n++;
    });
    return n;
  });
}

/** Quitar un PDF en espera (por ejemplo, un número mal tipeado). Cobranzas o la misma sucursal. */
function descartarEspera(id) {
  var usuario = usuarioActual_();
  if (usuario.rol === 'gerencia') throw new Error('Gerencia solo puede consultar.');
  return conBloqueo_(function () {
    var hoja = hojaEspera_();
    var fila = buscarFila_(hoja, id);
    if (!fila) return false;
    var e = filaAObjeto_(HOJAS.espera, hoja.getRange(fila, 1, 1, HOJAS.espera.columnas.length).getValues()[0]);
    if (usuario.rol === 'sucursal' && !mismaSucursal_(e.sucursal, usuario.sucursal)) throw new Error('Es de otra sucursal.');
    hoja.deleteRow(fila);
    return true;
  });
}

/** La pestaña EnEspera se crea sola si una planilla de una versión anterior no la tiene. */
function hojaEspera_() {
  var libro = SpreadsheetApp.getActive();
  var hoja = libro.getSheetByName(HOJAS.espera.nombre);
  if (!hoja) {
    hoja = libro.insertSheet(HOJAS.espera.nombre);
    hoja.getRange(1, 1, hoja.getMaxRows(), HOJAS.espera.columnas.length).setNumberFormat('@');
    hoja.getRange(1, 1, 1, HOJAS.espera.columnas.length).setValues([HOJAS.espera.columnas]).setFontWeight('bold');
    hoja.setFrozenRows(1);
  }
  return hoja;
}

function leerEspera_() {
  var hoja = hojaEspera_();
  if (hoja.getLastRow() < 2) return [];
  return hoja.getRange(2, 1, hoja.getLastRow() - 1, HOJAS.espera.columnas.length).getValues()
    .filter(function (f) { return String(f[0]) !== ''; })
    .map(function (f) { return filaAObjeto_(HOJAS.espera, f); });
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
    // Pedidos de Cobranzas sin responder (errores de factura, refacturar) y notas de crédito sin avisar
    var pedidos = [];
    comprobantes.forEach(function (c) {
      if (!mismaSucursal_(c.sucursal, s.nombre)) return;
      var numero = c.tipo + ' E ' + c.puntoVenta + '-' + c.numero;
      (c.pedidos || []).forEach(function (x) { if (!x.cerrado && !x.respuesta) pedidos.push(numero + ' · ' + x.detalle + ' (desde el ' + String(x.fecha).split('-').reverse().join('/') + ')'); });
      if (c.tipo === 'NC' && c.ncInformada === false) pedidos.push(numero + ' · nota de crédito sin avisar: falta confirmar el motivo');
    });
    if (!atrasadas.length && !pedidos.length) return; // si no hay nada pendiente, no sale ningún mail
    var partes = [];
    if (atrasadas.length) {
      var criticas = atrasadas.filter(function (c) { return diasEntre_(c.fecha, hoy) > criticaDe_(c, p, sinFce); }).length;
      var importe = atrasadas.reduce(function (t, c) { return t + Number(c.total || 0) - Number(c.acreditado || 0); }, 0);
      var lineas = atrasadas.slice(0, 40).map(function (c) {
        return c.tipo + ' E ' + c.puntoVenta + '-' + c.numero + ' · ' + diasEntre_(c.fecha, hoy) + ' días' +
          (esMipyme_(c, p, sinFce) ? ' · MiPyME' : '') + (c.siniestro ? ' · siniestro ' + c.siniestro : '');
      });
      if (atrasadas.length > 40) lineas.push('y ' + (atrasadas.length - 40) + ' más (están todas en CobroSync)');
      partes.push('Estas facturas pasaron el plazo para la documentación (' + p.comun + ' días; ' + p.mipyme + ' si es MiPyME)' + (criticas ? '. ' + criticas + ' ya son críticas' : '') +
        '. Importe retenido: ' + pesos(importe) + '. Se solicita revisar con el equipo que se suban esta semana:\n\n- ' + lineas.join('\n- '));
    }
    if (pedidos.length) partes.push('Pedidos de Cobranzas sin responder:\n\n- ' + pedidos.slice(0, 40).join('\n- '));
    var asunto = atrasadas.length
      ? 'CobroSync · Resumen semanal de ' + s.nombre + ': ' + atrasadas.length + (atrasadas.length === 1 ? ' factura' : ' facturas') + ' sin documentación'
      : 'CobroSync · Resumen semanal de ' + s.nombre + ': ' + pedidos.length + (pedidos.length === 1 ? ' pedido' : ' pedidos') + ' de Cobranzas';
    enviar_(s.correoGerente, asunto, partes.join('\n\n'));
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
    // Solo cuentan los reclamos sin respuesta después de la última respuesta de la compañía
    var lista = c.reclamos || [];
    var desde = 0;
    for (var k = 0; k < lista.length; k++) if (lista[k] && lista[k].respuesta) desde = k + 1;
    if (vencida && !c.reenviar && lista.length - desde >= RECLAMOS_SIN_RESPUESTA && esperaCumplida) sumar(sinRespuesta, (companias[c.aseguradoraId] || {}).nombre || c.aseguradoraId, c);
  });
  var pesos = function (n) { return '$ ' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var facturas = function (n) { return n + (n === 1 ? ' factura' : ' facturas'); };
  var lista = function (mapa) {
    return Object.keys(mapa).sort(function (a, b) { return mapa[b].importe - mapa[a].importe; })
      .map(function (n) { return '- ' + n + ': ' + facturas(mapa[n].cantidad) + ' (' + pesos(mapa[n].importe) + ')'; }).join('\n');
  };
  var partes = [];
  if (Object.keys(sinRespuesta).length) {
    partes.push('Cobranzas solicita su apoyo: las siguientes compañías no respondieron 3 reclamos de facturas vencidas.\n' + lista(sinRespuesta));
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

/**
 * Presentar: todos los PDF de las facturas elegidas en un solo .zip, cada uno con el número de la
 * factura en el nombre (FC E 21-11032 orden.pdf). Solo Cobranzas.
 */
function descargarDocumentos(ids, nombre) {
  if (usuarioActual_().rol !== 'auditoria') throw new Error('Solo Cobranzas puede descargar los documentos.');
  var hoja = hoja_(HOJAS.comprobantes);
  var blobs = [];
  var faltan = 0;
  (ids || []).slice(0, 200).forEach(function (id) {
    var fila = buscarFila_(hoja, id);
    if (!fila) return;
    var c = leerFila_(hoja, fila);
    var numero = c.tipo + ' E ' + c.puntoVenta + '-' + c.numero;
    (c.documentos || []).forEach(function (d) {
      var enlaces = (d.adjuntos && d.adjuntos.length) ? d.adjuntos : (d.url ? [{ url: d.url }] : []);
      if (!enlaces.length) { faltan++; return; }
      enlaces.forEach(function (a, i) {
        var m = String(a.url || '').match(/[-\w]{25,}/);
        if (!m) { faltan++; return; }
        try {
          var b = DriveApp.getFileById(m[0]).getBlob();
          b.setName(numero + ' ' + d.tipo + (enlaces.length > 1 ? ' ' + (i + 1) : '') + '.pdf');
          blobs.push(b);
        } catch (e) { faltan++; }
      });
    });
  });
  if (!blobs.length) throw new Error('Las facturas elegidas no tienen documentos para descargar.');
  var limpio = String(nombre || 'documentos').replace(/[^\w .-]/g, '').trim() || 'documentos';
  var zip = Utilities.zip(blobs, limpio + '.zip');
  return { nombre: limpio + '.zip', base64: Utilities.base64Encode(zip.getBytes()), cantidad: blobs.length, faltan: faltan };
}

/**
 * Soporte técnico (menú): le llega un mail solo a la desarrolladora
 * (el correo de soporte de la pestaña Config), con quién lo manda y desde qué pantalla.
 */
function reportarProblema(texto, contexto) {
  var usuario = usuarioActual_();
  var correo = String(config_('correoSoporte') || '').trim();
  if (!correo) throw new Error('Todavía no hay un correo de soporte cargado (Ajustes).');
  var detalle = String(texto || '').trim().slice(0, 4000);
  if (!detalle) throw new Error('Falta la descripción del problema.');
  var c = contexto || {};
  MailApp.sendEmail({
    to: correo,
    replyTo: usuario.email,
    subject: 'CobroSync · Problema técnico informado por ' + (usuario.nombre || usuario.email),
    body:
      detalle +
      '\n\n— Datos del reporte —' +
      '\nUsuario: ' + (usuario.nombre || '') + ' <' + usuario.email + '>' +
      '\nSector: ' + usuario.rol + (usuario.sucursal ? ' · ' + usuario.sucursal : '') +
      '\nPantalla: ' + String(c.pantalla || '') +
      '\nNavegador: ' + String(c.navegador || '') +
      '\nFecha: ' + new Date().toISOString(),
    name: 'CobroSync · Soporte',
  });
  return true;
}

/** Pantalla Ajustes: plazos, compañías que reciben FCE y avisos por mail. Solo Cobranzas. */
function guardarAjustes(a) {
  var quien = exigirAdministradora_();
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
      correoSoporte: String(a.avisos.correoSoporte || ''),
      nombreSoporte: String(a.avisos.nombreSoporte || ''),
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
    delete CACHE_HOJAS_.config;
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

// ── La planilla de control de Cobranzas se sigue llenando sola ─────────────────

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

/** Botón de la aplicación al cargar el ERP: agrega a la pestaña Quiter las filas que no estén. Solo Cobranzas. */
function agregarAQuiter(filas) {
  if (usuarioActual_().rol !== 'auditoria') throw new Error('Solo Cobranzas puede cargar el ERP.');
  var libro = planillaDeControl_();
  if (!libro) return { configurada: false, agregadas: 0 };
  try {
    return agregarAQuiterEn_(libro, filas);
  } catch (e) {
    throw new Error(explicarErrorPlanilla_(e));
  }
}

/**
 * Los errores de la planilla de control, en palabras: el más común es una pestaña protegida (candado)
 * que no deja escribir a la cuenta con la que corre CobroSync.
 */
function explicarErrorPlanilla_(e) {
  var texto = String(e && e.message ? e.message : e);
  if (/protegid|protected|permiso|permission/i.test(texto)) {
    var cuenta = '';
    try { cuenta = Session.getEffectiveUser().getEmail(); } catch (x) { /* sin dato */ }
    return 'la pestaña está protegida: en la planilla de control, Datos → Hojas y rangos protegidos, hay que dejar editar a ' +
      (cuenta || 'la cuenta que publica CobroSync') + ' (detalle: ' + texto + ')';
  }
  return texto;
}

function agregarAQuiterEn_(libro, filas) {
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
  if (!libro) return 0;
  // Primero se trae lo nuevo de la planilla (mientras se usan las dos) y después se le completa lo de CobroSync
  try {
    traerDiario_(libro);
  } catch (e) {
    console.warn('No se pudo leer la planilla de control: ' + e);
  }
  var completadas = completarDiario_(libro);
  // De paso, se deja lista la foto de las facturas para que el próximo ingreso sea rápido
  try { prepararIngreso(); } catch (e) { console.warn('No se pudo preparar el ingreso: ' + e); }
  return completadas;
}

/** Botón "Traer los cambios de mi planilla ahora" (Ajustes → Planilla). Solo Cobranzas. */
function traerDeMiPlanilla() {
  exigirAdministradora_();
  var libro = planillaDeControl_();
  if (!libro) throw new Error('Falta el id de la planilla de control en la pestaña Config (planillaControlId).');
  var r = traerDiario_(libro);
  PropertiesService.getScriptProperties().setProperty('ultimaLecturaPlanilla', ahora_());
  return r;
}

/**
 * Lee la hoja Diario de la planilla de control y la pasa a CobroSync, con el mismo criterio que
 * "Usar mi planilla": agrega las facturas nuevas y, en las que ya están, completa Drive (documentación
 * aprobada), presentación, cobro y anulación. No toca lo que se hizo en la plataforma.
 * Columnas: A Fecha · B Ref. · C Sucursal · D CTE. · E Número · F Compañía · G Siniestro · H Total ·
 * I Drive · K Presentación · M Vto. · N Cobro · O Estado · R Observaciones · S/T/U reclamos (opcionales)
 */
function traerDiario_(libro) {
  var leido = leerDiario_(libro);
  if (!leido) return { nuevas: 0, actualizadas: 0, omitidas: 0 };
  if (leido.nuevasCompanias.length) {
    var hojaAseg = hoja_(HOJAS.aseguradoras);
    leido.nuevasCompanias.forEach(function (a) { escribirFila_(hojaAseg, HOJAS.aseguradoras, null, a); });
  }
  var r = sincronizarLista_(leido.lista, 'Planilla de control');
  PropertiesService.getScriptProperties().setProperty('ultimaLecturaPlanilla', ahora_());
  return r;
}

/** Las filas de la hoja Diario ya pasadas a comprobantes (sin guardar nada). null si la hoja está vacía. */
function leerDiario_(libro) {
  var hoja = libro.getSheetByName(config_('pestanaDiario') || 'Diario');
  if (!hoja || hoja.getLastRow() < 2) return null;
  var filas = hoja.getRange(1, 1, hoja.getLastRow(), 21).getDisplayValues();
  var aseguradoras = leerHoja_(HOJAS.aseguradoras);
  var porId = {};
  aseguradoras.forEach(function (a) { porId[a.id] = a; });
  var nuevasCompanias = [];
  var lista = [];
  filas.forEach(function (f) {
    var fecha = fechaPlanilla_(f[0]);
    var sucursal = String(f[2] || '').trim();
    if (!fecha || !sucursal) return;
    var compania = String(f[5] || '').trim();
    var tipo = /^NC/i.test(String(f[3] || '').trim()) ? 'NC' : 'FC';
    var partes = String(f[4] || '').split('-').map(function (x) { return Number(String(x).replace(/\D/g, '')) || 0; });
    var idCompania = slugPlanilla_(compania) || 'sin-compania';
    var aseguradora = porId[idCompania];
    if (!aseguradora) {
      aseguradora = { id: idCompania, nombre: compania || 'Sin compañía', email: '', canal: 'portal', plazoPagoDias: /patronal/i.test(compania) ? 7 : 30 };
      porId[idCompania] = aseguradora;
      nuevasCompanias.push(aseguradora);
    }
    var drive = fechaPlanilla_(f[8]);
    var presentacion = fechaPlanilla_(f[10]);
    var cobro = fechaPlanilla_(f[13]);
    var estadoTexto = String(f[14] || '').trim().toLowerCase();
    var estado = tipo === 'NC' ? 'nota_credito'
      : /^anul/.test(estadoTexto) ? 'anulada'
      : /^cobr/.test(estadoTexto) || cobro ? 'cobrada'
      : presentacion || /^vencid/.test(estadoTexto) || /^al d/.test(estadoTexto) ? 'presentada'
      : drive || /^p\. pend/.test(estadoTexto) ? 'en_gestion' : 'pendiente_drive';
    var completo = drive !== null || /^p\. pend/.test(estadoTexto) || presentacion !== null;
    var total = importePlanilla_(f[7]);
    var ref = String(f[1] || '').trim();
    lista.push({
      id: ref ? 'ref-' + ref : 'pl-' + tipo + '-' + (partes[0] || 0) + '-' + (partes[1] || 0),
      ref: ref, tipo: tipo, fecha: fecha, sucursal: sucursal, puntoVenta: partes[0] || 0, numero: partes[1] || 0,
      aseguradoraId: aseguradora.id, siniestro: String(f[6] || '').trim(), patente: '',
      total: tipo === 'NC' ? -Math.abs(total) : total,
      fechaDrive: drive, subidoPor: null,
      fechaAprobacion: tipo === 'NC' || !completo ? null : (drive || presentacion),
      fechaPresentacion: estado === 'anulada' ? null : presentacion,
      vencimiento: estado === 'anulada' || !presentacion ? null : (fechaPlanilla_(f[12]) || sumarDias_(presentacion, aseguradora.plazoPagoDias || 30)),
      fechaCobro: estado === 'cobrada' ? cobro : null,
      estado: estado, ncReferencia: null, ncInformada: tipo === 'NC' ? true : null, compromiso: null,
      reclamos: [], observaciones: String(f[17] || '').trim(),
      documentos: tipo === 'NC' ? [] : ['factura', 'orden'].map(function (t) { return { tipo: t, estado: completo ? 'ok' : 'faltante' }; }),
      eventos: [],
      // Para la comparación: el nombre de la compañía y el estado como se ven en la planilla
      _compania: compania,
    });
  });
  return { lista: lista, nuevasCompanias: nuevasCompanias };
}

/**
 * Compara la hoja Diario de la planilla de control con lo que hay en CobroSync, factura por factura
 * (por la referencia) y campo por campo. No cambia nada. Solo la administradora.
 * Devuelve el resumen, cuántas diferencias hay por campo y la lista de las que no coinciden.
 */
function compararConPlanilla() {
  exigirAdministradora_();
  var libro = planillaDeControl_();
  if (!libro) throw new Error('Falta el id de la planilla de control en la pestaña Config (planillaControlId).');
  var leido = leerDiario_(libro);
  var lista = leido ? leido.lista : [];
  var delPiloto = leerHoja_(HOJAS.sucursales).map(function (s) { return s.nombre; });
  var esDelPiloto = function (suc) { return !delPiloto.length || delPiloto.some(function (n) { return mismaSucursal_(n, suc); }); };
  var nombres = {};
  leerHoja_(HOJAS.aseguradoras).forEach(function (a) { nombres[a.id] = a.nombre; });
  var actuales = leerHoja_(HOJAS.comprobantes);
  var porClave = {};
  actuales.forEach(function (c) { porClave[c.ref ? 'ref:' + c.ref : 'id:' + c.id] = c; });
  var vistas = {};

  var numero = function (c) { return c.tipo + ' ' + c.puntoVenta + '-' + c.numero; };
  // Cómo está cada una, en las palabras de la planilla
  var situacion = function (c) {
    if (c.tipo === 'NC') return 'Nota de crédito';
    if (c.estado === 'anulada') return 'Anulada';
    if (c.estado === 'cobrada') return 'Cobrada';
    if (c.fechaPresentacion) return 'Presentada';
    return 'Sin presentar';
  };
  var texto = function (v) { return v === null || v === undefined ? '' : String(v).trim(); };
  var CAMPOS = [
    { campo: 'Fecha', de: function (c) { return texto(c.fecha); } },
    { campo: 'Sucursal', de: function (c) { return texto(c.sucursal); }, igual: function (a, b) { return mismaSucursal_(a, b); } },
    { campo: 'Comprobante', de: numero },
    { campo: 'Compañía', de: function (c) { return texto(c.aseguradoraId); }, ver: function (v, c) { return c._compania || nombres[v] || v; } },
    // Mismo siniestro con o sin guiones/espacios, o con ceros de menos adelante (Sheets los borra); el orden nunca cambia
    { campo: 'Siniestro', de: function (c) { return texto(c.siniestro).replace(/[^0-9A-Za-z]/g, '').replace(/^0+/, '').toUpperCase(); }, ver: function (v, c) { return texto(c.siniestro); } },
    { campo: 'Importe', de: function (c) { return Number(c.total) || 0; }, igual: function (a, b) { return Math.abs(a - b) < 0.01; } },
    { campo: 'Drive', de: function (c) { return texto(c.fechaDrive); } },
    { campo: 'Presentación', de: function (c) { return texto(c.fechaPresentacion); } },
    { campo: 'Cobro', de: function (c) { return c.estado === 'cobrada' ? texto(c.fechaCobro) : ''; } },
    { campo: 'Estado', de: situacion },
  ];

  var resultado = {
    comparadas: 0, iguales: 0, conDiferencias: 0, omitidas: 0, porCampo: {}, diferencias: [], soloPlanilla: [], soloCobroSync: [],
    totales: { planilla: { cantidad: 0, facturado: 0, cobrado: 0 }, cobrosync: { cantidad: 0, facturado: 0, cobrado: 0 } },
    ahora: ahora_(),
  };
  CAMPOS.forEach(function (k) { resultado.porCampo[k.campo] = 0; });
  var MAX = 3000;
  var sumar = function (t, c) {
    t.cantidad++;
    if (c.estado !== 'anulada') t.facturado += Number(c.total) || 0;
    if (c.estado === 'cobrada') t.cobrado += Number(c.total) || 0;
  };
  var fila = function (c) { return { ref: texto(c.ref), comprobante: numero(c), fecha: c.fecha, sucursal: c.sucursal, compania: c._compania || nombres[c.aseguradoraId] || c.aseguradoraId, importe: Number(c.total) || 0 }; };

  lista.forEach(function (p) {
    if (!esDelPiloto(p.sucursal)) { resultado.omitidas++; return; }
    sumar(resultado.totales.planilla, p);
    var clave = p.ref ? 'ref:' + p.ref : 'id:' + p.id;
    var c = porClave[clave];
    if (!c) { if (resultado.soloPlanilla.length < MAX) resultado.soloPlanilla.push(fila(p)); return; }
    vistas[clave] = true;
    sumar(resultado.totales.cobrosync, c);
    resultado.comparadas++;
    var difs = [];
    CAMPOS.forEach(function (k) {
      var a = k.de(p), b = k.de(c);
      var igual = k.igual ? k.igual(a, b) : a === b;
      if (igual) return;
      resultado.porCampo[k.campo]++;
      difs.push({ campo: k.campo, planilla: k.ver ? k.ver(a, p) : a, cobrosync: k.ver ? k.ver(b, c) : b });
    });
    if (!difs.length) { resultado.iguales++; return; }
    resultado.conDiferencias++;
    if (resultado.diferencias.length < MAX) {
      var f = fila(p);
      f.campos = difs;
      resultado.diferencias.push(f);
    }
  });
  actuales.forEach(function (c) {
    var clave = c.ref ? 'ref:' + c.ref : 'id:' + c.id;
    if (vistas[clave] || !esDelPiloto(c.sucursal)) return;
    if (resultado.soloCobroSync.length < MAX) resultado.soloCobroSync.push(fila(c));
  });
  resultado.cantidadSoloCobroSync = actuales.filter(function (c) { return !vistas[c.ref ? 'ref:' + c.ref : 'id:' + c.id] && esDelPiloto(c.sucursal); }).length;
  return resultado;
}

/** "02-01-26", "02/01/26" o "02/01/2026" → "2026-01-02" (como se ve en la planilla) */
function fechaPlanilla_(v) {
  var m = /^\s*(\d{1,2})[-\/](\d{1,2})[-\/](\d{2}|\d{4})\s*$/.exec(String(v || ''));
  if (!m) return null;
  return (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
}

/** "3.222.184,35", "(1.156.894,74)" o "$ 1.000" → número */
function importePlanilla_(v) {
  var t = String(v || '').trim();
  var negativo = t.charAt(0) === '-' || (t.charAt(0) === '(' && t.charAt(t.length - 1) === ')');
  var n = Number(t.replace(/[^\d,]/g, '').replace(',', '.'));
  return isFinite(n) ? (negativo ? -n : n) : 0;
}

function slugPlanilla_(t) {
  return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function sumarDias_(fecha, dias) {
  var d = new Date(fecha + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + Number(dias || 0));
  return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
}

function actualizarMiPlanilla() {
  exigirAdministradora_();
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

/** El nombre original del archivo (sin la ruta ni caracteres raros); si viene vacío, el de reserva. */
function nombreDeArchivo_(nombre, reserva) {
  var n = String(nombre || '').split(/[\\/]/).pop().replace(/[\u0000-\u001f]/g, '').trim();
  return n || reserva;
}

/**
 * ¿El nombre del archivo tiene el punto de venta y el número de esta factura? Con o sin ceros adelante,
 * separados por guion, espacio, punto, barra o nada: "21-20755", "0021 00020755", "21.20755", "2100020755".
 * (La misma regla que src/domain/archivos.ts.)
 */
function nombreTieneFactura_(nombre, pv, numero) {
  var base = String(nombre).replace(/\.[a-z0-9]+$/i, '');
  var runs = base.match(/\d+/g) || [];
  for (var i = 0; i < runs.length; i++) {
    if (i + 1 < runs.length && Number(runs[i]) === Number(pv) && Number(runs[i + 1]) === Number(numero)) return true;
    if (new RegExp('^0*' + Number(pv) + '0*' + Number(numero) + '$').test(runs[i]) && runs[i].length >= 6) return true;
  }
  return false;
}

/** Lo que hay en una celda de fecha → "AAAA-MM-DD" (acepta fecha, "30/10/2026" o "30-10-26"). */
function fechaDeCelda_(v) {
  if (v instanceof Date) return fechaIso_(v);
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
  CACHE_HOJAS_ = {};
}

/** Programa los avisos diarios (8 h) y el resumen de los lunes (8 h). */
function instalarDisparadores() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('avisosDiarios').timeBased().everyDays(1).atHour(8).create();
  ScriptApp.newTrigger('resumenSemanal').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).create();
  ScriptApp.newTrigger('actualizarPlanillaDeControl').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('hacerBackups').timeBased().everyDays(1).atHour(3).create();
}

// ── Backups ─────────────────────────────────────────────────────────────────

/**
 * Copias de la planilla "CobroSync · Datos" (todas las pestañas) en la carpeta "CobroSync · Backups",
 * dentro de la carpeta de documentos. Se hacen solas cada madrugada: la diaria siempre, la semanal los
 * domingos y la mensual el día 1. Las más viejas de cada tipo pasan a la papelera (se pueden recuperar
 * de ahí 30 días). Los documentos (PDF) no se copian ni se tocan: quedan siempre donde están.
 */
var BACKUPS_ = {
  carpeta: 'CobroSync · Backups',
  prefijo: 'CobroSync · Datos · ',
  guardar: { diario: 7, semanal: 4, mensual: 12, manual: 10 },
};

function carpetaBackups_() {
  return subcarpeta_(DriveApp.getFolderById(config_('carpetaDriveId')), BACKUPS_.carpeta);
}

/** Una copia de un tipo y, después, se dejan solo las más nuevas de ese tipo. */
function copiaDeBackup_(carpeta, tipo, fecha) {
  var nombre = BACKUPS_.prefijo + tipo + ' ' + fecha;
  var original = DriveApp.getFileById(SpreadsheetApp.getActive().getId());
  var copia = original.makeCopy(nombre, carpeta);
  var deEseTipo = [];
  var it = carpeta.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (f.getName().indexOf(BACKUPS_.prefijo + tipo + ' ') === 0) deEseTipo.push(f);
  }
  deEseTipo.sort(function (a, b) { return a.getName() < b.getName() ? 1 : a.getName() > b.getName() ? -1 : 0; }); // más nuevas primero
  deEseTipo.slice(BACKUPS_.guardar[tipo]).forEach(function (f) { f.setTrashed(true); });
  return { nombre: nombre, url: copia.getUrl() };
}

/** Lo corre el disparador de cada madrugada (ver instalarDisparadores). */
function hacerBackups() {
  var carpeta = carpetaBackups_();
  var hoy = hoy_();
  var dia = new Date(hoy + 'T12:00:00Z');
  var tipos = ['diario'];
  if (dia.getUTCDay() === 0) tipos.push('semanal');
  if (dia.getUTCDate() === 1) tipos.push('mensual');
  var hechos = tipos.map(function (t) { return copiaDeBackup_(carpeta, t, hoy); });
  PropertiesService.getScriptProperties().setProperty('ultimoBackup', ahora_());
  return hechos;
}

/** Botón "Hacer un backup ahora" (Ajustes). Solo la administradora. */
function hacerBackupAhora() {
  exigirAdministradora_();
  var hecho = copiaDeBackup_(carpetaBackups_(), 'manual', ahora_().slice(0, 16).replace('T', ' '));
  PropertiesService.getScriptProperties().setProperty('ultimoBackup', ahora_());
  return hecho;
}

/** Los backups que hay, de los más nuevos a los más viejos. Solo la administradora. */
function listarBackups() {
  exigirAdministradora_();
  var lista = [];
  var it = carpetaBackups_().getFiles();
  while (it.hasNext()) {
    var f = it.next();
    var nombre = f.getName();
    if (nombre.indexOf(BACKUPS_.prefijo) !== 0) continue;
    var resto = nombre.slice(BACKUPS_.prefijo.length);
    var tipo = resto.split(' ')[0];
    lista.push({ nombre: nombre, tipo: tipo, fecha: resto.slice(tipo.length + 1), url: f.getUrl() });
  }
  lista.sort(function (a, b) { return a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0; });
  var disparador = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'hacerBackups'; });
  return { backups: lista, ultimo: PropertiesService.getScriptProperties().getProperty('ultimoBackup') || '', automatico: disparador };
}

// ── Utilidades ──────────────────────────────────────────────────────────────

function usuarioActual_() {
  var email = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  var dominio = String(config_('dominio') || '').toLowerCase();
  if (!email || (dominio && email.split('@')[1] !== dominio)) throw errorAcceso_('dominio', email);
  var u = usuarios_().filter(function (x) { return String(x.email).toLowerCase() === email; })[0];
  if (!u) throw errorAcceso_('usuario', email);
  var textoRol = String(u.rol).toLowerCase();
  // Administradora (o desarrolladora): trabaja como Cobranzas y además maneja los Ajustes y mira como los demás
  var admin = /^(admin|desarroll)/.test(textoRol);
  var rol = textoRol.indexOf('geren') === 0 ? 'gerencia' : admin || /^(audit|cobran)/.test(textoRol) ? 'auditoria' : 'sucursal';
  if (rol === 'sucursal' && !u.sucursal) throw errorAcceso_('sucursal', email);
  // Cobranzas con una sucursal en Usuarios: además escanea la documentación de esa sucursal (la suya)
  return {
    email: email, nombre: u.nombre || email, rol: rol, sucursal: rol === 'sucursal' ? u.sucursal : null,
    sucursalPropia: rol === 'auditoria' && u.sucursal ? u.sucursal : null,
    administradora: rol === 'auditoria' && (admin || sinAdministradora_(email)),
  };
}

/**
 * Mientras nadie tiene el rol Administradora en Usuarios, sigue valiendo lo de antes: la cuenta del
 * correo de soporte (o, si tampoco está cargado, cualquiera de Cobranzas, para la primera configuración).
 */
function sinAdministradora_(email) {
  var hay = usuarios_().some(function (x) { return /^(admin|desarroll)/.test(String(x.rol).toLowerCase()); });
  if (hay) return false;
  var soporte = String(config_('correoSoporte') || '').trim().toLowerCase();
  return !soporte || soporte === email;
}

/** Ajustes, compañías y planilla: solo la administradora. */
function exigirAdministradora_() {
  var u = usuarioActual_();
  if (!u.administradora) throw new Error('Esto lo cambia solo la administradora.');
  return u;
}

/** Si la pestaña es de una versión anterior, le agrega al final los encabezados de las columnas nuevas. */
function agregarColumnasNuevas_(hoja, h) {
  var ultima = hoja.getLastColumn();
  if (ultima >= h.columnas.length) return;
  hoja.getRange(1, ultima + 1, hoja.getMaxRows(), h.columnas.length - ultima).setNumberFormat('@');
  hoja.getRange(1, 1, 1, h.columnas.length).setValues([h.columnas]).setFontWeight('bold');
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

/** Lee una celda con JSON; si está vacía o no es JSON válido, devuelve el valor por defecto (no se traba). */
function leerJson_(v, porDefecto) {
  if (!v) return porDefecto;
  try { return JSON.parse(v); } catch (e) { return porDefecto; }
}

/**
 * Fecha de la planilla → "aaaa-mm-dd" en hora de Buenos Aires (UTC−3, sin horario de verano).
 * Se calcula a mano: Utilities.formatDate tarda mucho cuando son miles de celdas (era casi todo el
 * tiempo del ingreso).
 */
function fechaIso_(d) {
  var t = new Date(d.getTime() - 3 * 3600 * 1000);
  return t.getUTCFullYear() + '-' + ('0' + (t.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + t.getUTCDate()).slice(-2);
}

function filaAObjeto_(h, fila) {
  var o = {};
  h.columnas.forEach(function (col, i) {
    var v = fila[i];
    if (v instanceof Date) {
      // Un siniestro que la planilla había tomado por fecha: se nota para repararlo con la planilla de control
      if (col === 'siniestro') o._siniestroDanado = true;
      v = fechaIso_(v);
    }
    // Un error de fórmula en la celda (#N/A, #REF!…) se toma como vacío: no puede trabar la plataforma
    if (typeof v === 'string' && /^#(N\/A|REF!|VALUE!|DIV\/0!|NAME\?|NUM!|NULL!|ERROR!)/.test(v)) v = '';
    if (COLUMNAS_JSON.indexOf(col) >= 0) v = leerJson_(v, col === 'compromiso' || col === 'anulacionInformada' || col === 'refacturacion' ? null : []);
    // La firma ya no es un documento aparte (va en la orden firmada)
    if (col === 'documentos' && Array.isArray(v)) v = v.filter(function (d) { return d && d.tipo !== 'firma'; });
    else if (COLUMNAS_NUMERO.indexOf(col) >= 0) v = v === '' ? 0 : Number(v);
    else if (COLUMNAS_NUMERO_OPCIONAL.indexOf(col) >= 0) v = v === '' ? null : Number(v);
    else if (col === 'ncInformada') v = v === '' ? null : v === true || v === 'TRUE' || v === 'SI';
    else if (col === 'pausada') v = v === true || /^(si|true)$/i.test(String(v));
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

/**
 * Columnas que son texto aunque parezcan número o fecha. Google Sheets convierte solo lo que escribimos:
 * "20 02 92907" lo guardaba como la fecha 20/02/92907 y "004250654891" perdía los ceros de adelante.
 * Con un apóstrofo adelante, la planilla lo guarda tal cual (el apóstrofo no queda en el dato).
 */
var COLUMNAS_TEXTO = ['ref', 'siniestro', 'patente', 'observaciones'];

function escribirFila_(hoja, h, fila, o) {
  var valores = h.columnas.map(function (col) {
    if (col === 'actualizado') return ahora_();
    var v = o[col];
    if (COLUMNAS_JSON.indexOf(col) >= 0) return v === null || v === undefined ? '' : JSON.stringify(v);
    if (h === HOJAS.comprobantes && COLUMNAS_TEXTO.indexOf(col) >= 0 && typeof v === 'string' && v !== '') return "'" + v;
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

/**
 * Lo leído en esta ejecución (Config y Usuarios), para no ir a la planilla una vez por cada dato.
 * Apps Script arranca de cero en cada llamada, así que nunca queda viejo de una llamada a otra.
 */
var CACHE_HOJAS_ = {};

function config_(clave) {
  if (!CACHE_HOJAS_.config) CACHE_HOJAS_.config = leerHoja_(HOJAS.config);
  var fila = CACHE_HOJAS_.config.filter(function (x) { return x.clave === clave; })[0];
  return fila ? fila.valor : '';
}

function usuarios_() {
  if (!CACHE_HOJAS_.usuarios) CACHE_HOJAS_.usuarios = leerHoja_(HOJAS.usuarios);
  return CACHE_HOJAS_.usuarios;
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
    body: cuerpo + (url ? '\n\nVer en CobroSync: ' + url : '') + '\n\n— Mensaje automático de CobroSync (Cobranzas)',
    name: 'CobroSync · Cobranzas',
  });
}
