import { LockKeyhole } from 'lucide-react'
import { Isologo } from '../Logo'

/** Mensajes mientras se cargan los datos o si falla la carga. */
export function Cargando({ pantallaCompleta = false }: { pantallaCompleta?: boolean }) {
  if (!pantallaCompleta) return <div className="p-10 text-center text-sm text-slate-500">Cargando datos…</div>
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-noche text-center">
      <Isologo className="h-14 w-14 animate-pulse" />
      <div className="text-2xl font-extrabold text-white">CobroSync</div>
      <div className="text-sm text-slate-300">Ingresando con tu cuenta de la empresa…</div>
    </div>
  )
}

/** Con Google: la cuenta no está habilitada (o no es de la empresa). */
export function SinAcceso({ mensaje }: { mensaje: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-noche px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sem-rojo/10 text-sem-rojo">
          <LockKeyhole className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-extrabold text-noche">No podés ingresar todavía</h1>
        <p className="mt-2 text-sm text-slate-600">{mensaje}</p>
        <p className="mt-4 text-xs text-slate-500">
          Si tu cuenta debería tener acceso, pedile a Auditoría que la agregue. Si entraste con una cuenta personal, cerrá sesión en
          Google y volvé a entrar con la de la empresa.
        </p>
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
