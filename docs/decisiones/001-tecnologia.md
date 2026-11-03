# 001 · Tecnología de la etapa 1

**Fecha:** 2026-11-03 · **Estado:** aceptada

## Contexto

- El prototipo inicial se hizo en Lovable (pago). Lovable generó un proyecto con **TanStack Start**, que necesita un servidor (`server.ts`, Nitro) y por eso no se puede publicar en GitHub Pages, que solo sirve archivos estáticos.
- La app tiene 5 o más pantallas que comparten estado: rol activo, filtros de sucursal y mes, y el semáforo de cada legajo.
- En la etapa 2 se conectará a una base de datos (Supabase).
- Todo debe ser gratuito.

## Decisión

| Elegimos | En lugar de | Por qué |
|---|---|---|
| **React** | HTML/CSS/JS puro | Con estado compartido entre pantallas, en JS puro habría que actualizar el DOM a mano en cada lugar. React vuelve a dibujar solo lo que cambió. Además, el diseño de Lovable ya está en React. |
| **Vite** | TanStack Start / Next.js | Compila a archivos estáticos (`dist/`), que es lo que GitHub Pages puede servir. Arranca rápido en desarrollo. |
| **TypeScript** | JavaScript | Los tipos (`Comprobante`, `Legajo`…) documentan el modelo y el editor avisa los errores antes de ejecutar. Supabase genera tipos automáticamente en la etapa 2. |
| **Tailwind CSS** | CSS propio / Bootstrap | Los colores de la marca se definen una vez como tokens (`@theme`) y se usan como clases (`bg-marca`, `text-sem-rojo`). Lovable también usaba Tailwind. |
| **HashRouter** | BrowserRouter | GitHub Pages no conoce las rutas internas: recargar `/CobroSync/app/saldos` daría 404. Con `#/app/saldos` siempre se sirve `index.html`. |
| **Datos en `public/` + `fetch`** | Importar los JSON en el código | Simula una llamada a una API real. En la etapa 2 solo cambia `src/services/datos.ts`. |
| **Vitest** | Jasmine | Mismo estilo que Jasmine (`describe`, `it`, `expect`), pero integrado con Vite y TypeScript. |
| **GitHub Actions** | Publicar `dist/` a mano | Cada PR se testea y compila en la nube; al mergear se publica solo. No hace falta instalar nada local. |

## Consecuencias

- Hay que compilar antes de publicar (lo hace GitHub Actions).
- Las URLs llevan `#`. Es aceptable para un prototipo; si más adelante se usa un hosting con soporte de rutas (por ejemplo Netlify o Vercel), se puede cambiar a BrowserRouter.
- No se copia el repo de Lovable: se reescribieron los componentes y solo se tomó el diseño como referencia.
