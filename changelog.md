# Changelog

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
