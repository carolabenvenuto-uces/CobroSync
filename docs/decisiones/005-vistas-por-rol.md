# 005 · Una vista distinta por rol

**Fecha:** 2026-11-03

## Contexto

Las tres áreas veían casi lo mismo. Gerencia no necesita el detalle diario; las sucursales
necesitan saber qué hacer sin interpretar tablas; Auditoría necesita todo.

## Decisión

- **Gerencia:** Resumen, Ranking, Saldos, Impacto y "Buscar una factura" (solo consulta).
- **Auditoría:** inicio en **Avisos**, tarjetas por sector que abren la tabla ya filtrada
  (el filtro viaja en la dirección: `/app/pendientes?estado=Crítica`). Todas las tablas usan
  el mismo componente (`components/ui/Tabla.tsx`) con filtros por columna, orden y búsqueda.
- **Sucursal:** inicio en **Mis facturas**, con tres grupos (subir, corregir, en revisión) y un
  botón por factura.
- **Notificaciones** entre Sucursal y Auditoría. En la demo viven en el navegador; para que
  lleguen de verdad a otra persona hace falta la etapa 2 (base compartida con Google).
- **Compañías:** razón social, CUIT y plazo reales (datos públicos de la pestaña CP); correos
  inventados en la demo. Los reales se cargan desde la planilla, solo en el navegador.
- **Excel del ERP:** se lee en el navegador para mostrar cómo funcionaría; no se guarda hasta
  tener el permiso de Google.

## Consecuencias

- Menos pantallas por persona y sin datos repetidos.
- Lo que hoy es "en memoria" (notificaciones, cargas, aprobaciones) se pierde al recargar.
  Es esperable en el prototipo y es lo que resuelve la etapa 2.
