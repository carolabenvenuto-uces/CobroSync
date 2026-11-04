import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Dos formas de compilar:
// - normal (npm run build): el sitio de GitHub Pages. "base" es el subdirectorio con el nombre del repo
//   (https://carolabenvenuto-uces.github.io/CobroSync/).
// - google (npm run build:google): un único archivo HTML con todo adentro, para pegar en
//   Google Apps Script como "Index.html" (ver google/LEEME.md).
export default defineConfig(({ mode }) =>
  mode === 'google'
    ? {
        base: './',
        plugins: [react(), tailwindcss(), viteSingleFile()],
        publicDir: false,
        build: { outDir: 'dist-google', emptyOutDir: true },
      }
    : {
        base: '/CobroSync/',
        plugins: [react(), tailwindcss()],
      },
)
