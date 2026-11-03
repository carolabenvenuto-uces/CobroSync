# CobroSync by CAROLA

**Gestión documental y cobranzas para empresas B2B.** CobroSync centraliza facturas, legajos, validación documental y seguimiento de cobranzas, para que la documentación llegue correcta, se presente a tiempo y se cobre sin perder trazabilidad.

La demo está verticalizada en **concesionarias y talleres que facturan reparaciones de siniestros a compañías de seguros**.

🚀 **Demo publicada:** [carolabenvenuto-uces.github.io/CobroSync](https://carolabenvenuto-uces.github.io/CobroSync/)

> ⚠️ **Todos los datos de este repositorio son ficticios.** Compañías, sucursales, patentes, siniestros y montos los genera el script [`scripts/generar-datos-demo.mjs`](scripts/generar-datos-demo.mjs). Nunca se suben datos reales: ver [docs/decisiones/002-datos-ficticios.md](docs/decisiones/002-datos-ficticios.md).

Desarrollado por **CaroIA Studio**.

---

## El problema

Cada factura a una aseguradora necesita un legajo de respaldo: factura, orden de reparación, remito y conformidad firmada. Hoy eso se controla con planillas, carpetas en Drive y correos. Cuando un documento falta, está ilegible o sin firma, la compañía lo rechaza o lo retiene, y el cobro se demora entre 15 y 45 días.

## La solución

| Etapa del legajo | Qué hace CobroSync |
|---|---|
| Ingesta | Importa las facturas desde la exportación del ERP |
| Armado | Asocia factura + orden + remito + conformidad |
| Validación | Semáforo: 🔴 falta, ilegible o sin firma · 🟡 completo, en curso · 🟢 cobrado |
| Presentación | Envío a cada compañía y seguimiento hasta el cobro |
| Finanzas (Premium) | Saldos por compañía, vencidos, notas de crédito, DSO y proyección semanal |

**Roles:** Taller (carga y corrige), Administración y cobranzas (valida y presenta), Gerencia (consulta indicadores).

## Estado del proyecto

| Etapa | Contenido | Estado |
|---|---|---|
| 1 | Prototipo navegable en GitHub Pages con datos ficticios | 🚧 en curso |
| 2 | Login por rol, importación Excel/CSV, archivos del legajo, base de datos (Supabase) | ⏳ |
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
│   ├── domain/        # reglas del negocio (semáforo, saldos, DSO, proyección), sin pantallas
│   ├── services/      # acceso a datos: hoy JSON, en la etapa 2 Supabase
│   ├── context/       # estado global: datos, rol activo y filtros
│   ├── components/    # layout (sidebar, filtros), legajo y componentes de UI
│   ├── pages/         # Landing, Dashboard, Control diario, Saldos, Cobros previstos
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
