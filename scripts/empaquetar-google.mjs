/**
 * Arma la carpeta dist-google/paquete con todo lo que hay que copiar en Google Apps Script:
 *   Index.html (la aplicación entera en un solo archivo), Codigo.gs, appsscript.json y LEEME.md
 */
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const destino = join(raiz, 'dist-google', 'paquete')
mkdirSync(destino, { recursive: true })
copyFileSync(join(raiz, 'dist-google', 'index.html'), join(destino, 'Index.html'))
for (const archivo of ['Codigo.gs', 'appsscript.json', 'LEEME.md']) copyFileSync(join(raiz, 'google', archivo), join(destino, archivo))
console.log('Paquete para Google Apps Script listo en dist-google/paquete')
