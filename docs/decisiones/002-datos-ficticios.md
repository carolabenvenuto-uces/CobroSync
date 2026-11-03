# 002 · Datos de ejemplo: nombres reales, valores inventados

**Fecha:** 2026-11-03 · **Estado:** aceptada (actualizada)

## Contexto

- GitHub Pages en el plan gratuito exige que el repositorio sea **público**, y el sitio publicado es público siempre.
- El repo generado por Lovable (`cobrosync-insights`) contiene filas reales de la planilla de control en `src/data/`. Aunque se borraran, quedarían en el historial de git. Por eso ese repo queda **privado** como referencia y este proyecto empieza con un historial limpio.
- Una primera versión usó compañías y sucursales inventadas, pero la demo "parecía una fantasía" y costaba reconocer el proceso real.

## Decisión

| Dato | En la demo |
|---|---|
| Sucursales (Alvarez Thomas, Rocamora, San Miguel, Triunvirato, Vicente Lopez, Warnes) y sus puntos de venta | **Reales**: son localidades y no exponen información sensible |
| Compañías de seguro y su plazo de pago (30 días; Federación Patronal 7) | **Reales**, de la pestaña CP |
| Volumen por mes, pico de fin de mes, peso de cada compañía, demoras de cada sucursal, distribución de montos | **Estadísticas** calculadas sobre la planilla (no se copió ninguna fila) |
| Fechas, montos, números de comprobante, referencias, siniestros y patentes | **Inventados** al azar, con el formato real de cada compañía |
| Personas | **Genéricas** ("Facturación Rocamora 1", "Gerente de Rocamora"); no se usan nombres de empleados de sucursales |
| Correos de las compañías | Dominio reservado `.example`, que no existe |

- El generador (`scripts/generar-datos-demo.mjs`) usa una semilla fija: los datos son siempre los mismos y los tests son reproducibles.
- El `.gitignore` bloquea `*.xlsx`, `*.csv`, `*.pdf` y la carpeta `datos-reales/`.

## Cuidado

Como las proporciones salen de la planilla, el ranking de sucursales de la demo se parece al real. Si no se quiere mostrar públicamente, se pueden alterar los parámetros de demora de cada sucursal en el generador.
