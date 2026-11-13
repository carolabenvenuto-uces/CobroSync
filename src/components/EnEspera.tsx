import { useState } from 'react'
import { ChevronDown, ChevronUp, Clock, Trash2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { DIAS_ESPERA_REVISAR } from '../domain/espera'
import type { DocumentoEnEspera } from '../domain/tipos'
import { diffDias } from '../lib/fechas'
import { formatoFecha } from '../lib/formato'

const NOMBRE_TIPO: Record<DocumentoEnEspera['tipo'], string> = { factura: 'Factura', orden: 'Orden firmada', documentacion: 'Factura y orden' }

function Lista({ lista, conSucursal }: { lista: DocumentoEnEspera[]; conSucursal: boolean }) {
  const { hoy, descartarEspera } = useApp()
  const [quitando, setQuitando] = useState<string | null>(null)
  return (
    <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">
      {[...lista]
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .map((e) => {
          const dias = diffDias(e.fecha, hoy)
          const revisar = dias > DIAS_ESPERA_REVISAR
          return (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span>
                <span className="font-semibold">
                  {e.puntoVenta}-{e.numero}
                </span>
                <span className="ml-2 text-xs text-slate-500">
                  {NOMBRE_TIPO[e.tipo]}
                  {e.siniestro ? ` · Siniestro ${e.siniestro}` : ''}
                  {conSucursal ? ` · ${e.sucursal}` : ''} · {formatoFecha(e.fecha)}
                </span>
                {revisar && (
                  <span className="ml-2 text-xs font-semibold text-red-800">
                    {dias} días sin factura: revisar el número
                  </span>
                )}
              </span>
              <span className="flex items-center gap-3 text-xs">
                {e.url && (
                  <a href={e.url} target="_blank" rel="noreferrer" className="font-semibold text-marca hover:underline">
                    Ver PDF
                  </a>
                )}
                <button
                  type="button"
                  disabled={quitando === e.id}
                  onClick={async () => {
                    setQuitando(e.id)
                    try {
                      await descartarEspera(e.id)
                    } finally {
                      setQuitando(null)
                    }
                  }}
                  className="inline-flex items-center gap-1 text-slate-500 hover:text-sem-rojo disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Quitar
                </button>
              </span>
            </li>
          )
        })}
    </ul>
  )
}

/**
 * Cobranzas: PDF que las sucursales subieron de facturas todavía no cargadas. Se unen solos al
 * cargar el ERP; los que llevan varios días sin su factura suelen tener el número mal tipeado.
 */
export function EnEsperaAuditoria() {
  const { datos, hoy } = useApp()
  const [abierta, setAbierta] = useState(false)
  const lista = (datos?.enEspera ?? []).filter((e) => !e.asociado)
  if (!lista.length) return null
  const viejos = lista.filter((e) => diffDias(e.fecha, hoy) > DIAS_ESPERA_REVISAR).length
  return (
    <div className={`mb-4 rounded-lg border px-4 py-3 ${viejos ? 'border-sem-rojo/30 bg-sem-rojo/5' : 'border-slate-200 bg-white'}`}>
      <button type="button" onClick={() => setAbierta((v) => !v)} className="flex w-full items-center justify-between gap-2 text-left text-sm">
        <span className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-marca" />
          <strong>{lista.length} PDF en espera</strong>
          <span className="text-slate-600">de facturas que todavía no están en el ERP: se unen solos al cargarlo</span>
          {viejos > 0 && <span className="font-semibold text-red-800">· {viejos} para revisar</span>}
        </span>
        {abierta ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {abierta && <Lista lista={lista} conSucursal />}
    </div>
  )
}

/** Sucursal: lo que subió de facturas de hoy, hasta que se cargue el ERP. */
export function EnEsperaSucursal() {
  const { datos } = useApp()
  const [abierta, setAbierta] = useState(false)
  const lista = (datos?.enEspera ?? []).filter((e) => !e.asociado)
  if (!lista.length) return null
  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
      <button type="button" onClick={() => setAbierta((v) => !v)} className="flex w-full items-center justify-between gap-2 text-left text-sm">
        <span className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-marca" />
          <strong>{lista.length} PDF de facturas de hoy</strong>
          <span className="text-slate-600">se unen a su factura cuando Cobranzas cargue el ERP</span>
        </span>
        {abierta ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {abierta && <Lista lista={lista} conSucursal={false} />}
    </div>
  )
}
