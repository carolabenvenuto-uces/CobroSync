// Temporal: capturas de la demo en tamaño celular (390x844) para revisar el diseño
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const base = 'http://localhost:4173/CobroSync/#'
mkdirSync('capturas-celular', { recursive: true })
const navegador = await chromium.launch()
const casos = [
  ['auditoria', 'TODAS', ['/app', '/app/control-diario', '/app/siniestros', '/app/presentar', '/app/pendientes', '/app/reclamos', '/app/mi-sucursal', '/app/resumen', '/app/companias', '/app/planilla', '/app/notificaciones']],
  ['sucursal', 'Rocamora', ['/app', '/app/siniestros']],
  ['gerencia', 'TODAS', ['/app', '/app/sucursales']],
]
for (const [rol, sucursal, rutas] of casos) {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
  const p = await ctx.newPage()
  await p.goto(base + '/', { waitUntil: 'load' })
  await p.evaluate(({ rol, sucursal }) => sessionStorage.setItem('cobrosync-sesion-demo', JSON.stringify({ rol, sucursal: sucursal === 'TODAS' ? 'Todas' : sucursal })), { rol, sucursal })
  await p.reload({ waitUntil: 'load' })
  for (const r of rutas) {
    await p.evaluate((h) => { location.hash = h }, r)
    await p.waitForTimeout(2500)
    const n = `${rol}${r.replace(/\//g, '_')}`
    await p.screenshot({ path: `capturas-celular/${n}.png`, fullPage: false })
    await p.screenshot({ path: `capturas-celular/${n}_abajo.png`, fullPage: true }).catch(() => {})
  }
  // menú abierto
  await p.evaluate(() => { location.hash = '/app' })
  await p.waitForTimeout(1500)
  await p.getByRole('button', { name: 'Abrir menú' }).click().catch(() => {})
  await p.waitForTimeout(800)
  await p.screenshot({ path: `capturas-celular/${rol}_menu.png` })
  if (rol === 'auditoria') {
    await p.getByText('Soporte técnico').first().click().catch(() => {})
    await p.waitForTimeout(800)
    await p.screenshot({ path: `capturas-celular/${rol}_soporte.png` })
  }
  await ctx.close()
}
await navegador.close()
