import { Zap } from 'lucide-react'
import type { ColorSemaforo, EstadoComprobante, Etapa } from '../../domain/tipos'

/**
 * Cada etapa tiene su color y el nombre que se usa en la planilla de control,
 * para que se entienda a simple vista de quién depende la factura:
 *  rojo = documentación atrasada u observada · amarillo = doc. pendiente en plazo
 *  azul = presentación pendiente (Auditoría) · violeta = al día (compañía)
 *  rojo oscuro = vencida · verde = cobrado · gris = no aplica
 */
const ESTILO_ETAPA: Record<Etapa, { punto: string; fondo: string; texto: string; quien: string }> = {
  doc_atrasada: { punto: 'bg-sem-rojo', fondo: 'bg-sem-rojo/10 text-red-800', texto: 'Doc. atrasada', quien: 'Sucursal' },
  doc_observada: { punto: 'bg-sem-rojo', fondo: 'bg-sem-rojo/10 text-red-800', texto: 'Doc. observada', quien: 'Sucursal' },
  doc_pendiente: {
    punto: 'bg-sem-amarillo',
    fondo: 'bg-sem-amarillo/15 text-amber-900',
    texto: 'Doc. pendiente',
    quien: 'Sucursal',
  },
  en_revision: {
    punto: 'bg-sky-500',
    fondo: 'bg-sky-500/10 text-sky-800',
    texto: 'En revisión',
    quien: 'Auditoría',
  },
  pres_pendiente: {
    punto: 'bg-etapa-auditoria',
    fondo: 'bg-etapa-auditoria/10 text-indigo-800',
    texto: 'Pres. pendiente',
    quien: 'Auditoría',
  },
  al_dia: { punto: 'bg-etapa-compania', fondo: 'bg-etapa-compania/10 text-blue-800', texto: 'Al día', quien: 'Compañía' },
  vencida: { punto: 'bg-red-800', fondo: 'bg-red-800/10 text-red-900', texto: 'Vencida', quien: 'Compañía' },
  cobrado: { punto: 'bg-sem-verde', fondo: 'bg-sem-verde/15 text-teal-800', texto: 'Cobrado', quien: '—' },
  no_aplica: { punto: 'bg-slate-400', fondo: 'bg-slate-100 text-slate-600', texto: 'Anulada / NC', quien: '—' },
  anterior: { punto: 'bg-slate-300', fondo: 'bg-slate-100 text-slate-600', texto: 'Gestión anterior', quien: '—' },
}

/** Qué significa cada etapa, para mostrar como ayuda. */
export const AYUDA_ETAPA: Record<Etapa, string> = {
  doc_pendiente: 'Falta documentación de la sucursal, dentro del plazo (10 días; 5 si es MiPyME)',
  doc_atrasada: 'Falta documentación de la sucursal y ya pasó el plazo (10 días; 5 si es MiPyME)',
  doc_observada: 'Auditoría observó un documento: la sucursal tiene que reemplazarlo',
  en_revision: 'La sucursal subió todo: Auditoría tiene que revisarlo y tildarlo',
  pres_pendiente: 'Legajo completo: falta presentarlo a la compañía',
  al_dia: 'Presentada, todavía no venció',
  vencida: 'Presentada, vencida y sin cobrar: hay que reclamar',
  cobrado: 'Cobrada',
  no_aplica: 'Nota de crédito o factura anulada',
  anterior: 'Anterior a CobroSync: la documentación está en el Drive de la empresa y no se pide en la plataforma',
}

/** Etapas abiertas, en el orden en que avanza una factura. */
export const ETAPAS_ACTIVAS: Etapa[] = ['doc_pendiente', 'doc_atrasada', 'doc_observada', 'en_revision', 'pres_pendiente', 'al_dia', 'vencida']

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
      title={AYUDA_ETAPA[etapa]}
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
export function Chip({ children, tono = 'gris' }: { children: string; tono?: 'gris' | 'rojo' | 'amarillo' | 'verde' | 'azul' | 'celeste' }) {
  const clases = {
    gris: 'bg-slate-100 text-slate-700',
    rojo: 'bg-sem-rojo/10 text-red-800',
    amarillo: 'bg-sem-amarillo/15 text-amber-900',
    verde: 'bg-sem-verde/15 text-teal-800',
    azul: 'bg-marca/10 text-indigo-800',
    celeste: 'bg-sky-500/10 text-sky-800',
  }[tono]
  return <span className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ${clases}`}>{children}</span>
}

/**
 * Marca de factura MiPyME: un rayo (menos días de plazo, va primero) y la palabra, en una pastilla
 * con borde. Sin signos sueltos que se confundan con los números de la factura.
 */
export function EtiquetaMipyme({ texto = 'MiPyME', chica = false }: { texto?: string; chica?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-noche/40 bg-white font-bold text-noche ${chica ? 'px-1 py-0 text-[10px]' : 'px-1.5 py-0.5 text-[11px]'}`}
      title="Factura MiPyME: tiene menos días de plazo"
    >
      <Zap className={chica ? 'h-2.5 w-2.5' : 'h-3 w-3'} aria-hidden="true" />
      {texto}
    </span>
  )
}
