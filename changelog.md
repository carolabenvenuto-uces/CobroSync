# Changelog

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
