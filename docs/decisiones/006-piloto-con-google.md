# 006 · Prueba piloto con Google Apps Script

**Fecha:** 2026-11-04

## Contexto

La empresa ya usa Google Workspace (cuentas @svaauto.com.ar). Para la prueba piloto hace falta
guardar los datos, identificar a cada persona y mandar avisos, sin costo de licencias y sin
instalar programas.

## Decisión

- La aplicación se publica como **aplicación web de Apps Script**, accesible solo para el dominio.
- Se ejecuta con la **cuenta del sector**: las sucursales no necesitan acceso a la planilla ni a Drive.
  El rol de cada persona sale de la pestaña Usuarios, según su correo (`Session.getActiveUser`).
- **Base de datos:** una planilla de Google. Una fila por factura; documentos, conversación y reclamos
  en columnas JSON. Alcanza para el volumen de la prueba (algunos miles de facturas por año).
- **Documentos:** Drive, en una carpeta por sucursal → mes → factura.
- **El mismo código** sirve para la demo y para Google: `services/google.ts` detecta si existe
  `google.script.run`. Sin eso, todo funciona en memoria como en la demo.
- El paquete para Apps Script (un solo HTML) lo genera GitHub Actions; nadie tiene que compilar nada.

## Consecuencias

- Las reglas de permisos se validan en el servidor (Codigo.gs), no solo en la pantalla.
- Si el volumen crece mucho, la planilla puede quedar lenta: el paso siguiente sería una base de datos
  real, sin cambiar las pantallas.
