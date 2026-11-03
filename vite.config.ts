import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base: GitHub Pages publica el sitio en un subdirectorio con el nombre del repo
// (https://carolabenvenuto-uces.github.io/CobroSync/). Vite necesita saberlo para
// armar bien las rutas a los archivos JS, CSS y a los datos de demo.
export default defineConfig({
  base: '/CobroSync/',
  plugins: [react(), tailwindcss()],
})
