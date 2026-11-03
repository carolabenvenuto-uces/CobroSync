import type { ColorSemaforo, EstadoComprobante } from '../../domain/tipos'

const ESTILO_SEMAFORO: Record<ColorSemaforo, { punto: string; fondo: string; texto: string }> = {
  rojo: { punto: 'bg-sem-rojo', fondo: 'bg-sem-rojo/10', texto: 'Bloqueado' },
  amarillo: { punto: 'bg-sem-amarillo', fondo: 'bg-sem-amarillo/10', texto: 'En curso' },
  verde: { punto: 'bg-sem-verde', fondo: 'bg-sem-verde/10', texto: 'Cobrado' },
  neutro: { punto: 'bg-slate-400', fondo: 'bg-slate-100', texto: 'No aplica' },
}

export const NOMBRE_SEMAFORO: Record<ColorSemaforo, string> = {
  rojo: 'Rojo',
  amarillo: 'Amarillo',
  verde: 'Verde',
  neutro: 'Neutro',
}

export function PuntoSemaforo({ color }: { color: ColorSemaforo }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${ESTILO_SEMAFORO[color].punto}`}
      aria-label={`Semáforo ${NOMBRE_SEMAFORO[color]}`}
    />
  )
}

export function BadgeSemaforo({ color }: { color: ColorSemaforo }) {
  const estilo = ESTILO_SEMAFORO[color]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-noche ${estilo.fondo}`}>
      <PuntoSemaforo color={color} />
      {estilo.texto}
    </span>
  )
}

export const NOMBRE_ESTADO: Record<EstadoComprobante, string> = {
  pendiente_drive: 'Pendiente Drive',
  en_gestion: 'En gestión',
  presentada: 'Presentada',
  cobrada: 'Cobrada',
  anulada: 'Anulada',
  nota_credito: 'Nota de crédito',
}

const ESTILO_ESTADO: Record<EstadoComprobante, string> = {
  pendiente_drive: 'bg-sem-rojo/10 text-red-700',
  en_gestion: 'bg-sem-amarillo/15 text-amber-800',
  presentada: 'bg-marca/10 text-marca-oscuro',
  cobrada: 'bg-sem-verde/15 text-emerald-800',
  anulada: 'bg-slate-100 text-slate-600',
  nota_credito: 'bg-slate-100 text-slate-600',
}

export function BadgeEstado({ estado }: { estado: EstadoComprobante }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ${ESTILO_ESTADO[estado]}`}>
      {NOMBRE_ESTADO[estado]}
    </span>
  )
}
