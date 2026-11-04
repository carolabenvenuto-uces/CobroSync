# CobroSync v1.0

Diseño y desarrollo: **Carola Benvenuto**.

**Gestión documental y cobranzas para empresas B2B.** CobroSync centraliza facturas, legajos, validación documental y seguimiento de cobranzas, para que la documentación llegue correcta, se presente a tiempo y se cobre sin perder trazabilidad.

La demo está verticalizada en **concesionarias y talleres que facturan reparaciones de siniestros a compañías de seguros**.

🚀 **Demo publicada:** [carolabenvenuto-uces.github.io/CobroSync](https://carolabenvenuto-uces.github.io/CobroSync/)

> ⚠️ **Datos de ejemplo.** Las sucursales y las compañías de seguro son reales; fechas, montos, números de comprobante, siniestros y patentes son inventados por [`scripts/generar-datos-demo.mjs`](scripts/generar-datos-demo.mjs), con proporciones tomadas de estadísticas de la planilla de control. Nunca se suben filas reales: ver [docs/decisiones/002-datos-ficticios.md](docs/decisiones/002-datos-ficticios.md).

---

## El problema

Cada factura a una aseguradora necesita un legajo de respaldo: la factura y la orden de reparación o repuestos firmada por el cliente. Hoy eso se controla con planillas, carpetas en Drive y correos. Cuando un documento falta, está ilegible o sin firma, la compañía lo rechaza o lo retiene, y el cobro se demora entre 15 y 45 días.

## La solución

| Etapa del legajo | Qué hace CobroSync |
|---|---|
| Ingesta | Importa las facturas desde la exportación del ERP |
| Armado | Asocia factura + orden + remito + conformidad |
| Validación | Semáforo: 🔴 falta, ilegible o sin firma · 🟡 completo, en curso · 🟢 cobrado |
| Presentación | Envío a cada compañía y seguimiento hasta el cobro |
| Finanzas (Premium) | Saldos por compañía, vencidos, notas de crédito, DSO y proyección semanal |

**Roles (cada uno ve una app distinta):**

| Rol | Pantalla de inicio | Qué más ve |
|---|---|---|
| Gerencia | Resumen simple del mes y del año | Ranking, Saldos, Impacto y "Buscar una factura" (solo consulta) |
| Auditoría | Avisos por sector, que llevan a cada tabla ya filtrada | Pendientes, Reclamos, Control diario, informes, Compañías y "Usar mi planilla" |
| Sucursal | Mis facturas: qué subir, qué corregir y qué está en revisión | Notificaciones de Auditoría |

**Foco actual:** ser el lugar único de comunicación entre sucursales, auditoría y gerencia sobre cada factura. Ver [docs/decisiones/003-foco-en-sucursales.md](docs/decisiones/003-foco-en-sucursales.md).

## Usar con la planilla real

En la app, **Datos → Usar mi planilla**: se descarga la hoja *Diario* como CSV (Archivo → Descargar → .csv) y se arrastra a la página. Todo se procesa en el navegador; el archivo no se sube a ningún servidor ni se guarda.

## Estado del proyecto

| Etapa | Contenido | Estado |
|---|---|---|
| 1 | Prototipo navegable en GitHub Pages con datos ficticios | 🚧 en curso |
| 2 | Prueba piloto con Google: ingreso con la cuenta de la empresa, planilla de Google como base, documentos en Drive, avisos por mail ([google/LEEME.md](google/LEEME.md)) | 🧰 preparado, falta habilitar |
| 3 | Validación con OCR, envío por correo, automatizaciones | ⏳ |

Detalle en [plan.md](plan.md) y cambios en [changelog.md](changelog.md).

## Tecnologías

- **React 19 + TypeScript**, compilado con **Vite**
- **Tailwind CSS 4** con los colores de la marca en `src/styles/index.css`
- **React Router** (HashRouter, compatible con GitHub Pages)
- **Recharts** (gráficos) y **lucide-react** (íconos)
- **Vitest** (tests de las reglas de negocio)
- **GitHub Actions + GitHub Pages** (compilación y publicación automáticas)

Por qué se eligió cada una: [docs/decisiones/001-tecnologia.md](docs/decisiones/001-tecnologia.md).

## Estructura

```
├── .github/workflows/deploy.yml   # tests + build en cada PR; deploy al mergear a main
├── docs/                          # decisiones técnicas y modelo de datos (DER)
├── public/datos-demo/             # JSON ficticios que lee la app
├── scripts/generar-datos-demo.mjs # genera esos JSON
├── src/
│   ├── domain/        # reglas del negocio (semáforo, plazos de sucursal, impacto, saldos), sin pantallas
│   ├── services/      # acceso a datos: hoy JSON, en la etapa 2 Supabase
│   ├── context/       # estado global: datos, rol activo y filtros
│   ├── components/    # layout (sidebar, filtros), legajo y componentes de UI
│   ├── pages/         # Inicio, Pendientes, Alertas, Control diario, Ranking, Impacto, Saldos, Cobros, Presentación
│   └── lib/           # formato de pesos y fechas
└── tests/             # tests de domain/
```

## Cómo trabajar en el proyecto

No hace falta instalar nada en la computadora: se puede abrir el repo en **GitHub Codespaces** (botón verde **Code → Codespaces**) y usar la terminal que trae.

```bash
npm install          # instala dependencias
npm run dev          # servidor local de desarrollo
npm test             # tests de las reglas de negocio
npm run build        # compila a dist/
npm run datos:demo   # regenera los datos ficticios
```

**Flujo de trabajo:** ramas `feature/*` → Pull Request a `main`. Cada PR corre los tests y la compilación; al mergear, GitHub Actions publica el sitio.
