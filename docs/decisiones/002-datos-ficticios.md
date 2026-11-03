# 002 · Solo datos ficticios en el repositorio

**Fecha:** 2026-11-03 · **Estado:** aceptada

## Contexto

- GitHub Pages en el plan gratuito exige que el repositorio sea **público**, y el sitio publicado es público siempre.
- El repo generado por Lovable (`cobrosync-insights`) contiene datos reales de la planilla de control en `src/data/`. Aunque se borraran, quedarían en el historial de git. Por eso ese repo queda **privado** como referencia y este proyecto empieza con un historial limpio.

## Decisión

1. Los datos de demo se generan con `scripts/generar-datos-demo.mjs`:
   - compañías con nombres inventados (árboles autóctonos: Ceibo, Quebracho, Lapacho…);
   - sucursales genéricas (Casa Central, Norte, Oeste, Sur);
   - patentes, siniestros, referencias y montos aleatorios;
   - correos con el dominio reservado `.example`, que no existe.
2. El generador usa una semilla fija: los datos son siempre los mismos, así los tests son reproducibles.
3. El `.gitignore` bloquea `*.xlsx`, `*.csv`, `*.pdf` y la carpeta `datos-reales/`.
4. Un test verifica que los correos de las compañías sean ficticios.

## Cómo se relacionan con la planilla real

El generador reproduce la **estructura** y el **comportamiento** de la planilla (demoras en subir al Drive, documentos con problemas, plazos de pago por compañía, anulaciones con nota de crédito), no sus valores.
