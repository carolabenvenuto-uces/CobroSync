# Changelog

Desde la 1.0, el número de versión es el que se ve en la aplicación (junto al logo, en el ingreso y en el manual). Las versiones 0.x fueron el desarrollo previo al lanzamiento.

## [1.0.0] - 2026-11-04 (repaso antes de la presentación)

### Corregido
- **Manual por preguntas:** cada tema es una pregunta que se despliega al tocarla, con un buscador; primero las del propio sector. "¿Algo no funciona?" va arriba, destacado, con el botón Avisar un problema (le llega solo al correo de soporte de Ajustes).
- **PDF de facturas de hoy:** la sucursal puede subir en "Subir varios PDF" los de facturas que todavía no están (el ERP se carga al día siguiente), si el punto de venta es suyo. Quedan en espera y, al cargar el ERP, se unen solos a su legajo (en revisión, con el siniestro). Mis facturas muestra lo que está en espera; Control diario muestra a Auditoría los PDF que llevan más de 2 días sin factura, para revisar el número o quitarlos. Nueva pestaña EnEspera en la planilla (se crea sola).
- **Nombres de archivo:** número de factura y siniestro ("35-11032 siniestro 22365.pdf"; "fc" u "or" opcionales), hasta 40 caracteres. En la carga de varios, si falta el siniestro se escribe en la fila. Las condiciones se leen sí o sí la primera vez (hasta tocar Entendido no se pueden agregar archivos).
- Pie de página sin el logo de Grupo SVA (queda en el menú, junto al usuario).
- Menú: la barra de desplazamiento va del color del menú, sin la franja gris.
- **Foto desde el celular, revisada:** se elige cómo queda cada página (original, mejorada o blanco y negro) mirándola; tocar una página la muestra grande; la mejora ya no exagera los colores; antes de subir, una pantalla muestra el documento completo (Volver a editar o Subir PDF). En la demo, lo subido se puede abrir.
- **Siniestro al subir la orden:** la factura no tiene siniestro hasta que la sucursal sube la orden; al subirla se pide el número (un campo en el legajo, o en el nombre del archivo: "35-11032 orden 029-9-506622.pdf").
- Subir varios PDF: las condiciones se muestran la primera vez y después quedan en el botón Condiciones; más cortas.
- Logo de Grupo SVA en el menú, junto al usuario (en el celular sigue en el pie).
- Ranking de sucursales: sin los días promedio hasta subir ni la comparación con el mes anterior.
- Resumen: el porcentaje de cada parte del año va junto a su título.
- Resumen, recuadro del año: la barra va debajo de lo facturado y cada parte (cobrado, notas de crédito, falta cobrar) muestra su importe, su color y su porcentaje una sola vez.
- **Foto desde el celular:** cada documento de la sucursal tiene el botón Foto, que abre la cámara. Cada foto es una página; se mejora en el navegador (luz pareja, papel blanco, más contraste, opción blanco y negro), se puede girar o quitar, y se sube como un solo PDF.
- Los desplegables que deciden algo (la factura que anula una nota de crédito, motivos de observación, rechazo y demora, documento rechazado, tipo de pedido y respuesta de la compañía) arrancan en "Seleccionar…": no vienen con la primera opción elegida y el botón se habilita recién al elegir.
- Logo de Grupo SVA en el ingreso y en el pie de cada pantalla.
- Sin la aclaración "(restan)" en las notas de crédito del Resumen y del manual.
- Presentar: el encabezado de cada compañía pasa a dos renglones (datos arriba, botones abajo) para que no se aprieten.
- Pedidos a sucursales: el detalle tiene más ancho y el de las notas de crédito sin aviso es más corto.
- Mis facturas (rechazos y por vencer): sin la columna Prioridad, que repetía la marca MiPyME; el motivo tiene más ancho.
- Mis siniestros: las cuatro cifras del siniestro en dos columnas, para que los importes entren completos.
- **Menú de Auditoría ordenado:** Avisos junto a Notificaciones; Trabajo diario (Control diario, Presentar, Compañías); Seguimiento y reclamos (Pendientes de sucursales, Pedidos a sucursales, Vencidas y reclamos); Informes; Configuración (Usar mi planilla y Ajustes).
- **Ajustes, solo de la administradora:** con el correo de soporte cargado, solo esa cuenta ve y guarda los Ajustes (también lo controla el servidor).
- Los importes vencidos van en el mismo rojo oscuro que su marca.
- **Presentar, más simple:** sin el texto de explicación; una fila por compañía (cantidad, canal, MiPyME, reenvíos y total) que abre su pantalla con las facturas para elegir, descargar los documentos, armar el mail o abrir la plataforma y marcarlas como presentadas.
- **Notificaciones de Auditoría, menos mensajes:** lo que sube cada sucursal en el día llega en un solo aviso ("Documentación subida en 8 facturas") con la lista para abrir cada una. Las observaciones, notas de crédito, compromisos y respuestas siguen llegando de a uno.
- **Seguimiento y reclamos, más liviano:** sin los textos de explicación ni las tarjetas grandes; arriba de cada tabla, una fila de botones con cantidad e importe por estado. Pendientes y Pedidos a sucursales quedan en una sola opción del menú, con dos pestañas (Documentación y Pedidos). En Vencidas y reclamos, la barra para reclamar o registrar la respuesta aparece solo al marcar facturas.
- En el celular: los botones de estado pasan de renglón en vez de deslizarse, sin el importe, y en Presentar cada factura muestra número, sucursal, días y total sin tener que deslizar la tabla.

## [1.0.0] - 2026-11-04 (marca)

### Cambiado
- **Logo nuevo:** un imán en forma de C (lila) con los polos en verde agua, que atrae puntitos: los cobros. También en el ícono de la pestaña.
- **Paleta del imán, en tonos sobrios:** tinta (menú y textos), lila (marca y botones principales) y verde agua (aprobado y cobrado). "Al día" pasa a azul para no confundirse con el lila. Mismo significado de siempre para cada color.
- **Mis facturas:** cada tarjeta lleva una franja de color según la urgencia, de arriba hacia abajo: ámbar (para subir), celeste (en revisión), naranja (por vencer o vencidas) y rojo (rechazos y pedidos).

## [1.0.0] - 2026-11-04 (Auditoría)

### Agregado
- **Pedidos a sucursales:** Auditoría le pide algo a la sucursal desde la factura (error en la factura, refacturar, otro). La sucursal lo ve en Mis facturas (tarjeta "Rechazos y pedidos de Auditoría") y responde; Auditoría lo da por resuelto. Una nota de crédito que entra sin aviso genera su pedido sola. Pantalla nueva con los días de espera de cada pedido, y los pedidos sin responder van en el mail de los lunes de cada sucursal.
- **Respuesta de la compañía a un reclamo, con un clic** (en la factura o en lote): pasa a pagos (se espera un mes), reenviar la documentación (vuelve a Presentar) o refacturar (pedido a la sucursal). Para pedir apoyo a Gerencia solo cuentan los reclamos sin respuesta.
- **Tolerancia por compañía:** días después del vencimiento antes de reclamar, para las que suelen pagar.
- **Presentar por compañía y por canal:** mail o plataforma (con el acceso), descarga de todos los documentos en un .zip con el número de factura en cada nombre, y marcar como presentadas por compañía.
- **Para no pisarse:** una factura abierta o en preparación queda tomada unos minutos a nombre de quien la tiene; la otra persona ve el aviso.

### Cambiado
- La marca MiPyME es una pastilla con un rayo, sin el signo "!" que se confundía con un 1.

## [1.0.0] - 2026-11-04 (ajustes previos al lanzamiento)

### Cambiado
- **Sucursal · Mis facturas:** las cuatro tarjetas van una debajo de la otra, a lo ancho: Para subir, En revisión, Por vencer o vencidas y Rechazos y observaciones.
- **Aviso de plazos:** al abrirlo desde el botón, el cartel sale de la esquina y se agranda (el mismo movimiento que al cerrarlo).
- **Sucursal · Mis siniestros, rediseñada como bandeja:** lista de siniestros a la izquierda (lo más reciente primero) y el siniestro elegido a la derecha, con facturado, notas de crédito, cobrado y lo que falta cobrar, y cada factura con sus documentos y sus notas de crédito colgadas debajo. Búsqueda, filtro por compañía y por estado. Sin etiquetas de estado en la lista (eso ya está en Mis facturas).
- **Notificaciones como un correo:** la bandeja ocupa todo el ancho, con cada mensaje en una línea (remitente, asunto, vista previa y fecha); al abrir uno, se lee a lo ancho y se vuelve a la bandeja.
- **Manual de uso:** cada sector ve lo general y lo suyo; Auditoría ve todo. Nuevo apartado "¿Algo no funciona?" para mandarle un reporte técnico a la desarrolladora: llega por mail solo a ella (correo de soporte en Ajustes), con el usuario, el sector y la pantalla.
- **Sucursal · Mis facturas con los cuatro estados juntos:** Rechazos y observaciones, Por vencer o vencidas, Para subir y En revisión. Cada tarjeta abre su listado en una pantalla encima, que se cierra para volver (también con Escape). Se quita la pestaña "Para resolver": sus dos listas son ahora las dos primeras tarjetas.
- **Aviso de plazos:** al cerrarlo, el cartel se achica y viaja hasta el botón "Plazos", que se resalta un momento; así se ve dónde queda.
- **Notificaciones:** en la sucursal, filtros Todas / Rechazos / Documentación faltante (lo no leído ya va en negrita); en Auditoría y Gerencia, Todas / Sin leer. Buscador por número de factura o siniestro.
- **Marca:** "CobroSync v1.0" con la versión chica al lado del nombre; debajo del logo, "by Carola Benvenuto"; en el pie de cada pantalla, "CobroSync v1.0 · Diseño y desarrollo: Carola Benvenuto".
- **Tono:** se reemplazan las formas de "usted" que sonaban forzadas por frases sin verbo o impersonales ("Sin tareas pendientes", "Buscar por número…", "Hay que cambiarle el nombre"), con trato formal.

## [1.0.0] - 2026-11-04

### Agregado
- **Manual de uso** (en el menú, abajo, y en la pantalla de ingreso): qué es CobroSync, el camino de una factura, qué significa cada color, notificaciones, listas y Excel, y una guía por sector (Sucursal y Gerencia completas; Auditoría, base para completar). Reemplaza a la presentación del producto.
- **Marca y autoría:** CobroSync 1.0, un desarrollo de Benvenuto Desarrollos · Carola Benvenuto. La firma va debajo del logo, en el ingreso, en el pie de cada pantalla y en el manual. Todo sale de un solo archivo (src/lib/marca.ts).

### Cambiado
- **Sucursal · Mis facturas, más liviana:** el aviso de plazos aparece grande la primera vez, con "Entendido", y después queda en un botón chico "Plazos" arriba a la derecha. Los dos botones de acción son finos y van arriba. Queda una sola tarjeta, "Para subir", que se abre y se cierra tocándola. Lo que está en revisión pasa a una línea con "Verlas". El buscador va pegado a la lista, con el resultado justo debajo.
- **Sucursal · Para resolver:** tarjetas más chicas, con flecha para abrir y cerrar.
- **Tono formal en toda la aplicación:** los textos, ayudas, errores y mails pasan de "vos" a "usted" ("Toque", "Tiene", "su sucursal").
- **Sin avisos de demostración:** se quitaron los carteles que aclaraban que es una demo (ingreso, pie, notificaciones, legajo, Ajustes, Compañías).
- **Resumen · Año:** cada importe dice qué porcentaje es de lo facturado, y un gráfico muestra cómo se reparte lo facturado del año: cobrado, notas de crédito y lo que falta cobrar. Llena el espacio que quedaba en blanco.

## [0.12.9] - 2026-11-04

### Corregido
- **Exportar a Excel:** ahora baja un Excel de verdad (.xlsx) en lugar de un CSV. Cada dato va en su columna en cualquier computadora (antes, con Excel configurado con coma, quedaba todo en una celda). Los importes son números (se pueden sumar), las fechas son fechas, y la primera fila va en negrita, fija y con filtro.

## [0.12.8] - 2026-11-04

### Cambiado
- **Sucursal · Mis facturas:** se quitó la leyenda + ! … ✓ del recuadro Importante (queda solo el plazo y la fecha estimada). Las etiquetas de cada factura se leen solas: "+ Falta la orden firmada", "✓ Factura aprobada", "… Factura en revisión", "! Orden firmada observada". Mismo criterio en Mis siniestros, donde además cada etiqueta queda junto a su explicación (no se separan al bajar de renglón) y "Con nota de crédito" lleva borde para no perderse contra el fondo.

## [0.12.7] - 2026-11-04

### Corregido
- **Ordenar por una columna ya no "pierde" filas:** las que no tienen dato (por ejemplo, sin fecha de subida) quedan siempre al final, en las dos direcciones. Un tercer toque en el título vuelve al orden original.
- **Filtros:** cada filtro ofrece solo las opciones que existen con los demás filtros puestos, con cuántas filas hay de cada una ("Factura (812)"). Un filtro que tiene una sola opción (por ejemplo, Comprobante cuando no hay notas de crédito en la lista) no se muestra. Las opciones de Estado siguen el orden en que avanza una factura, y las de Fecha, el orden de los meses.

## [0.12.6] - 2026-11-04

### Cambiado
- **Celular:** las listas ya no se corren de costado. Cada fila es una tarjeta: arriba la factura y el botón (Subir, o el estado), abajo el resto de los datos con su nombre. Los filtros y el orden quedan en "Filtrar y ordenar". Vale para Mis facturas, Para resolver, Detalle de facturas y las listas de Auditoría. Las tablas con totales al pie (Saldos) siguen como tabla, con la compañía fija.
- **Mis facturas:** en la compu, la primera columna (la que queda fija) es la factura; los días van al lado.
- **Mis siniestros:** las facturas de cada siniestro bajan de renglón en el celular en vez de apretarse.
- **Resumen e Impacto:** en el celular, los importes del mes van uno debajo del otro, para que entren completos.
- "En revisión" usa el celeste también en el botón de la lista.

## [0.12.5] - 2026-11-04

### Cambiado
- **Gerencia · textos más formales:** "Auditoría solicita su apoyo con…" y "Se solicita su intervención para que la sucursal la regularice", en las notificaciones y en el mail de los lunes. Si en Ajustes se había guardado un texto propio, se sigue usando ese.
- **Sucursal · Notificaciones:** los rechazos llevan la etiqueta roja "Rechazo" y una franja roja en la bandeja, y tienen su propio filtro. Lo de documentación faltante lleva la etiqueta amarilla "Documentación".
- **Sucursal · Mis facturas:** "Informar una nota de crédito" pasa a blanco con borde azul (menos pesado).
- **Colores con el mismo significado en toda la aplicación** (anotados en los estilos): rojo = rechazado/atrasado, rojo oscuro = vencido o crítico y lo que resta, amarillo = falta documentación, celeste = en revisión, azul = acciones e información, violeta = al día, verde = aprobado/cobrado, gris = informativo. Cambios: en el Resumen, "Al día" es violeta y "Vencido" rojo oscuro, como en las etiquetas de las facturas; en Saldos, las notas de crédito en rojo con "−"; el contador de notificaciones en azul (no es un error); MiPyME es una pastilla oscura, porque es un dato de la factura y no un estado.

## [0.12.4] - 2026-11-04

### Cambiado
- **Notificaciones:** el asunto dice lo que pasó ("Observado", "Pasaron 10 días sin legajo completo") y la factura va aparte, en vez de repetir el número. A Gerencia le escribe "Auditoría · sucursal", y en los avisos agrupados cada factura muestra sus días de espera.
- **Sucursal:** el número de "Mis facturas" en el menú es el mismo que la tarjeta Para subir. Si la fecha estimada que avisaron ya pasó, se ve en rojo. La marca MiPyME es la misma (roja, con "!") en todas las pantallas. En Mis siniestros, lo que falta refacturar va primero.
- La carga de varios archivos ya no dice "PDF o fotos": solo PDF.

## [0.12.3] - 2026-11-04

### Cambiado
- **Notificaciones como un mail, para todos los sectores:** pantalla propia con la bandeja a la izquierda (remitente, asunto, cuándo; las no leídas en negrita) y el mensaje completo a la derecha, con la factura (o la lista de facturas en los avisos agrupados) y el botón para abrirla. Filtro Sin leer / Todas. En el celular, primero la bandeja y al tocar se abre el mensaje.
- **Sucursal:** "Para resolver" va debajo de "Mis facturas" en el menú. Se quitó el recuadro de mensajes sin leer de Para resolver (ya están en Notificaciones). La etiqueta MiPyME pasa a "! MiPyME · 5 días" en rojo.

## [0.12.2] - 2026-11-04

### Cambiado
- **Sucursal · Para resolver:** dos tarjetas separadas, "Rechazos y observaciones" (Auditoría o la compañía no aceptó un documento) y "Documentación por vencer o vencida", cada una con su cantidad y cuántas son MiPyME. La lista muestra un tema a la vez, con las MiPyME arriba de todo y después lo más atrasado; columna "Prioridad" con filtro MiPyME/Común y casilla "Ver solo las MiPyME". El motivo dice si el rechazo vino de la compañía o de Auditoría.
- **Sucursal · Mis facturas:** el plazo (10 días; 5 si es MiPyME) va en un recuadro "Importante" bien visible, con las marcas + ! … ✓ más grandes y en color. La lista aparece recién al tocar "Para subir" o "En revisión".
- **Sucursal · Para resolver:** la lista aparece recién al tocar una de las dos tarjetas.
- **Sucursal · Mis siniestros, rearmada:** primero el buscador (siniestro, patente o factura). Las compañías son desplegables, cerradas, con cuántos siniestros tienen, cuántos con documentación pendiente o por refacturar y el saldo sin cobrar. Cada siniestro es una fila que se abre para ver sus facturas, documentos y notas de crédito. Los filtros ahora son En curso / Terminados / Todos, y etiquetas explicadas ("Falta documentación", "Falta refacturar", "Con nota de crédito"). Al buscar se abre solo lo que coincide.
- **Sucursal · Fecha estimada:** "No lo puedo subir todavía" pasa a ser "Avisar fecha estimada de entrega", y el recuadro Importante explica qué pasa al avisarla.
- **Sucursal · Mis facturas:** los botones "Subir varios archivos de una vez" (azul) e "Informar una nota de crédito" (oscuro) van con fondo de color para que se distingan de las tarjetas.
- **Números de factura sin ceros a la izquierda** en toda la aplicación, los mails y los Excel: "FC E 35-11032" en lugar de "FC E 35-00011032". Los nombres de archivo con ceros se siguen aceptando.

## [0.12.1] - 2026-11-04

### Cambiado
- **Solo PDF:** los documentos tienen que ser PDF (las compañías no aceptan fotos ni otros formatos). Lo controlan la pantalla y el servidor.
- **El nombre del archivo se exige, no solo se pide:** tiene que tener el punto de venta y el número de la factura ("35-11032 orden.pdf"). En la carga de varios archivos, uno sin número o con un número que no es de una factura pendiente de la sucursal queda en rojo y no se sube. En el legajo, el archivo tiene que tener el número de esa factura. El legajo le muestra a la sucursal cómo tiene que llamarse.

## [0.12.0] - 2026-11-04

### Agregado
- **Auditoría · Presentar:** pantalla nueva con las facturas con documentación aprobada. Se eligen varias (o todas las filtradas), se arma el mail de presentación con la lista y se marcan como presentadas de una vez, con la fecha.
- **Auditoría · Reclamos en lote:** en Vencidas y reclamos se eligen varias, se arma el mail de reclamo (con vencimiento, días y número de reclamo) y se registra el reclamo en todas.
- **Auditoría · Revisión en serie:** en el legajo, "Siguiente para revisar" pasa a la próxima factura que espera revisión, de la más vieja a la más nueva.
- **Auditoría · Novedades del control diario:** botones para ver las facturas que entraron con la última carga del ERP y las que tuvieron cambios desde ayer.
- **Sucursal · Quitar un documento subido por error,** mientras Auditoría no lo revisó (queda registrado).
- **Gerencia · Imprimir o guardar en PDF** el Resumen, sin menú ni botones.
- **Sucursal · Para resolver:** pestaña nueva con lo observado, lo fuera de plazo y lo que vence en 2 días (con el motivo), y los mensajes de Auditoría sin leer, con cuántos días llevan. Mis facturas queda solo para subir documentación e informar notas de crédito.
- **Sucursal · Mis siniestros:** ordenados por compañía (con filtro), con "Te queda pendiente" en palabras (qué subir, qué reemplazar, qué refacturar) y filtros "Tengo algo para hacer" y "Anuladas o con nota de crédito". Si después se emitió otra factura del siniestro, lo anulado se da por refacturado.
- **Nota de crédito en el legajo:** dice qué hace (anula completa o acredita una parte de tal factura, con el saldo que queda) y el motivo que informó la sucursal.

### Corregido
- Abrir una factura da por leídas sus notificaciones: si se resolvió entrando por la tabla o el buscador, el aviso no queda colgado como pendiente.

## [0.11.0] - 2026-11-04

### Agregado (vista de la sucursal)
- **Dos documentos por factura: la factura y la orden firmada.** La firma del cliente ya no se pide aparte (va en la orden). Los datos que tenían la firma como documento separado se leen sin ella.
- **Subir varios archivos de una vez:** se sueltan todos los escaneos juntos y CobroSync sugiere a qué factura va cada uno (por número de factura, siniestro, patente o referencia que tenga el nombre) y qué documento es. Se revisa y se sube todo; cada factura sigue con su legajo.
- **Mis siniestros:** todas las facturas de cada siniestro con sus documentos (también los aprobados, con enlace para verlos), las notas de crédito y avisos de lo que puede quedar para refacturar (NC parcial, factura anulada sin la nueva).
- **Cada documento muestra quién lo subió y cuándo**, también en la carga de varios archivos. Si CobroSync lo asignó solo por el nombre, Auditoría lo ve marcado para revisar que corresponda; se observa igual que siempre ("No corresponde a esta factura").
- **Guía para nombrar los archivos** dentro de la carga (punto de venta y número, qué documento es, ejemplos).
- **Para resolver primero:** arriba de Mis facturas, las observadas, las que pasaron el plazo y las que vencen en 2 días, con las MiPyME primero.
- **Informar una nota de crédito** pasa a ser un botón grande, al lado de "Subir varios archivos".

### Cambiado
- A la sucursal ya no le llegan notificaciones por cada aprobación (se ve en la factura); sí las observaciones, los mensajes y los avisos de plazo.

## [0.10.1] - 2026-11-04

### Cambiado
- **Tablas a la vista:** más compactas (letra y márgenes más chicos, títulos en dos renglones) para que entren a lo ancho sin correr la barra. Botón **Columnas** para ocultar o mostrar las que se usan poco (se recuerda en cada computadora); Ref., Patente y Observaciones arrancan ocultas en el control diario. Si igual hay que correr de costado, la primera columna queda fija, y las filas se alternan en gris para no perderse. En el control diario, el siniestro va debajo de la compañía y los días debajo de cada fecha.
- **Notas de crédito con signo menos** en el Resumen (año y mes), para que no se confundan con importes a favor.
- **Pendiente de cobro hoy:** el total va pegado al título.
- **Resumen:** el recuadro del año pasa a un tono claro, como el resto. En el mes, las notas de crédito tienen su propio dato (antes estaban debajo de lo facturado). En meses que ya pasaron dice "faltó cobrar".
- **Impacto económico:** el cartel "En revisión" aparece cada vez que se entra a la pantalla.

## [0.10.0] - 2026-11-04

### Agregado
- **Plazos distintos para facturas MiPyME:** 10 días para la documentación de una factura común y 5 para una MiPyME; críticas a los 21 y 12 días. Una factura es MiPyME si va a una compañía que recibe factura de crédito y su total llega al monto mínimo vigente ($ 5.549.862), o si sale de un punto de venta marcado como MiPyME. La sucursal la ve marcada "MiPyME · 5 d".
- **Ajustes (Auditoría):** pantalla para cambiar los plazos, el monto mínimo, las compañías que reciben FCE, **los textos de las notificaciones a Gerencia** (con vista previa) y los avisos por mail (activarlos y los correos de Gerencia General). Con Google se guarda en la pestaña Config.

### Cambiado
- **Reclamos con espera de respuesta:** después de cada reclamo se espera 7 días (se cambia en Ajustes) en "Esperando respuesta". Si no responde, pasa a "Volver a reclamar"; con 3 reclamos sin respuesta, a "Sin respuesta" y se le pide apoyo a Gerencia.
- **Saldos por compañía:** tocando "N reclamos" se despliegan las fechas de cada reclamo, factura por factura, y se puede abrir cada legajo.
- **Resumen:** el pendiente de hoy aparece una sola vez, debajo del año y del mes, con una barra que muestra cuánto es sin presentar, al día y vencido.
- **Resumen:** el recuadro del año tiene el mismo formato que el del mes (títulos legibles, notas de crédito aparte, todo nivelado). Con una sucursal elegida, abajo se ven los datos de esa sucursal en lugar del ranking.

## [0.9.2] - 2026-11-04

### Cambiado
- **Todos los mails salen solo los lunes:** al gerente de cada sucursal, la lista de sus facturas atrasadas; a Gerencia General, un único mail con lo que quedó sin resolver (compañías sin respuesta a 3 reclamos y documentación crítica). Si no hay nada pendiente, no sale ningún mail. En la semana lo ven en las notificaciones de CobroSync.
- **Tarjetas del Resumen:** se pueden tocar y abren el Detalle de facturas con ese grupo (pendiente, sin presentar, al día o vencido), con todos los filtros de la tabla. Los importes se ajustan al ancho de la pantalla y ya no se salen de la tarjeta.
- **Ranking:** nueva columna con la tendencia de cada sucursal contra el mes anterior (días promedio hasta subir el legajo).

## [0.9.1] - 2026-11-04

### Cambiado (vistas de Gerencia)
- **Resumen:** el filtro de sucursal queda debajo del título y el mes se elige en el mismo cuadro del mes. El año va aparte, en un recuadro destacado a la izquierda. El gráfico compara los **cobros previstos** (por vencimiento) con lo **realmente cobrado**, semana por semana; se puede mirar también el mes que viene. Se sacó "informado por las compañías".
- **Saldos por compañía:** sin los totales que repetían el Resumen; filtro de sucursal debajo del título; nueva columna **Reclamos hechos** (cantidad, facturas reclamadas y último reclamo).
- **Impacto económico:** al entrar aparece un cartel "En revisión" que explica que el costo es una estimación.
- **Detalle de facturas** reemplaza a "Buscar una factura": la tabla completa, con el buscador.
- **Notificaciones de Gerencia** escritas como lo que hay que hacer: "Auditoría necesita tu apoyo con Sancor: no responde los reclamos de 2 facturas vencidas" o "Auditoría marcó como críticas 5 facturas de Alvarez Thomas…". Los pedidos de apoyo se agrupan por compañía.
- **Mail diario a Gerencia General** (solo si hay algo nuevo): un único mail con las compañías que no responden 3 reclamos y las sucursales con documentación crítica, sin listar factura por factura.
- El estado de reclamo "Escalar a gerencia" pasa a llamarse **"Sin respuesta"** (pedir apoyo a gerencia es una acción de Auditoría).
- La fecha del día ya no se repite en cada pantalla (queda una sola vez, en el menú). El filtro de sucursal está debajo del título en todas las pantallas.

## [0.9.0] - 2026-11-04

### Agregado
- **La planilla de control se sigue llenando sola, sin cambiarle la forma:** al cargar el ERP en CobroSync, las filas nuevas se agregan al final de la pestaña Quiter, tal cual. Cada hora se completan en Diario Drive, Presentación, Cobro y la X de Anula de las facturas del piloto (el Estado lo calcula la planilla) (buscadas por referencia). No borra datos, no pisa fórmulas, no mueve filas. También hay un botón para hacerlo en el momento.
- **Fecha de documentación aprobada:** se guarda el día en que Auditoría aprueba toda la documentación (es la que va a la columna Drive). Si después se observa algo, se vacía hasta la nueva aprobación. La fecha de subida pasa a ser la de la última subida.
- Al pasar la planilla, solo entran las sucursales de la prueba.
- **Notas de crédito parciales:** la sucursal avisa si la NC anula toda la factura o solo una parte (con el importe). La factura queda con su saldo pendiente.
- **Percepciones:** la carga del ERP guarda las percepciones de IIBB de cada factura. Una NC total se reconoce aunque no incluya las percepciones.
- **Vínculo automático NC → factura:** al cargar el ERP, cada NC se une con la factura avisada por la sucursal. Si no hubo aviso y hay una sola factura posible, también se vincula y queda marcada para revisar.
- **Varias facturas por siniestro:** el legajo muestra las otras facturas del mismo siniestro y permite usar la misma orden y firma en todas.
- **Cobros parciales:** al registrar un cobro se puede indicar un importe distinto del total.
- **Archivos Excel (.xlsx):** el ERP, la planilla y la pestaña CP se cargan directamente, sin pasar a CSV.
- **Varias páginas por documento** y fotos del celular reducidas automáticamente antes de subirlas.
- Auditoría ve un aviso con las notas de crédito informadas por las sucursales.

### Corregido
- Una sucursal no puede marcar como aprobados sus propios documentos (lo controla el servidor).
- Al aprobar un documento de varias páginas se conservan todas las páginas.
- Un cambio rechazado por el servidor ya no frena el resto de los cambios pendientes.
- Si se corta la conexión, los cambios se reintentan solos y la página avisa antes de cerrarse con cambios sin guardar.
- La fecha del día se toma del servidor (hora de Buenos Aires).
- No se envían avisos de facturas con un compromiso de entrega vigente.
- Las compañías cargadas desde la pestaña CP se guardan en Google.

## [0.8.0] - 2026-11-04

### Agregado
- **Actualización automática (con Google):** cada minuto y al volver a la pestaña, la aplicación trae los cambios de los demás y avisa con una notificación, sin recargar.
- **Trabajo simultáneo sin pisarse:** cada cambio (campos, documento, mensaje) se guarda por separado sobre lo que hay en ese momento. El servidor firma cada mensaje con la cuenta de quien lo escribió.
- **Notificaciones leídas en la cuenta:** valen en cualquier computadora o celular (pestaña Lecturas).

## [0.7.2] - 2026-11-04

### Agregado
- **Registrar cobro** desde el legajo (Auditoría), con la fecha de cobro.
- **Prueba del servidor de Google** (`npm run test:apps-script`): recorre un día completo con planilla, Drive y mails simulados. Corre en cada cambio.
- Guía de instalación: qué revisar el primer día y qué hacer si algo falla.

### Corregido
- Pasar la planilla a CobroSync se puede repetir: agrega las nuevas y completa presentación y cobro de las que ya están, sin duplicar (antes dependía del número de fila).
- Las compañías que llegan de la planilla toman razón social, CUIT y plazo de la pestaña CP, así la carga del ERP las reconoce.
- Una factura repetida dentro de la misma carga del ERP ya no se duplica.
- Los nombres de sucursal se comparan sin importar mayúsculas, tildes ni espacios.

## [0.7.1] - 2026-11-04

### Agregado
- **Pantalla de inicio.** En la demo se elige con qué usuario de ejemplo entrar (Gerencia, Auditoría o una sucursal) y se puede volver con "Cambiar de usuario". Con Google, la persona entra directo con su cuenta: se ve una pantalla de bienvenida mientras carga, o un aviso claro si su cuenta no tiene acceso.

## [0.7.0] - 2026-11-04

### Agregado
- **Preparado para la prueba piloto con Google** (`google/`): la aplicación puede publicarse en Google Apps Script con las cuentas de la empresa. Los datos quedan en una planilla de Google y los documentos, en el Drive de la empresa. Cada persona entra con su cuenta y su rol sale de la pestaña Usuarios. Incluye los avisos por mail (día 8 al gerente de la sucursal, día 22 a Gerencia General) y un resumen semanal los lunes.
- **Pasar la planilla a CobroSync:** con Google, "Usar mi planilla" agrega las facturas actuales sin duplicarlas.
- **Paquete para Google:** GitHub lo genera en cada actualización (Actions → `cobrosync-google`). Instalación en `google/LEEME.md`.

### Cambiado
- **Notificaciones de Gerencia agrupadas:** un aviso por sucursal ("Alvarez Thomas: 15 facturas pasaron a documentación crítica"), que abre la lista filtrada.
- **Mis facturas:** "Qué hay que hacer" muestra tres etiquetas (Factura · Orden · Firma) según lo que falta, lo observado y lo aprobado.
- **Textos más formales:** "importe retenido" en lugar de "plata retenida".

## [0.6.1] - 2026-11-03

### Agregado
- **Notificaciones para Gerencia:** solo los escalamientos (documentación crítica y facturas con 3 reclamos sin respuesta).

### Corregido
- Al pasar de la vista de Sucursal a Auditoría o Gerencia, el filtro de sucursal vuelve a "Todas".
- En pantallas angostas, el botón de "Mis facturas" dice "Subir" para que no quede cortado.
- "Buscar una factura" (Gerencia) busca en todos los meses y sin el filtro de sucursal de arriba (ya está en la columna).
- Si una búsqueda no encuentra nada con los filtros puestos, la tabla avisa cuántos resultados hay en otros meses o filtros y ofrece "Buscar en todo".

## [0.6.0] - 2026-11-03

### Cambiado
- **Una vista distinta por rol.** Gerencia entra a un Resumen simple (más Ranking, Saldos, Impacto y "Buscar una factura", solo para consultar). Auditoría entra a **Avisos**, con todo el detalle. Cada sucursal entra a **Mis facturas**, una pantalla guiada: qué subir, qué corregir y qué está en revisión.
- **Avisos** reemplaza a Alertas: tarjetas grandes por sector (Sucursales, Auditoría, Compañías) que abren la tabla correspondiente ya filtrada.
- **Resumen** reúne el informe del mes, el del año y los cobros esperados por semana (antes en "Cobros previstos"). Se sacaron los datos repetidos del Inicio.
- **Todas las tablas:** filtros sobre el nombre de cada columna, encabezado fijo al bajar, orden ascendente o descendente tocando el título, lupa para buscar una factura y exportar lo filtrado.
- **Montos con centavos** en todas las tablas.
- **Pendientes de sucursales:** las tarjetas filtran la tabla (se arregló "Compromisos vencidos"); "Todos los niveles" pasó a llamarse "Estado".
- **Control diario:** "En Drive" pasó a "Subida" (fecha en que se subió a la plataforma); siniestro y patente en columnas separadas; columna "Aviso de NC"; se sacó "Subir escaneo".
- **Observaciones** editables desde el legajo (Auditoría).
- **Ranking:** se puede elegir cualquier mes del año.
- **Impacto:** aviso de que la estimación está en revisión con Contabilidad; lo retenido es real y el costo de la demora, estimado.
- **Saldos:** filtros en las columnas y sin el "paga a X días".

### Agregado
- **Notificaciones** (campana) para Sucursal y Auditoría con los movimientos del otro lado.
- **Compañías:** razón social, CUIT, plazo de pago y correos. En la demo los correos son inventados; los reales se ven al cargar la pestaña CP o Info. Compañías (solo en el navegador).
- **Cargar Excel del ERP** (vista previa): lee la exportación de facturas en CSV y agrega las nuevas en Doc. pendiente. No se guarda.

### Quitado
- Pantallas Alertas, Cobros previstos y el Inicio anterior.

## [0.5.1] - 2026-11-03

### Cambiado
- Escalamiento de reclamos: se escala a gerencia cuando la compañía no respondió a 3 reclamos, sin importar los días de vencida.

## [0.5.0] - 2026-11-03

### Cambiado
- **Estados con el vocabulario de la planilla:** Doc. pendiente, Doc. atrasada, Doc. observada, En revisión, Pres. pendiente, Al día, Vencida y Cobrado, cada uno con su color y a quién le toca.
- **Documentación en tres puntos para tildar:** factura, orden de reparación o repuestos y firma del cliente. La sucursal sube (también un PDF con todo) y Auditoría aprueba o observa cada punto con un motivo; con los tres aprobados queda para presentar.
- **Inicio detallado:** informe del mes (indica si está en curso) e informe general del año con montos completos, cobrado del mes separado en facturas del mes y de meses anteriores, tabla de facturas abiertas por estado y semanas solo hasta hoy.
- **Ranking de sucursales** ordenado por plata retenida, con la documentación pendiente en plazo, atrasada y crítica; los promedios con pocas facturas se marcan como poco representativos.
- **Filtros dentro de cada pantalla**, solo donde se usan. "Ver como" pasó a la barra izquierda.
- **Control diario** con las columnas de la hoja Diario.
- **Saldos** separados en sin presentar, al día y vencido, con el estado de los reclamos.

### Agregado
- **Vencidas y reclamos:** registro de reclamos a las compañías (fecha, medio, nota) y alerta para escalar a gerencia cuando no responden. Lectura opcional de las columnas S, T y U de la planilla.

## [0.4.0] - 2026-11-03

### Agregado
- **Usar mi planilla**: se carga la hoja Diario exportada como CSV y toda la app (pendientes, alertas, ranking, impacto, saldos, control diario) pasa a mostrar los datos reales.
  - Se procesa solo en el navegador: el archivo no se sube ni se guarda; al recargar vuelve la demo.
  - Traduce los estados de la planilla: Cobrado, Al día / Vencida (esperando pago), P. Pend. (para presentar), D. Pend. (pendiente de la sucursal), Anulada y NC.
  - Aviso en la barra superior mientras se usan datos reales, con opción de volver a la demo.
- Tests de lectura de la planilla con filas de ejemplo.

## [0.3.0] - 2026-11-03

### Cambiado
- Datos de ejemplo más reales: sucursales (Alvarez Thomas, Rocamora, San Miguel, Triunvirato, Vicente Lopez, Warnes) con sus puntos de venta, y compañías de seguro reales con su plazo de pago (30 días; Federación Patronal 7).
- El volumen por mes, el pico de fin de mes, el peso de cada compañía, las demoras de cada sucursal y la distribución de montos salen de estadísticas de la planilla. Fechas, montos, números y siniestros son inventados, con el formato real de cada compañía.
- Formato de comprobante como en la planilla: `FC E 35-00004570`.
- Personas genéricas por sucursal ("Facturación Rocamora 1", "Gerente de Rocamora").
- Facturas sin presentar calibradas con la planilla (filas en lila): unas 360 a la fecha, la mayoría del último mes y algunas de hace meses que nunca se subieron, sobre todo de Alvarez Thomas.

## [0.2.0] - 2026-11-03

### Agregado
- **Pendientes de sucursales** (y "Mis pendientes" para el rol Sucursal): días de espera, nivel (en plazo, atrasado, crítico), qué falta, compromiso y a quién se avisó.
- Regla de plazo: 7 días para subir el legajo; aviso al gerente de sucursal desde el día 8 y a la gerencia general desde el día 22.
- En el legajo: subir cada documento a su factura, "no lo puedo subir todavía" con motivo y fecha, registrar rechazos y **conversación** entre sucursal y auditoría.
- **Informar nota de crédito** desde la sucursal, vinculada a la factura que anula.
- **Alertas**: escaneos críticos, compromisos vencidos, rechazos sin respuesta, NC sin aviso, legajos listos para presentar y vencidos sin cobrar.
- **Ranking de sucursales** e **Impacto económico** (tasa y objetivo ajustables).
- **Exportar a Excel** en Pendientes, Control diario, Ranking, Impacto, Saldos y Cobros previstos.

### Cambiado
- Etapas con colores propios: el amarillo se divide en "esperando sucursal" (amarillo), "para presentar" (azul) y "esperando pago" (violeta).
- Roles: Sucursal, Auditoría y Gerencia. Menú en dos secciones: Operación e Informes.
- La demo abre directo en la app; la presentación del producto pasó a `#/presentacion`.
- Datos de demo: 6 sucursales con ritmos de escaneo distintos, plazos de pago de 30 y 7 días, picos de facturación a fin de mes, eventos y compromisos.

## [0.1.1] - 2026-11-03

### Corregido
- Los montos abreviados ($ 9,2 M) ya no se cortan en dos líneas.
- Tarjetas semanales de Cobros previstos más legibles en pantallas medianas.
- Las observaciones de los legajos que la sucursal no subió ahora dicen que se reclamó el legajo.

## [0.1.0] - 2026-11-03

### Agregado
- Base del proyecto con React 19, Vite, TypeScript y Tailwind CSS 4.
- Workflow de GitHub Actions: tests y build en cada PR, publicación en GitHub Pages al mergear a `main`.
- Modelo de datos (comprobantes, documentos del legajo, aseguradoras, cobros previstos) y DER.
- Generador de datos ficticios reproducibles (`npm run datos:demo`).
- Reglas del semáforo operativo y cálculos de saldos, vencidos, DSO y proyección semanal, con tests en Vitest.
- Landing page, Dashboard general, Control diario con panel de legajo, Saldos por compañía y Cobros previstos.
- Selector de rol (Taller, Administración, Gerencia) que cambia el menú y las acciones disponibles.
- `.gitignore` que bloquea planillas, CSV y PDF para evitar subir datos reales.
