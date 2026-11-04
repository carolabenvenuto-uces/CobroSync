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
   - **Config:** el id de la carpeta de Drive, los correos de Gerencia General y el dominio (ya viene `svaauto.com.ar`).
   - **Usuarios:** una fila por persona, con email, nombre, rol (`Gerencia`, `Auditoría` o `Sucursal`) y sucursal (solo para el rol Sucursal, con el mismo nombre que en la pestaña Sucursales).
   - **Sucursales:** nombre, puntos de venta separados por coma (por ejemplo `21, 30`), nombre del gerente y su correo.
   - **Aseguradoras:** se completa sola al pasar la planilla de control (paso 8). Después se pueden agregar CUIT, razón social y correos.
6. **Implementar → Nueva implementación → Aplicación web**:
   - Ejecutar como: **Yo** (la cuenta del sector).
   - Quién tiene acceso: **Cualquier persona de** la empresa.
   - Copiar el link de la aplicación y pegarlo en **Config → urlAplicacion**.
7. Elegir la función `instalarDisparadores` y tocar **Ejecutar**. Programa los avisos diarios y el resumen de los lunes, a las 8.
8. Abrir la aplicación con una cuenta de Auditoría → **Usar mi planilla** → cargar la hoja Diario en CSV → **Guardar en CobroSync**. Así se pasan las facturas actuales. Se puede repetir: las facturas que ya están no se duplican.
9. Cuando todo esté bien, poner **Config → avisosPorMail** en `SI`. Desde ese momento salen los mails.

## Actualizar a una versión nueva

1. Descargar el paquete nuevo desde GitHub (paso 3 de "Antes de empezar").
2. Reemplazar `Index.html` y `Codigo.gs` en el editor.
3. **Implementar → Administrar implementaciones → editar (lápiz) → Versión: nueva → Implementar.** El link no cambia.

Los datos de la planilla no se tocan al actualizar.

## Preguntas frecuentes

**¿Quién ve la planilla?** Solo la cuenta del sector y quien ella comparta. Para trabajar, nadie más la necesita.

**¿Qué pasa si alguien que no está en Usuarios abre el link?** Ve un mensaje: "Tu cuenta no tiene acceso. Pedíselo a Auditoría."

**¿Se puede seguir usando la planilla de control?** Sí. Durante la prueba se usa en paralelo, y las facturas nuevas se pueden cargar desde la exportación del ERP (Control diario → Cargar Excel del ERP).

**Límites de Google.** Con cuentas de Google Workspace, Apps Script permite enviar unos 1.500 mails por día y archivos de hasta 50 MB. Para el volumen de la prueba sobra.
