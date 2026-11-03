# Changelog

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
