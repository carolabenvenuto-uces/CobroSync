/**
 * "Para resolver" de la sucursal: lo que necesita su atención primero.
 *  - documentos observados por Auditoría (hay que reemplazarlos)
 *  - facturas que pasaron el plazo (salvo que la sucursal avisó una fecha que todavía no llegó)
 *  - facturas a las que les vence el plazo en 2 días o menos
 * Las MiPyME van antes, a igual motivo.
 */
import { esMipyme, plazoSucursal } from './plazos'
import { calcularSemaforo, NOMBRE_DOCUMENTO } from './semaforo'
import { diasDeEspera } from './sucursales'
import type { Comprobante } from './tipos'

export interface ParaResolver {
  c: Comprobante
  /** más alto = más urgente */
  orden: number
  motivo: string
}

export function paraResolver(comprobantes: Comprobante[], hoy: string): ParaResolver[] {
  const lista: ParaResolver[] = []
  for (const c of comprobantes) {
    if (c.tipo !== 'FC') continue
    const etapa = calcularSemaforo(c, hoy).etapa
    if (etapa !== 'doc_observada' && etapa !== 'doc_pendiente' && etapa !== 'doc_atrasada') continue
    const dias = diasDeEspera(c, hoy)
    const plazo = plazoSucursal(c)
    const mipyme = esMipyme(c) ? 0.5 : 0
    if (etapa === 'doc_observada') {
      const obs = c.documentos.filter((d) => d.estado === 'observado')
      const detalle = obs.map((d) => `${NOMBRE_DOCUMENTO[d.tipo].toLowerCase()}${d.motivo ? ` (${d.motivo.toLowerCase()})` : ''}`).join(', ')
      lista.push({ c, orden: 3 + mipyme, motivo: `Observada: reemplazar ${detalle || 'un documento'}` })
      continue
    }
    const comprometida = c.compromiso && c.compromiso.fecha >= hoy
    if (comprometida) continue
    if (dias > plazo) {
      const atraso = dias - plazo
      lista.push({ c, orden: 2 + mipyme, motivo: `Pasó el plazo hace ${atraso} ${atraso === 1 ? 'día' : 'días'}` })
    } else if (plazo - dias <= 2) {
      const faltan = plazo - dias
      lista.push({ c, orden: 1 + mipyme, motivo: faltan === 0 ? 'Hoy vence el plazo' : `Vence el plazo en ${faltan} ${faltan === 1 ? 'día' : 'días'}` })
    }
  }
  return lista.sort((a, b) => b.orden - a.orden || diasDeEspera(b.c, hoy) - diasDeEspera(a.c, hoy))
}
