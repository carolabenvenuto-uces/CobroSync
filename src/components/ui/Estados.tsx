import { LockKeyhole } from 'lucide-react'

/** Mensajes mientras se cargan los datos o si falla la carga. */
export function Cargando({ pantallaCompleta = false }: { pantallaCompleta?: boolean }) {
  if (!pantallaCompleta) return <div className="p-10 text-center text-sm text-slate-500">Cargando datos…</div>
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-noche text-center">
      <ImanCargando />
      <div className="text-2xl font-extrabold text-white">CobroSync</div>
      <div className="text-sm text-slate-300">Ingresando con la cuenta de la empresa…</div>
    </div>
  )
}

/** Lo que manda el servidor cuando no se puede entrar (ver errorAcceso_ en Codigo.gs). */
interface MotivoAcceso {
  motivo: 'dominio' | 'usuario' | 'sucursal' | 'falla'
  email?: string
  dominio?: string
  contacto?: string
}
const MARCA_ACCESO = 'CobroSync-acceso:'
function leerMotivo(mensaje: string): MotivoAcceso {
  const i = mensaje.indexOf(MARCA_ACCESO)
  if (i >= 0) {
    try {
      return JSON.parse(mensaje.slice(i + MARCA_ACCESO.length)) as MotivoAcceso
    } catch {
      // sigue abajo
    }
  }
  return { motivo: 'falla' }
}

/** Con Google: no se pudo entrar. Mensajes cortos, como cualquier página; lo técnico queda solo en la consola. */
export function SinAcceso({ mensaje }: { mensaje: string }) {
  const m = leerMotivo(mensaje)
  if (m.motivo === 'falla') console.error('CobroSync no pudo cargar:', mensaje)
  const pedir = m.contacto ? (
    <a href={`mailto:${m.contacto}?subject=${encodeURIComponent('Acceso a CobroSync')}`} className="font-semibold text-marca hover:underline">
      {m.contacto}
    </a>
  ) : (
    'la administradora de la plataforma'
  )
  const cambiarCuenta = (
    <a href="https://accounts.google.com/AccountChooser" target="_top" className="font-semibold text-marca hover:underline">
      Cambiar de cuenta
    </a>
  )
  const texto = {
    dominio: {
      titulo: 'Cuenta no permitida',
      cuerpo: <>CobroSync solo funciona con la cuenta de la empresa{m.dominio ? ` (@${m.dominio})` : ''}.</>,
      pie: cambiarCuenta,
    },
    usuario: {
      titulo: 'Todavía no tenés acceso',
      cuerpo: <>Para solicitarlo, escribí a {pedir}.</>,
      pie: <>¿No es tu cuenta de la empresa? {cambiarCuenta}</>,
    },
    sucursal: {
      titulo: 'Falta tu sucursal',
      cuerpo: <>Tu usuario todavía no tiene una sucursal asignada. Escribí a {pedir}.</>,
      pie: null,
    },
    falla: {
      titulo: 'No se pudo abrir CobroSync',
      cuerpo: <>Probá de nuevo en unos minutos. Si sigue pasando, avisá a {pedir}.</>,
      pie: (
        <button type="button" onClick={() => window.location.reload()} className="font-semibold text-marca hover:underline">
          Reintentar
        </button>
      ),
    },
  }[m.motivo]
  return (
    <div className="flex min-h-screen items-center justify-center bg-noche px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sem-rojo/10 text-sem-rojo">
          <LockKeyhole className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-extrabold text-noche">{texto.titulo}</h1>
        {m.email && m.motivo !== 'falla' && <p className="mt-1 text-xs text-slate-500">{m.email}</p>}
        <p className="mt-3 text-sm text-slate-600">{texto.cuerpo}</p>
        {texto.pie && <p className="mt-4 text-xs text-slate-500">{texto.pie}</p>}
      </div>
    </div>
  )
}

export function ErrorCarga({ mensaje }: { mensaje: string }) {
  return (
    <div className="m-6 rounded-xl border border-sem-rojo/30 bg-sem-rojo/5 p-6 text-sm text-red-800">
      No se pudieron cargar los datos: {mensaje}
    </div>
  )
}

export const claseSelect =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-noche shadow-sm focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/20'

/** Puntitos que atrae el imán: de dónde salen (altura y tamaño), como los del logo, que no van en fila. */
const PUNTOS_IMAN = [
  { y: 60, r: 6 },
  { y: 46, r: 4.5 },
  { y: 74, r: 4.5 },
  { y: 54, r: 3.5 },
  { y: 38, r: 3.5 },
  { y: 66, r: 5 },
  { y: 82, r: 3.5 },
  { y: 50, r: 5 },
]

/**
 * Pantalla de carga: el imán del logo quieto y, desde la derecha, puntitos de distintos tamaños y
 * alturas (como los del logo) que van hacia la boca del imán y desaparecen al llegar, como si los
 * atrajera (los cobros), mientras se cargan los datos.
 *
 * Los puntitos son elementos HTML que solo cambian de posición y transparencia: así la animación la
 * hace la placa de video y sigue fluida aunque la computadora esté ocupada armando los datos (con
 * círculos dentro del SVG se trababa en las computadoras más lentas). Si la computadora tiene las
 * animaciones apagadas, se ve el logo quieto, con sus puntitos de siempre.
 */
function ImanCargando() {
  const lila = '#B9AEFF'
  const agua = '#3FD4C2'
  const duracion = 2.4
  const escala = 80 / 120 // el SVG mide 80 px de alto (viewBox de 120)
  const keyframes = PUNTOS_IMAN.map((p, i) => {
    const dy = Math.round((60 - p.y) * 0.75 * escala)
    return `@keyframes iman-atrae-${i} {
      0% { transform: translate3d(0, 0, 0) scale(.5); opacity: 0; }
      25% { opacity: .6; }
      85% { transform: translate3d(${Math.round(-108 * escala)}px, ${dy}px, 0) scale(1); opacity: 1; }
      100% { transform: translate3d(${Math.round(-118 * escala)}px, ${dy}px, 0) scale(.4); opacity: 0; }
    }`
  }).join('\n')
  return (
    <div className="relative h-20" style={{ width: Math.round(230 * escala) }} role="img" aria-label="Cargando">
      <style>{`
        ${keyframes}
        .iman-punto { position: absolute; border-radius: 9999px; background: ${agua}; opacity: 0; will-change: transform, opacity; }
        .iman-quieto { display: none; }
        @media (prefers-reduced-motion: reduce) {
          .iman-punto { display: none; }
          .iman-quieto { display: inline; }
        }
      `}</style>
      <svg viewBox="0 0 230 120" className="absolute inset-0 h-20 w-auto">
        <path d="M86 28 H58 A32 32 0 0 0 58 92 H86" fill="none" stroke={lila} strokeWidth="22" strokeLinejoin="round" />
        <path d="M76 28 H94" stroke={agua} strokeWidth="22" />
        <path d="M76 92 H94" stroke={agua} strokeWidth="22" />
        {/* Los puntitos del logo, solo si las animaciones están apagadas */}
        <g className="iman-quieto" fill={agua}>
          <circle cx="104" cy="60" r="5" />
          <circle cx="112" cy="48" r="3.5" />
          <circle cx="112" cy="72" r="3.5" />
          <circle cx="117" cy="60" r="2.5" />
        </g>
      </svg>
      {PUNTOS_IMAN.map((p, i) => {
        const tam = p.r * 2 * escala
        return (
          <span
            key={i}
            className="iman-punto"
            style={{
              width: tam,
              height: tam,
              left: 222 * escala - tam / 2,
              top: p.y * escala - tam / 2,
              animation: `iman-atrae-${i} ${duracion}s cubic-bezier(.5,0,.8,1) infinite`,
              animationDelay: `${(-(duracion / PUNTOS_IMAN.length) * i).toFixed(2)}s`,
            }}
          />
        )
      })}
    </div>
  )
}
