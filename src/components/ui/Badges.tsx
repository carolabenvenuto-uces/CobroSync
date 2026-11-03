import type { ColorSemaforo, EstadoComprobante, Etapa } from '../../domain/tipos'

/**
 * Cada etapa tiene su color, así se distingue a simple vista de quién depende el legajo:
 *  rojo = bloqueado · amarillo = esperando a la sucursal · azul = para presentar (auditoría)
 *  violeta = esperando el pago (compañía) · verde = cobrado · gris = no aplica
 */
const ESTILO_ETAPA: Record<Etapa, { punto: string; fondo: string; texto: string; quien: string }> = {
  bloqueado: { punto: 'bg-sem-rojo', fondo: 'bg-sem-rojo/10 text-red-800', texto: 'Bloqueado', quien: 'Sucursal' },
  esperando_sucursal: {
    punto: 'bg-sem-amarillo',
    fondo: 'bg-sem-amarillo/15 text-amber-900',
    texto: 'Esperando sucursal',
    quien: 'Sucursal',
  },
  para_presentar: {
    punto: 'bg-etapa-auditoria',
    fondo: 'bg-etapa-auditoria/10 text-blue-800',
    texto: 'Para presentar',
    quien: 'Auditoría',
  },
  esperando_pago: {
    punto: 'bg-etapa-compania',
    fondo: 'bg-etapa-compania/10 text-violet-800',
    texto: 'Esperando pago',
    quien: 'Compañía',
  },
  cobrado: { punto: 'bg-sem-verde', fondo: 'bg-sem-verde/15 text-emerald-800', texto: 'Cobrado', quien: '—' },
  no_aplica: { punto: 'bg-slate-400', fondo: 'bg-slate-100 text-slate-600', texto: 'No aplica', quien: '—' },
}

export const ETAPAS_ACTIVAS: Etapa[] = ['bloqueado', 'esperando_sucursal', 'para_presentar', 'esperando_pago']

export function nombreEtapa(etapa: Etapa): string {
  return ESTILO_ETAPA[etapa].texto
}

export function quienEtapa(etapa: Etapa): string {
  return ESTILO_ETAPA[etapa].quien
}

export function PuntoEtapa({ etapa }: { etapa: Etapa }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${ESTILO_ETAPA[etapa].punto}`}
      aria-label={ESTILO_ETAPA[etapa].texto}
    />
  )
}

export function BadgeEtapa({ etapa }: { etapa: Etapa }) {
  const estilo = ESTILO_ETAPA[etapa]
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${estilo.fondo}`}
    >
      <PuntoEtapa etapa={etapa} />
      {estilo.texto}
    </span>
  )
}

/** Punto del semáforo clásico (rojo / amarillo / verde). */
const PUNTO_SEMAFORO: Record<ColorSemaforo, string> = {
  rojo: 'bg-sem-rojo',
  amarillo: 'bg-sem-amarillo',
  verde: 'bg-sem-verde',
  neutro: 'bg-slate-400',
}

export function PuntoSemaforo({ color }: { color: ColorSemaforo }) {
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${PUNTO_SEMAFORO[color]}`} />
}

export const NOMBRE_ESTADO: Record<EstadoComprobante, string> = {
  pendiente_drive: 'Sin legajo',
  en_gestion: 'En gestión',
  presentada: 'Presentada',
  cobrada: 'Cobrada',
  anulada: 'Anulada',
  nota_credito: 'Nota de crédito',
}

/** Chip neutro para textos cortos (niveles, avisos). */
export function Chip({ children, tono = 'gris' }: { children: string; tono?: 'gris' | 'rojo' | 'amarillo' | 'verde' | 'azul' }) {
  const clases = {
    gris: 'bg-slate-100 text-slate-700',
    rojo: 'bg-sem-rojo/10 text-red-800',
    amarillo: 'bg-sem-amarillo/15 text-amber-900',
    verde: 'bg-sem-verde/15 text-emerald-800',
    azul: 'bg-marca/10 text-blue-800',
  }[tono]
  return <span className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ${clases}`}>{children}</span>
}
