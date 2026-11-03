import { useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarClock, Info, Receipt } from 'lucide-react'
import { LegajoPanel } from '../components/LegajoPanel'
import { NotaCreditoModal } from '../components/NotaCreditoModal'
import { Chip } from '../components/ui/Badges'
import { BotonExportar, Card, EncabezadoPagina, Indicador } from '../components/ui/Card'
import { claseSelect } from '../components/ui/Estados'
import { TODAS_LAS_SUCURSALES, useApp, useComprobantes } from '../context/AppContext'
import { calcularSemaforo, DIAS_ESCALAR_GERENCIA_GENERAL, PLAZO_ESCANEO_DIAS } from '../domain/semaforo'
import {
  avisoA,
  compromisoVencido,
  diasDeEspera,
  esperaALaSucursal,
  NOMBRE_NIVEL,
  nivelEscaneo,
  type NivelEscaneo,
} from '../domain/sucursales'
import { descargarExcel, fechaExcel } from '../lib/exportar'
import { formatoComprobante, formatoFecha, formatoPesos, formatoPesosCorto } from '../lib/formato'

const TONO_NIVEL = { en_plazo: 'amarillo', atrasado: 'rojo', critico: 'rojo' } as const

/**
 * Pendientes de las sucursales: lo que cada sucursal todavía tiene que subir o corregir.
 * Para el rol Sucursal es su pantalla de inicio ("Mis pendientes").
 */
export default function Pendientes() {
  const { datos, rol, sucursal, hoy } = useApp()
  const comprobantes = useComprobantes()
  const { aseguradoras, meta } = datos!
  const [params, setParams] = useSearchParams()
  const filtroNivel = (params.get('nivel') ?? 'todos') as NivelEscaneo | 'todos'
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null)
  const [modalNc, setModalNc] = useState(false)

  const filas = useMemo(
    () =>
      comprobantes
        .filter((c) => esperaALaSucursal(c, hoy))
        .map((c) => {
          const dias = diasDeEspera(c, hoy)
          const nivel = nivelEscaneo(dias)
          return {
            c,
            dias,
            nivel,
            semaforo: calcularSemaforo(c, hoy),
            sucursal: meta.sucursales.find((s) => s.nombre === c.sucursal),
          }
        })
        .sort((a, b) => b.dias - a.dias),
    [comprobantes, hoy, meta.sucursales],
  )
  const visibles = filas.filter((f) => filtroNivel === 'todos' || f.nivel === filtroNivel)

  const cuenta = (n: NivelEscaneo) => filas.filter((f) => f.nivel === n).length
  const compromisosVencidos = filas.filter((f) => compromisoVencido(f.c, hoy)).length
  const retenido = filas.reduce((s, f) => s + f.c.total, 0)
  const nombreCompania = (id: string) => aseguradoras.find((a) => a.id === id)?.nombre ?? id
  const seleccionado = comprobantes.find((c) => c.id === seleccionadoId) ?? null
  const esSucursal = rol === 'sucursal'
  const titulo = esSucursal ? `Mis pendientes · ${sucursal}` : 'Pendientes de sucursales'

  function filtrar(nivel: NivelEscaneo | 'todos') {
    setParams(nivel === 'todos' ? {} : { nivel }, { replace: true })
  }

  function exportar() {
    descargarExcel(
      `pendientes-sucursales-${hoy}`,
      ['Sucursal', 'Fecha factura', 'Comprobante', 'Compañía', 'Siniestro', 'Patente', 'Total', 'Días', 'Nivel', 'Qué falta', 'Compromiso', 'Motivo', 'Aviso a'],
      visibles.map((f) => [
        f.c.sucursal,
        fechaExcel(f.c.fecha),
        formatoComprobante(f.c),
        nombreCompania(f.c.aseguradoraId),
        f.c.siniestro,
        f.c.patente,
        f.c.total,
        f.dias,
        NOMBRE_NIVEL[f.nivel],
        f.semaforo.detalle.slice(1).join(' / ') || f.semaforo.detalle[0],
        fechaExcel(f.c.compromiso?.fecha ?? null),
        f.c.compromiso?.motivo ?? null,
        avisoA(f.nivel, f.sucursal),
      ]),
    )
  }

  return (
    <>
      <EncabezadoPagina
        titulo={titulo}
        subtitulo={
          esSucursal
            ? 'Facturas que todavía necesitan documentos de tu sucursal'
            : sucursal === TODAS_LAS_SUCURSALES
              ? 'Todas las sucursales'
              : sucursal
        }
        acciones={
          <>
            {esSucursal && (
              <button
                type="button"
                onClick={() => setModalNc(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-marca px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-marca-oscuro"
              >
                <Receipt className="h-4 w-4" /> Informar nota de crédito
              </button>
            )}
            <BotonExportar onClick={exportar} />
          </>
        }
      />

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-marca/20 bg-marca/5 px-4 py-3 text-sm text-blue-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          La sucursal tiene <strong>{PLAZO_ESCANEO_DIAS} días</strong> desde la factura para subir el legajo completo.
          Desde el día {PLAZO_ESCANEO_DIAS + 1} se avisa al gerente de la sucursal; desde el día{' '}
          {DIAS_ESCALAR_GERENCIA_GENERAL + 1}, también a la gerencia general.
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <BotonIndicador activo={filtroNivel === 'en_plazo'} onClick={() => filtrar('en_plazo')}>
          <Indicador titulo="En plazo" valor={String(cuenta('en_plazo'))} tono="amarillo" ayuda={`Hasta ${PLAZO_ESCANEO_DIAS} días`} />
        </BotonIndicador>
        <BotonIndicador activo={filtroNivel === 'atrasado'} onClick={() => filtrar('atrasado')}>
          <Indicador titulo="Atrasados" valor={String(cuenta('atrasado'))} tono="rojo" ayuda="Aviso al gerente de sucursal" />
        </BotonIndicador>
        <BotonIndicador activo={filtroNivel === 'critico'} onClick={() => filtrar('critico')}>
          <Indicador titulo="Críticos" valor={String(cuenta('critico'))} tono="rojo" ayuda="Aviso a gerencia general" />
        </BotonIndicador>
        <Indicador titulo="Compromisos vencidos" valor={String(compromisosVencidos)} ayuda="Fecha prometida ya pasada" />
        <Indicador titulo="Plata retenida" valor={formatoPesosCorto(retenido)} tono="marca" ayuda="No se puede presentar" />
      </div>

      <Card className="mt-4 overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <span className="text-sm text-slate-500">
            {visibles.length} facturas {filtroNivel !== 'todos' && `· ${NOMBRE_NIVEL[filtroNivel].toLowerCase()}`}
          </span>
          <select className={claseSelect} value={filtroNivel} onChange={(e) => filtrar(e.target.value as NivelEscaneo | 'todos')}>
            <option value="todos">Todos los niveles</option>
            <option value="en_plazo">En plazo</option>
            <option value="atrasado">Atrasados</option>
            <option value="critico">Críticos</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-fondo text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Días</th>
                {!esSucursal && <th className="px-3 py-3 font-semibold">Sucursal</th>}
                <th className="px-3 py-3 font-semibold">Factura</th>
                <th className="px-3 py-3 font-semibold">Compañía · siniestro</th>
                <th className="px-3 py-3 text-right font-semibold">Total</th>
                <th className="px-3 py-3 font-semibold">Qué falta</th>
                <th className="px-3 py-3 font-semibold">Compromiso</th>
                <th className="px-3 py-3 font-semibold">Aviso a</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibles.map((f) => {
                const vencido = compromisoVencido(f.c, hoy)
                return (
                  <tr key={f.c.id} onClick={() => setSeleccionadoId(f.c.id)} className="cursor-pointer hover:bg-marca/5">
                    <td className="px-4 py-3">
                      <div className="text-lg font-extrabold leading-none">{f.dias}</div>
                      <div className="mt-1">
                        <Chip tono={TONO_NIVEL[f.nivel]}>{NOMBRE_NIVEL[f.nivel]}</Chip>
                      </div>
                    </td>
                    {!esSucursal && <td className="px-3 py-3 whitespace-nowrap">{f.c.sucursal}</td>}
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="font-medium">{formatoComprobante(f.c)}</div>
                      <div className="text-xs text-slate-500">{formatoFecha(f.c.fecha)}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="whitespace-nowrap">{nombreCompania(f.c.aseguradoraId)}</div>
                      <div className="text-xs text-slate-500">
                        {f.c.siniestro} · {f.c.patente}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap font-semibold">{formatoPesos(f.c.total)}</td>
                    <td className="px-3 py-3 text-xs text-slate-700">
                      {(f.semaforo.detalle.length > 1 ? f.semaforo.detalle.slice(1) : f.semaforo.detalle).map((d) => (
                        <div key={d}>{d}</div>
                      ))}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {f.c.compromiso ? (
                        <div className={vencido ? 'font-semibold text-red-700' : 'text-slate-700'}>
                          <div className="flex items-center gap-1 whitespace-nowrap">
                            <CalendarClock className="h-3.5 w-3.5" />
                            {formatoFecha(f.c.compromiso.fecha)}
                            {vencido && ' · vencido'}
                          </div>
                          <div className="mt-0.5 text-slate-500">{f.c.compromiso.motivo}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400">Sin aviso</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs whitespace-nowrap text-slate-700">{avisoA(f.nivel, f.sucursal)}</td>
                  </tr>
                )
              })}
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    No hay pendientes. ¡Todo al día!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {seleccionado && <LegajoPanel comprobante={seleccionado} onCerrar={() => setSeleccionadoId(null)} />}
      {modalNc && <NotaCreditoModal onCerrar={() => setModalNc(false)} />}
    </>
  )
}

/** Hace clickeable una tarjeta de indicador para filtrar la tabla. */
function BotonIndicador({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl text-left transition ${activo ? 'ring-2 ring-marca' : 'hover:ring-2 hover:ring-slate-200'}`}
    >
      {children}
    </button>
  )
}
