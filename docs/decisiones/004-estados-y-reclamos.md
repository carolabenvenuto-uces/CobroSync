# 004 · Estados de la planilla, revisión manual y reclamos

**Fecha:** 2026-11-03 · **Estado:** aceptada

## Contexto

Al revisar la demo con la operación real surgió que:
- los nombres inventados ("Bloqueado", "Esperando sucursal") no se entendían; el sector ya usa D. Pend., P. Pend., Al día, Vencida y Cobrado;
- separar orden, remito y conformidad era redundante: lo que se controla es **factura, orden (de reparación o repuestos) y firma del cliente**;
- no habrá OCR por ahora: la revisión la hace Auditoría;
- faltaba el seguimiento de las vencidas: si se reclamaron, cuántas veces y cuándo escalar.

## Decisión

| Estado | Equivale en la planilla | Le toca a |
|---|---|---|
| Doc. pendiente | D. Pend. (hasta 7 días) | Sucursal |
| Doc. atrasada | D. Pend. (más de 7 días) | Sucursal |
| Doc. observada | — (nuevo) | Sucursal |
| En revisión | — (nuevo) | Auditoría |
| Pres. pendiente | P. Pend. | Auditoría |
| Al día | Al día | Compañía |
| Vencida | Vencida | Compañía (reclamo de Auditoría) |
| Cobrado | Cobrado | — |

- Documentación: la sucursal sube los tres puntos (o un PDF con todo); Auditoría **aprueba** (tilda) u **observa** cada uno con un motivo. Con los tres aprobados, la factura pasa a Pres. pendiente.
- Reclamos: cada uno registra fecha, medio (mail, portal, teléfono) y nota. Se escala a gerencia cuando la compañía no respondió a 3 reclamos, sin importar los días de vencida (`src/domain/reclamos.ts`).
- Planilla: columnas opcionales S "Reclamado", T "Cant. reclamos" y U "Fecha último reclamo".
- Los filtros se muestran solo en las pantallas que los usan y los montos van completos, como en la planilla.
