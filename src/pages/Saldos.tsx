import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { EncabezadoPagina } from '../components/ui/Card'
import { Tabla, type Columna } from '../components/ui/Tabla'
import { useApp, useComprobantes } from '../context/AppContext'
import { saldosPorAseguradora } from '../domain/finanzas'
import { estadoReclamo, ultimoReclamo } from '../domain/reclamos'
import { calcularSemaforo } from '../domain/semaforo'
import { descargarExcel } from '../lib/exportar'
import { formatoFecha, formatoPesos } from '../lib/formato'

/**
 * Saldos por compañía: como el "Detalle por compañía" de la planilla, separando lo
 * pendiente en sin presentar, al día y vencido, y lo vencido según si ya se reclamó.
 */
export default function Saldos() {
  const { datos, hoy, rol } = useApp()
  const comprobantes = useComprobantes()
  const { aseguradoras } = datos!

  const filas = useMemo(
    () =>
      saldosPorAseguradora(comprobantes, aseguradoras, hoy).map((s) => {
        const propias = comprobantes.filter((c) => c.aseguradoraId === s.aseguradora.id)
        const suma = (f: (c: (typeof propias)[number]) => boolean) => propias.filter(f).reduce((t, c) => t + c.total, 0)
        const etapa = (c: (typeof propias)[number]) => calcularSemaforo(c, hoy).etapa
        return {
          ...s,
          sinPresentar: suma((c) => ['doc_pendiente', 'doc_atrasada', 'doc_observada', 'pres_pendiente'].includes(etapa(c))),
          alDia: suma((c) => etapa(c) === 'al_dia'),
          vencidoSinReclamar: suma((c) => estadoReclamo(c, hoy) === 'sin_reclamar'),
          vencidoParaEscalar: suma((c) => estadoReclamo(c, hoy) === 'escalar'),
          facturasVencidas: propias.filter((c) => etapa(c) === 'vencida').length,
          // Seguimiento: reclamos hechos por las facturas que siguen sin cobrar
          ...(() => {
            const abiertas = propias.filter((c) => c.tipo === 'FC' && c.estado === 'presentada')
            const reclamadas = abiertas.filter((c) => c.reclamos.length > 0)
            const ultimo = reclamadas.map(ultimoReclamo).filter((f): f is string => !!f).sort().pop() ?? null
            return { reclamosHechos: reclamadas.reduce((t, c) => t + c.reclamos.length, 0), facturasReclamadas: reclamadas.length, ultimoReclamo: ultimo }
          })(),
        }
      }),
    [comprobantes, aseguradoras, hoy],
  )
  type Fila = (typeof filas)[number]
  type Clave = 'facturado' | 'notasCredito' | 'cobrado' | 'pendiente' | 'vencido' | 'sinPresentar' | 'alDia' | 'vencidoSinReclamar' | 'vencidoParaEscalar'
  const sumar = (lista: Fila[], k: Clave) => lista.reduce((s, f) => s + f[k], 0)
  const situacionReclamos = (s: Fila) =>
    s.vencido <= 0 ? 'Sin vencido' : s.vencidoParaEscalar > 0 ? 'Sin respuesta' : s.vencidoSinReclamar > 0 ? 'Sin reclamar' : 'Reclamado'

  function exportar(lista: Fila[]) {
    descargarExcel(
      `saldos-por-compania-${hoy}`,
      ['Compañía', 'Facturado', 'Notas de crédito', 'Cobrado', 'Pendiente total', 'Sin presentar', 'Al día', 'Vencido', 'Vencido sin reclamar', 'Vencido sin respuesta', 'Reclamos hechos', 'Facturas reclamadas', 'Último reclamo'],
      [
        ...lista.map((s) => [
          s.aseguradora.nombre,
          s.facturado,
          s.notasCredito,
          s.cobrado,
          s.pendiente,
          s.sinPresentar,
          s.alDia,
          s.vencido,
          s.vencidoSinReclamar,
          s.vencidoParaEscalar,
          s.reclamosHechos,
          s.facturasReclamadas,
          s.ultimoReclamo ? formatoFecha(s.ultimoReclamo) : null,
        ]),
        ['Total', sumar(lista, 'facturado'), sumar(lista, 'notasCredito'), sumar(lista, 'cobrado'), sumar(lista, 'pendiente'), sumar(lista, 'sinPresentar'), sumar(lista, 'alDia'), sumar(lista, 'vencido'), sumar(lista, 'vencidoSinReclamar'), sumar(lista, 'vencidoParaEscalar')],
      ],
    )
  }

  const pesos = (k: Clave, clase = '') => ({
    clave: k,
    derecha: true,
    orden: (s: Fila) => s[k],
    celda: (s: Fila) => <span className={`whitespace-nowrap ${clase}`}>{formatoPesos(s[k])}</span>,
  })
  const columnas: Columna<Fila>[] = [
    {
      clave: 'compania',
      titulo: 'Compañía',
      orden: (s) => s.aseguradora.nombre,
      filtro: (s) => s.aseguradora.nombre,
      celda: (s) => <span className="whitespace-nowrap font-semibold">{s.aseguradora.nombre}</span>,
    },
    { titulo: 'Facturado', ...pesos('facturado') },
    { titulo: 'Notas de crédito', ...pesos('notasCredito', 'text-slate-500') },
    { titulo: 'Cobrado', ...pesos('cobrado', 'text-emerald-700') },
    { titulo: 'Pendiente total', ...pesos('pendiente', 'font-semibold') },
    { titulo: 'Sin presentar', ...pesos('sinPresentar') },
    { titulo: 'Al día', ...pesos('alDia') },
    {
      clave: 'vencido',
      titulo: 'Vencido',
      derecha: true,
      orden: (s) => s.vencido,
      celda: (s) => (
        <div className={`whitespace-nowrap font-semibold ${s.vencido > 0 ? 'text-red-800' : 'text-slate-400'}`}>
          {s.vencido > 0 ? formatoPesos(s.vencido) : '—'}
          {s.facturasVencidas > 0 && <div className="text-xs font-normal text-slate-500">{s.facturasVencidas} facturas</div>}
        </div>
      ),
    },
    {
      clave: 'seguimiento',
      titulo: 'Reclamos hechos',
      derecha: true,
      orden: (s) => s.reclamosHechos,
      celda: (s) =>
        s.reclamosHechos === 0 ? (
          <span className="text-xs text-slate-400">—</span>
        ) : (
          <div className="whitespace-nowrap text-xs">
            <div className="font-semibold text-noche">
              {s.reclamosHechos} {s.reclamosHechos === 1 ? 'reclamo' : 'reclamos'} · {s.facturasReclamadas} {s.facturasReclamadas === 1 ? 'factura' : 'facturas'}
            </div>
            {s.ultimoReclamo && <div className="text-slate-500">Último: {formatoFecha(s.ultimoReclamo)}</div>}
          </div>
        ),
    },
    {
      clave: 'reclamos',
      titulo: 'Situación de lo vencido',
      filtro: situacionReclamos,
      celda: (s) =>
        s.vencido <= 0 ? (
          <span className="text-xs text-slate-400">—</span>
        ) : (
          <Link
            to={rol === 'auditoria' ? `/app/reclamos?compania=${s.aseguradora.id}` : '#'}
            className={`block space-y-0.5 text-xs ${rol === 'auditoria' ? 'hover:underline' : 'pointer-events-none'}`}
          >
            {s.vencidoSinReclamar > 0 && <div className="whitespace-nowrap font-semibold text-red-800">Sin reclamar: {formatoPesos(s.vencidoSinReclamar)}</div>}
            {s.vencidoParaEscalar > 0 && <div className="whitespace-nowrap font-semibold text-amber-800">Sin respuesta: {formatoPesos(s.vencidoParaEscalar)}</div>}
            {s.vencidoSinReclamar === 0 && s.vencidoParaEscalar === 0 && <div className="text-slate-600">Reclamado</div>}
          </Link>
        ),
    },
  ]

  const celdaPie = 'px-3 py-3 text-right whitespace-nowrap tabular-nums'

  return (
    <>
      <EncabezadoPagina titulo="Saldos por compañía" subtitulo="Cuenta corriente de cada compañía" sucursal />

      <Tabla
        filas={filas}
        columnas={columnas}
        clave={(s) => s.aseguradora.id}
        buscar={(s) => [s.aseguradora.nombre, s.aseguradora.razonSocial ?? '', s.aseguradora.cuit ?? ''].join(' ')}
        textoBusqueda="Buscar compañía, razón social o CUIT"
        ordenInicial={{ clave: 'pendiente', dir: 'desc' }}
        exportar={exportar}
        resumen={(l) => <><strong>{l.length}</strong> compañías</>}
        pie={(l) => (
          <tr>
            <td className="px-3 py-3">Total</td>
            <td className={celdaPie}>{formatoPesos(sumar(l, 'facturado'))}</td>
            <td className={celdaPie}>{formatoPesos(sumar(l, 'notasCredito'))}</td>
            <td className={celdaPie}>{formatoPesos(sumar(l, 'cobrado'))}</td>
            <td className={celdaPie}>{formatoPesos(sumar(l, 'pendiente'))}</td>
            <td className={celdaPie}>{formatoPesos(sumar(l, 'sinPresentar'))}</td>
            <td className={celdaPie}>{formatoPesos(sumar(l, 'alDia'))}</td>
            <td className={`${celdaPie} text-red-800`}>{formatoPesos(sumar(l, 'vencido'))}</td>
            <td className={celdaPie}>{l.reduce((t, s) => t + s.reclamosHechos, 0) || ''}</td>
            <td />
          </tr>
        )}
      />
      <p className="mt-3 text-xs text-slate-500">
        Pendiente total = facturado + notas de crédito − cobrado = sin presentar + al día + vencido.
      </p>
    </>
  )
}
