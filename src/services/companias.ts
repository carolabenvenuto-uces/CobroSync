/**
 * Lee las pestañas "CP" o "Info. Compañías" de la planilla (exportadas como CSV)
 * y completa los datos de cada compañía: razón social, CUIT, plazo y correos.
 *
 * Igual que la hoja Diario, se procesa solo en el navegador: los correos reales
 * nunca se guardan en el repositorio ni en ningún servidor.
 */
import type { Aseguradora } from '../domain/tipos'
import { parsearCsv } from './planilla'

const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
const soloDigitos = (texto: string | undefined) => (texto ?? '').replace(/\D/g, '')
const EMAIL = /[^\s,;<>()"]+@[^\s,;<>()"]+\.[^\s,;<>()"]+/g

export interface ResultadoCompanias {
  aseguradoras: Aseguradora[]
  actualizadas: number
  sinCoincidencia: number
}

export function importarCompanias(texto: string, actuales: Aseguradora[]): ResultadoCompanias {
  const filas = parsearCsv(texto)
  const iEncabezado = filas.slice(0, 15).findIndex((f) => f.some((c) => /cuit/i.test(c)) || f.some((c) => /mail/i.test(c)))
  if (iEncabezado === -1) {
    throw new Error('Formato no reconocido. Tiene que ser la pestaña "CP" o "Info. Compañías", con una columna CUIT o Mail.')
  }
  const encabezado = filas[iEncabezado].map((c) => c.trim())
  const buscar = (re: RegExp) => encabezado.findIndex((c) => re.test(c))
  const col = {
    compania: buscar(/compa|aseguradora/i),
    razon: buscar(/raz[oó]n|nombre/i),
    cuit: buscar(/cuit/i),
    plazo: buscar(/plazo|d[ií]as/i),
  }
  const colMails = encabezado.map((c, i) => (/mail|correo/i.test(c) ? i : -1)).filter((i) => i >= 0)

  const lista = actuales.map((a) => ({ ...a }))
  let actualizadas = 0
  let sinCoincidencia = 0
  for (const f of filas.slice(iEncabezado + 1)) {
    if (f.every((c) => !c.trim())) continue
    const cuit = col.cuit >= 0 ? soloDigitos(f[col.cuit]) : ''
    const nombres = [col.compania, col.razon].filter((i) => i >= 0).map((i) => normalizar(f[i] ?? '')).filter(Boolean)
    const a =
      (cuit && lista.find((x) => soloDigitos(x.cuit) === cuit)) ||
      lista.find((x) => {
        const propios = [x.nombre, x.razonSocial ?? '', x.id].map(normalizar).filter((n) => n.length >= 3)
        return nombres.some((n) => propios.some((p) => n === p || n.includes(p) || p.includes(n)))
      })
    if (!a) {
      sinCoincidencia++
      continue
    }
    if (col.razon >= 0 && f[col.razon]?.trim()) a.razonSocial = f[col.razon].trim()
    if (cuit) a.cuit = cuit
    const plazo = col.plazo >= 0 ? Number(soloDigitos(f[col.plazo])) : 0
    if (plazo > 0 && plazo <= 120) a.plazoPagoDias = plazo
    const mails = colMails.flatMap((i) => (f[i] ?? '').match(EMAIL) ?? [])
    if (mails.length) {
      a.email = mails[0]
      a.emailReclamos = mails.slice(1).join(', ') || undefined
    }
    actualizadas++
  }
  return { aseguradoras: lista, actualizadas, sinCoincidencia }
}
