/** Mensajes mientras se cargan los datos o si falla la carga. */
export function Cargando() {
  return <div className="p-10 text-center text-sm text-slate-500">Cargando datos de demo…</div>
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
