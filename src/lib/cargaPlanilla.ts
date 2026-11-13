import { useSyncExternalStore } from 'react'

/**
 * Estado de la carga de la planilla a CobroSync. Vive fuera de la pantalla: si se cambia de
 * pantalla mientras se guarda, la carga sigue y el avance se ve desde cualquier lado.
 */
export interface EstadoCarga {
  /** texto que se muestra ("Guardando facturas: 600 de 9.207…" o "Listo: …") */
  texto: string
  enCurso: boolean
  error?: boolean
}

let estado: EstadoCarga | null = null
const oyentes = new Set<() => void>()

export function ponerEstadoCarga(nuevo: EstadoCarga | null) {
  estado = nuevo
  oyentes.forEach((o) => o())
}

export function useEstadoCarga(): EstadoCarga | null {
  return useSyncExternalStore(
    (o) => {
      oyentes.add(o)
      return () => oyentes.delete(o)
    },
    () => estado,
  )
}

// Si se intenta cerrar o recargar la página mientras se guarda, el navegador pregunta antes
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (e) => {
    if (estado?.enCurso) {
      e.preventDefault()
      e.returnValue = ''
    }
  })
}
