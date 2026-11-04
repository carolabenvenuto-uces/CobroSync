/**
 * Prueba de humo de la versión para Google Apps Script (corre en GitHub Actions).
 * Abre dist-google/index.html con un "google.script.run" simulado que responde con los datos
 * de demo, y verifica que cada rol entre a su pantalla y que los cambios se manden a guardar.
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const leer = (f) => JSON.parse(readFileSync(join(raiz, 'public', 'datos-demo', f), 'utf8'))
const datos = {
  aseguradoras: leer('aseguradoras.json'),
  comprobantes: leer('comprobantes.json'),
  cobrosPrevistos: leer('cobros-previstos.json'),
  meta: leer('meta.json'),
}
const url = pathToFileURL(join(raiz, 'dist-google', 'index.html')).href

const USUARIOS = {
  auditoria: { email: 'auditoria@svaauto.com.ar', nombre: 'Auditoría', rol: 'auditoria', sucursal: null },
  sucursal: { email: 'facturacion@svaauto.com.ar', nombre: 'Facturación Rocamora', rol: 'sucursal', sucursal: 'Rocamora' },
  gerencia: { email: 'gerencia@svaauto.com.ar', nombre: 'Gerencia', rol: 'gerencia', sucursal: null },
}
const ESPERADO = { auditoria: 'Avisos', sucursal: 'Mis facturas', gerencia: 'Resumen' }

const navegador = await chromium.launch()
let fallas = 0
for (const [rol, usuario] of Object.entries(USUARIOS)) {
  const pagina = await navegador.newPage()
  const errores = []
  pagina.on('pageerror', (e) => errores.push(e.message))
  await pagina.addInitScript(
    ({ usuario, datos }) => {
      window.__llamadas = []
      const respuestas = {
        obtenerDatos: () => ({ usuario, ahora: '2026-11-04T10:00:00.000Z', leidas: [], datos: usuario.rol === 'sucursal' ? { ...datos, comprobantes: datos.comprobantes.filter((c) => c.sucursal === usuario.sucursal) } : datos }),
        aplicarCambios: () => ({ comprobantes: [], ahora: '2026-11-04T10:00:01.000Z' }),
        obtenerCambios: () => ({ comprobantes: [], ahora: '2026-11-04T10:01:00.000Z' }),
        marcarLeidas: () => true,
        agregarComprobantes: (l) => l.length,
        guardarAseguradoras: () => 0,
        agregarAQuiter: (f) => ({ configurada: true, agregadas: f.length, completadas: 0 }),
        actualizarMiPlanilla: () => ({ completadas: 0, ahora: '2026-11-04T10:00:00.000Z' }),
        subirArchivo: (_id, tipo, nombre) => ({ archivo: nombre, url: 'https://drive.google.com/prueba' }),
      }
      const crear = (ok, mal) =>
        new Proxy(
          {},
          {
            get: (_, nombre) => {
              if (nombre === 'withSuccessHandler') return (f) => crear(f, mal)
              if (nombre === 'withFailureHandler') return (f) => crear(ok, f)
              return (...args) => {
                window.__llamadas.push(nombre)
                setTimeout(() => {
                  try { ok && ok(respuestas[nombre](...args)) } catch (e) { mal && mal(e) }
                }, 10)
              }
            },
          },
        )
      window.google = { script: { run: crear(null, null) } }
    },
    { usuario, datos },
  )
  await pagina.goto(url, { waitUntil: 'load' })
  try {
    await pagina.getByRole('heading', { name: new RegExp(ESPERADO[rol]) }).first().waitFor({ timeout: 15000 })
    const pie = await pagina.locator('footer').innerText()
    if (!pie.includes(usuario.email)) throw new Error(`el pie no muestra la cuenta: ${pie}`)
    if (await pagina.getByText('Ver como').count()) throw new Error('se ve el selector "Ver como"')
    console.log(`ok   ${rol}: entra a "${ESPERADO[rol]}" como ${usuario.email}`)
  } catch (e) {
    fallas++
    console.log(`FAIL ${rol}: ${e.message}`)
  }
  if (errores.length) {
    fallas++
    console.log(`FAIL ${rol}: errores en la página: ${errores.join(' | ')}`)
  }
  await pagina.close()
}

// Guardado: como Auditoría, aprobar todo en una factura en revisión
{
  const pagina = await navegador.newPage()
  await pagina.addInitScript(
    ({ usuario, datos }) => {
      window.__llamadas = []
      const crear = (ok) =>
        new Proxy({}, {
          get: (_, nombre) => {
            if (nombre === 'withSuccessHandler') return (f) => crear(f)
            if (nombre === 'withFailureHandler') return () => crear(ok)
            return (...args) => {
              window.__llamadas.push(nombre)
              const r =
                nombre === 'obtenerDatos'
                  ? { usuario, datos, ahora: '2026-11-04T10:00:00.000Z', leidas: [] }
                  : nombre === 'aplicarCambios'
                    ? { comprobantes: [], ahora: 'x' }
                    : nombre === 'obtenerCambios'
                      ? { comprobantes: window.__cambios ?? [], ahora: '2026-11-04T10:02:00.000Z' }
                      : true
              setTimeout(() => ok && ok(r), 10)
            }
          },
        })
      window.google = { script: { run: crear(null) } }
    },
    { usuario: USUARIOS.auditoria, datos },
  )
  await pagina.goto(url, { waitUntil: 'load' })
  try {
    await pagina.getByRole('heading', { name: /Avisos/ }).first().waitFor({ timeout: 15000 })
    await pagina.evaluate(() => { location.hash = '#/app/control-diario?estado=En%20revisi%C3%B3n' })
    await pagina.locator('tbody tr').first().click()
    await pagina.getByRole('button', { name: /Aprobar todo/ }).click()
    await pagina.waitForFunction(() => window.__llamadas.includes('aplicarCambios'), null, { timeout: 5000 })
    await pagina.getByText('Cambios guardados').waitFor({ timeout: 5000 })
    console.log('ok   auditoría: aprobar documentos se manda a guardar en Google')

    // Otra persona (una sucursal) escribe en una factura: sin recargar, a Auditoría le llega la notificación
    const contar = async () => Number((await pagina.getByRole('button', { name: /Notificaciones/ }).innerText()).replace(/\D/g, '') || 0)
    const antes = await contar()
    await pagina.evaluate((c) => {
      window.__cambios = [{ ...c, eventos: [...c.eventos, { fecha: '2026-11-04', autor: 'Facturación Rocamora', area: 'sucursal', tipo: 'mensaje', texto: 'Ya subí la orden' }] }]
      document.dispatchEvent(new Event('visibilitychange'))
    }, datos.comprobantes.find((c) => c.sucursal === 'Rocamora'))
    await pagina.waitForFunction((n) => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Notificaciones'))
      return Number(b.textContent.replace(/\D/g, '') || 0) > n
    }, antes, { timeout: 5000 })
    console.log(`ok   auditoría: sin recargar, llega la notificación de un cambio de la sucursal (${antes} → ${await contar()})`)
  } catch (e) {
    fallas++
    console.log(`FAIL guardado: ${e.message}`)
  }
  await pagina.close()
}

await navegador.close()
if (fallas) process.exit(1)
