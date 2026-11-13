/**
 * "Para resolver" de la sucursal: lo que necesita su atención primero.
 *  - documentos observados por Cobranzas (hay que reemplazarlos)
 *  - facturas que pasaron el plazo (salvo que la sucursal avisó una fecha que todavía no llegó)
 *  - facturas a las que les vence el plazo en 2 días o menos
 * Las MiPyME van arriba de todo. Se separa en dos temas: rechazos (algo observado) y documentación.
 */
import { esMipyme, plazoSucursal } from './plazos'
import { calcularSemaforo, NOMBRE_DOCUMENTO } from './semaforo'
import { diasDeEspera } from './sucursales'
import type { Comprobante } from './tipos'

export interface ParaResolver {
  c: Comprobante
  /** más alto = más urgente (sin contar si es MiPyME) */
  orden: number
  motivo: string
  /** rechazo: un documento observado (por Cobranzas o por la compañía); documentacion: falta subir */
  tema: 'rechazo' | 'documentacion'
  mipyme: boolean
}

export function paraResolver(comprobantes: Comprobante[], hoy: string): ParaResolver[] {
  const lista: ParaResolver[] = []
  for (const c of comprobantes) {
    if (c.tipo !== 'FC') continue
    const etapa = calcularSemaforo(c, hoy).etapa
    if (etapa !== 'doc_observada' && etapa !== 'doc_pendiente' && etapa !== 'doc_atrasada') continue
    const dias = diasDeEspera(c, hoy)
    const plazo = plazoSucursal(c)
    const mipyme = esMipyme(c)
    if (etapa === 'doc_observada') {
      const obs = c.documentos.filter((d) => d.estado === 'observado')
      const detalle = obs.map((d) => `${NOMBRE_DOCUMENTO[d.tipo].toLowerCase()}${d.motivo ? ` (${d.motivo.toLowerCase()})` : ''}`).join(', ')
      const ultimoRechazo = c.eventos.filter((e) => e.tipo === 'rechazo').at(-1)
      const deLaCompania = !!ultimoRechazo && /^Rechazo de /.test(ultimoRechazo.texto)
      lista.push({
        c,
        orden: 3,
        tema: 'rechazo',
        mipyme,
        motivo: `${deLaCompania ? 'Rechazada por la compañía' : 'Observada por Cobranzas'}: reemplazar ${detalle || 'un documento'}`,
      })
      continue
    }
    const comprometida = c.compromiso && c.compromiso.fecha >= hoy
    if (comprometida) continue
    if (dias > plazo) {
      const atraso = dias - plazo
      lista.push({ c, orden: 2, tema: 'documentacion', mipyme, motivo: `Pasó el plazo hace ${atraso} ${atraso === 1 ? 'día' : 'días'}` })
    } else if (plazo - dias <= 2) {
      const faltan = plazo - dias
      lista.push({ c, orden: 1, tema: 'documentacion', mipyme, motivo: faltan === 0 ? 'Hoy vence el plazo' : `Vence el plazo en ${faltan} ${faltan === 1 ? 'día' : 'días'}` })
    }
  }
  // Prioridad: las MiPyME arriba de todo (la compañía tiene pocos días para aceptarlas), después lo más urgente
  return lista.sort((a, b) => Number(b.mipyme) - Number(a.mipyme) || b.orden - a.orden || diasDeEspera(b.c, hoy) - diasDeEspera(a.c, hoy))
}
