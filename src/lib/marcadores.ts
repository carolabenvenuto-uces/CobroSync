import { useCallback, useEffect, useState } from 'react'

/**
 * Notificaciones destacadas y notas propias ("acordarme de…"). Son de cada persona y se guardan en
 * este navegador; no las ve nadie más.
 */
interface Marcadores {
  destacadas: string[]
  notas: Record<string, string>
}

const VACIO: Marcadores = { destacadas: [], notas: {} }

function leer(clave: string): Marcadores {
  try {
    const t = localStorage.getItem(clave)
    return t ? { ...VACIO, ...(JSON.parse(t) as Marcadores) } : VACIO
  } catch {
    return VACIO
  }
}

export function useMarcadores(quien: string) {
  const clave = `cobrosync-marcadores-${quien}`
  const [m, setM] = useState<Marcadores>(() => leer(clave))
  useEffect(() => setM(leer(clave)), [clave])
  const guardar = useCallback(
    (nuevo: Marcadores) => {
      setM(nuevo)
      try {
        localStorage.setItem(clave, JSON.stringify(nuevo))
      } catch {
        // sin almacenamiento: quedan hasta recargar la página
      }
    },
    [clave],
  )
  return {
    esDestacada: (id: string) => m.destacadas.includes(id),
    alternarDestacada: (id: string) =>
      guardar({ ...m, destacadas: m.destacadas.includes(id) ? m.destacadas.filter((x) => x !== id) : [...m.destacadas, id] }),
    nota: (id: string) => m.notas[id] ?? '',
    guardarNota: (id: string, texto: string) => {
      const notas = { ...m.notas }
      if (texto.trim()) notas[id] = texto
      else delete notas[id]
      guardar({ ...m, notas })
    },
    cantidadDestacadas: m.destacadas.length,
  }
}
