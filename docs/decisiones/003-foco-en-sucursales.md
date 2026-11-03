# 003 · Foco en la comunicación con las sucursales

**Fecha:** 2026-11-03 · **Estado:** aceptada

## Contexto

- La planilla de control actual funciona y la gerencia está conforme con sus informes.
- El problema que genera discusiones es otro: **las sucursales tardan en escanear** las facturas con sus órdenes firmadas, con excusas difíciles de verificar ("el Drive no anda", "ya lo subí", "el auto sigue en el taller"); los archivos quedan sueltos y mal nombrados, las **notas de crédito no se informan** y los rechazos se pierden en el mail.

## Decisión

CobroSync no busca reemplazar la planilla de golpe, sino ser **el lugar único donde sucursales, auditoría y gerencia se comunican sobre cada factura**.

1. **Plazo de escaneo de 7 días** desde la factura. Del día 8 al 21 se avisa al gerente de la sucursal; desde el día 22, también a la gerencia general (`src/domain/semaforo.ts` y `src/domain/sucursales.ts`).
2. **Cada documento se sube a su factura**, no a una carpeta: no se tipea siniestro ni compañía, y queda registrado quién lo subió y cuándo.
3. **"No lo puedo subir todavía"** con motivo y fecha comprometida; si la fecha pasa, aparece una alerta.
4. **Conversación por legajo**: rechazos, pedidos y respuestas quedan en el mismo lugar.
5. **Notas de crédito informadas** por la sucursal, vinculadas a la factura que anulan.
6. **Informes para gerencia**: ranking de sucursales e impacto económico de las demoras, exportables a Excel.

## Colores por etapa

El amarillo mezclaba responsabilidades. Se separó en etapas con colores propios:

| Etapa | Color | Le toca a |
|---|---|---|
| Bloqueado | Rojo | Sucursal |
| Esperando sucursal | Amarillo | Sucursal |
| Para presentar | Azul | Auditoría |
| Esperando pago | Violeta | Compañía |
| Cobrado | Verde | — |

## Fuera de alcance

La presentación a cada compañía (mail o portal) sigue siendo manual: cada una tiene reglas distintas y ese criterio es parte del trabajo del sector.

## Exportación a Excel

Se exporta en CSV con punto y coma, coma decimal y BOM, que Excel abre con doble clic. No requiere dependencias. Si más adelante hace falta formato (colores, varias hojas), se puede generar `.xlsx` real.
