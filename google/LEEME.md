# CobroSync en Google · Instalación para la prueba piloto

Esta guía es para quien instale CobroSync con las cuentas de la empresa (Sistemas o Auditoría).
No hace falta instalar ningún programa: todo se hace desde el navegador.

## Cómo funciona

| Parte | Dónde queda |
|---|---|
| La aplicación | Una "aplicación web" de Google Apps Script, solo para cuentas de la empresa |
| Los datos (facturas, estados, conversación, reclamos) | Una planilla de Google de la cuenta del sector |
| Los PDF y las fotos de cada factura | Una carpeta de una unidad compartida de Drive |
| Los avisos por mail | Se envían desde la cuenta del sector |

- La aplicación funciona con la cuenta del sector (la dueña de la planilla). Las sucursales **no** necesitan acceso a la planilla ni a la carpeta de Drive.
- Cada persona entra con su cuenta de la empresa. Su rol sale de la pestaña **Usuarios**.
- Una sucursal solo ve y modifica sus facturas, y solo puede cambiar los documentos, el aviso de demora, la conversación y el aviso de notas de crédito.
- Gerencia solo consulta.

## Antes de empezar

1. Una cuenta del sector (por ejemplo, la casilla de Auditoría). Desde esa cuenta se crea todo lo que sigue.
2. Una carpeta dentro de una unidad compartida de Drive para los documentos. Hay que copiar su id: es la parte final del link de la carpeta (`https://drive.google.com/drive/folders/ESTE-ES-EL-ID`).
3. El paquete con los archivos: en GitHub, pestaña **Actions** → la última ejecución de "Build y deploy" → **Artifacts** → `cobrosync-google`. Trae `Index.html`, `Codigo.gs`, `appsscript.json` y este `LEEME.md`.

## Instalación (una sola vez)

1. Con la cuenta del sector, crear una planilla de Google nueva llamada **CobroSync · Datos**.
2. En la planilla: **Extensiones → Apps Script**.
3. En el editor de Apps Script:
   - Reemplazar el contenido de `Código.gs` por el de **Codigo.gs**.
   - **Archivo nuevo → HTML**, con el nombre `Index`, y pegar el contenido de **Index.html**.
   - **Configuración del proyecto** → tildar "Mostrar el archivo de manifiesto appsscript.json" → reemplazar su contenido por el de **appsscript.json**.
4. Elegir la función `configurarPlanilla` y tocar **Ejecutar**. Google pide permisos la primera vez: aceptarlos con la cuenta del sector. Se crean las pestañas.
5. Completar la planilla:
   - **Config:** el id de la carpeta de Drive, los correos de Gerencia General y el dominio (ya viene `svaauto.com.ar`). Los plazos (10 días, 5 si es MiPyME; críticas a los 21 y 12), el monto mínimo MiPyME y los avisos por mail se cambian después desde la aplicación, en **Ajustes** (Auditoría).
   - **Config → planillaControlId:** el id de la planilla de control de Auditoría (el texto largo del link, entre `/d/` y `/edit`). La cuenta del sector tiene que poder editarla. Con esto, al cargar el ERP en CobroSync las filas nuevas se agregan al final de la pestaña **Quiter** (tal cual, de todas las sucursales), y cada hora se completan en **Diario** las columnas Drive (I), Presentación (K), Cobro (N) y la X de Anula (P) de las facturas del piloto. El Estado (O) lo sigue calculando la planilla. No se borra nada, no se pisan fórmulas y no se mueven filas. Si las pestañas tienen otro nombre, cambiarlo en **pestanaQuiter** y **pestanaDiario**.
   - **Sucursales:** cargar **solo las sucursales de la prueba**. Las facturas de las demás no se pasan a CobroSync y siguen en la planilla.
   - **Usuarios:** una fila por persona, con email, nombre, rol (`Gerencia`, `Auditoría` o `Sucursal`) y sucursal (solo para el rol Sucursal, con el mismo nombre que en la pestaña Sucursales).
   - **Sucursales:** nombre, puntos de venta separados por coma (por ejemplo `21, 30`), nombre del gerente y su correo. **El nombre tiene que ser el mismo que aparece en la columna Sucursal de la planilla de control** (no importan mayúsculas ni espacios).
   - **Aseguradoras:** se completa sola al pasar la planilla de control (paso 8), con razón social, CUIT y plazo de la pestaña CP. Después se pueden agregar los correos.
6. **Implementar → Nueva implementación → Aplicación web**:
   - Ejecutar como: **Yo** (la cuenta del sector).
   - Quién tiene acceso: **Cualquier persona de** la empresa.
   - Copiar el link de la aplicación y pegarlo en **Config → urlAplicacion**.
7. Elegir la función `instalarDisparadores` y tocar **Ejecutar**. Programa los avisos diarios y el resumen de los lunes (a las 8) y la copia a la planilla de control (cada hora).
8. Abrir la aplicación con una cuenta de Auditoría → **Usar mi planilla** → cargar la planilla en Excel (.xlsx) o la hoja Diario en CSV → **Guardar en CobroSync**. Así se pasan las facturas actuales. Se puede repetir durante la prueba: agrega las facturas nuevas y, en las que ya están, completa presentación y cobro. No duplica ni borra nada.
9. Cuando todo esté bien, poner **Config → avisosPorMail** en `SI`. Desde ese momento salen los mails. Qué mails salen: **solo los lunes a las 8**. Al gerente de cada sucursal, la lista de sus facturas que pasaron el plazo sin documentación (10 días; 5 si es MiPyME) (sin las que tienen una fecha comprometida vigente). A Gerencia General, un solo mail con lo que quedó sin resolver: compañías que no respondieron 3 reclamos y documentación crítica (más de 21 días; 12 si es MiPyME). **Si no hay nada pendiente, no sale ningún mail.** Durante la semana, todos lo ven en las notificaciones de CobroSync.

## Actualizar a una versión nueva

1. Descargar el paquete nuevo desde GitHub (paso 3 de "Antes de empezar").
2. Reemplazar `Index.html` y `Codigo.gs` en el editor. Ejecutar `configurarPlanilla` (agrega las columnas y opciones nuevas sin tocar los datos) e `instalarDisparadores`.
3. **Implementar → Administrar implementaciones → editar (lápiz) → Versión: nueva → Implementar.** El link no cambia.

Los datos de la planilla no se tocan al actualizar.

## Primer día de la prueba: qué revisar

1. Entrar con una cuenta de cada rol (Gerencia, Auditoría y una de cada sucursal de la prueba) y verificar que cada una ve lo suyo.
2. Desde una sucursal, subir un PDF y una foto desde el celular. Verificar que aparezcan en la carpeta de Drive.
3. Desde Auditoría, aprobar ese documento, presentar la factura y registrar un cobro de prueba.
4. Medir cuánto tarda en abrir la aplicación con Auditoría (es la que más datos carga). Si tarda más de 15 segundos, avisar: se puede hacer que cargue primero las facturas abiertas.
5. **Antes de empezar, hacer una copia de la planilla de control** (Archivo → Hacer una copia). Cargar el ERP del día en CobroSync y verificar que las filas aparezcan al final de Quiter y que Diario las tome. Después, en **Usar mi planilla → Actualizar mi planilla ahora**, verificar que se completen Drive, Presentación y Cobro de una factura del piloto.
6. Con **avisosPorMail** en `SI`, ejecutar `resumenSemanal` a mano desde el editor y revisar que el gerente reciba el mail.

## Si algo no funciona

| Qué pasa | Qué hacer |
|---|---|
| "Tu cuenta no tiene acceso" | Agregar el correo en la pestaña Usuarios (tal cual, con @svaauto.com.ar). |
| "Ingresá con tu cuenta de la empresa" | La persona entró con una cuenta personal: cerrar sesión en Google y entrar con la de la empresa. |
| Una sucursal no ve ninguna factura | El nombre de su sucursal en Usuarios no coincide con el de la planilla. Corregirlo. |
| "Falta la pestaña…" | Ejecutar `configurarPlanilla` desde el editor. |
| No se pueden subir archivos | Revisar que **Config → carpetaDriveId** tenga el id correcto y que la cuenta del sector sea administradora de la unidad compartida. |
| No llegan los mails | Revisar **Config → avisosPorMail** (`SI`) y que los correos de los gerentes estén en Sucursales. En el editor: **Activadores** tiene que mostrar `avisosDiarios` y `resumenSemanal`. |
| Cualquier otro error | En el editor de Apps Script: **Ejecuciones** muestra cada error con su mensaje. Copiarlo y pasárselo a quien mantiene CobroSync. |

Mientras dure la prueba, la planilla de control sigue funcionando como siempre. Si algo falla, no se pierde nada: se sigue trabajando con la planilla y CobroSync se corrige.

## Preguntas frecuentes

**¿Qué pasa si dos personas trabajan a la vez?** Cada cambio se guarda por separado sobre lo que hay en ese momento, así que no se pisan (por ejemplo, la sucursal sube la orden mientras Auditoría escribe una observación: quedan las dos cosas). Cada pantalla trae sola los cambios de los demás cada minuto y al volver a la pestaña.

**¿Quién ve la planilla?** Solo la cuenta del sector y quien ella comparta. Para trabajar, nadie más la necesita.

**¿Qué pasa si alguien que no está en Usuarios abre el link?** Ve un mensaje: "Tu cuenta no tiene acceso. Pedíselo a Auditoría."

**¿Se puede seguir usando la planilla de control?** Sí. Durante la prueba se usa en paralelo, y las facturas nuevas se pueden cargar desde la exportación del ERP (Control diario → Cargar Excel del ERP).

**¿Hay respaldo de los datos?** Sí. La planilla guarda su historial de versiones (Archivo → Historial de versiones) y los archivos borrados de Drive quedan 30 días en la papelera.

**Límites de Google.** Con cuentas de Google Workspace, Apps Script permite enviar unos 1.500 mails por día y archivos de hasta 50 MB. Para el volumen de la prueba sobra.
