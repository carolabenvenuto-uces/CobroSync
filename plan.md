# Plan de desarrollo de CobroSync

## Principios

1. **Solo datos ficticios en el repositorio.** El repo y el sitio son públicos.
2. **Herramientas gratuitas** o con plan gratuito.
3. **Las reglas del negocio viven en `src/domain/`**, separadas de las pantallas y con tests.
4. **Un solo origen para cada dato**: los saldos y las proyecciones se calculan, no se cargan a mano.

## Etapa 1: prototipo navegable (en curso)

- [x] Base del proyecto: React + Vite + TypeScript + Tailwind
- [x] Publicación automática en GitHub Pages con GitHub Actions
- [x] Modelo de datos (`src/domain/tipos.ts`) y DER (`docs/modelo-datos.md`)
- [x] Generador de datos ficticios reproducibles
- [x] Reglas del semáforo y cálculos financieros, con tests
- [x] Landing page
- [x] Layout: sidebar por rol, filtros de sucursal y mes
- [x] Dashboard general
- [x] Control diario y panel de legajo (acciones simuladas por rol)
- [x] Saldos por compañía
- [x] Cobros previstos
- [x] Centro de alertas (escaneos críticos, compromisos vencidos, rechazos, NC sin aviso, vencidos)
- [x] Portal de sucursal: pendientes, subida por documento, compromisos con fecha, NC informadas
- [x] Conversación por legajo (reemplaza los mails)
- [x] Ranking de sucursales e impacto económico, exportables a Excel
- [ ] Carga desde el celular con QR (simulada)
- [ ] Resumen semanal por mail (simulado) para gerentes de sucursal
- [ ] Revisión con usuarias reales del sector y ajustes

## Etapa 2: funcionalidad real básica

- [x] Leer la planilla real (CSV de la hoja Diario) en el navegador, sin subirla a ningún servidor

- [ ] Base de datos en Supabase (PostgreSQL) a partir del DER
- [ ] Login con Google restringido a las cuentas corporativas, roles y Row Level Security
- [ ] Avisos por mail reales (plazos de escaneo y escalamiento)
- [ ] Importar facturas desde la exportación del ERP (Excel/CSV)
- [ ] Subir los archivos del legajo (Supabase Storage)
- [ ] Reemplazar `src/services/datos.ts` por consultas a Supabase

> Antes de cargar datos reales, aunque sea en una base privada, hay que acordarlo con la empresa.

## Etapa 3: automatización

- [ ] Validación de documentos con OCR (nitidez, firma/sello, monto, orden, cliente)
- [ ] Presentación por correo a cada compañía
- [ ] Bots para los portales de las aseguradoras
