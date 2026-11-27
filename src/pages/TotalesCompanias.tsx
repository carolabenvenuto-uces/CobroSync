import { useEffect, useMemo, useState } from 'react'
import { EncabezadoPagina, Indicador } from '../components/ui/Card'
import { Tabla, type Columna } from '../components/ui/Tabla'
import { useApp } from '../context/AppContext'
import { calcularTotales, saldosPorAseguradora } from '../domain/finanzas'
import { saldoFactura } from '../domain/importes'
import { calcularSemaforo, enGrupo, type GrupoSaldo } from '../domain/semaforo'
import type { Comprobante } from '../domain/tipos'
import { descargarExcel } from '../lib/exportar'
import { anioDe } from '../lib/fechas'
import { formatoFecha, formatoPesos } from '../lib/formato'
import { totalesDeCompaniasDeGoogle } from '../services/google'

/**
 * Compañías (usuario "Sucursal + compañías"): los totales de todo el grupo por compañía.
 * Sin sucursales ni facturas: con Google, el servidor manda solo importes, fechas y estados.
 */
export default function TotalesCompanias() {
  const { datos, hoy, anio, cuenta } = useApp()
  // La cuenta de una sucursal solo tiene sus facturas: las del grupo se piden aparte.
  // Cobranzas (Ver como) y la demo ya las tienen todas.
  const pedir = cuenta?.rol === 'sucursal'
  const [delGrupo, setDelGrupo] = useState<Comprobante[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!pedir) return
    totalesDeCompaniasDeGoogle()
      .then(setDelGrupo)
      .catch((e: Error) => setError(e.message || 'No se pudieron traer los totales.'))
  }, [pedir])
  const comprobantes = pedir ? delGrupo : (datos?.comprobantes ?? [])
  const aseguradoras = datos?.aseguradoras ?? []

  const suma = (lista: Comprobante[], g: GrupoSaldo) =>
    lista.filter((c) => enGrupo(g, calcularSemaforo(c, hoy).etapa, saldoFactura(c))).reduce((s, c) => s + saldoFactura(c), 0)

  const situacion = useMemo(() => {
    if (!comprobantes) return null
    return { ...calcularTotales(comprobantes, hoy), sinPresentar: suma(comprobantes, 'sin_presentar'), alDia: suma(comprobantes, 'al_dia') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comprobantes, hoy])

  const anual = useMemo(() => (comprobantes ? calcularTotales(comprobantes.filter((c) => anioDe(c.fecha) === anio), hoy) : null), [comprobantes, anio, hoy])

  const filas = useMemo(
    () =>
      comprobantes
        ? saldosPorAseguradora(comprobantes, aseguradoras, hoy)
            .map((s) => {
              const propias = comprobantes.filter((c) => c.aseguradoraId === s.aseguradora.id)
              return { ...s, sinPresentar: suma(propias, 'sin_presentar'), alDia: suma(propias, 'al_dia') }
            })
            .filter((s) => s.facturado !== 0 || s.notasCredito !== 0)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [comprobantes, aseguradoras, hoy],
  )
  type Fila = (typeof filas)[number]
  type Clave = 'facturado' | 'notasCredito' | 'cobrado' | 'pendiente' | 'sinPresentar' | 'alDia' | 'vencido'
  const sumar = (lista: Fila[], k: Clave) => lista.reduce((s, f) => s + f[k], 0)
  const CLAVES: Clave[] = ['facturado', 'notasCredito', 'cobrado', 'pendiente', 'sinPresentar', 'alDia', 'vencido']

  const pesos = (k: Clave, titulo: string, clase = ''): Columna<Fila> => ({
    clave: k,
    titulo,
    derecha: true,
    orden: (s) => s[k],
    celda: (s) => <span className={`whitespace-nowrap ${s[k] ? clase : 'text-slate-400'}`}>{s[k] ? formatoPesos(s[k]) : '—'}</span>,
  })
  const columnas: Columna<Fila>[] = [
    {
      clave: 'compania',
      titulo: 'Compañía',
      orden: (s) => s.aseguradora.nombre,
      celda: (s) => <span className="whitespace-nowrap font-semibold">{s.aseguradora.nombre}</span>,
    },
    pesos('facturado', 'Facturado'),
    pesos('notasCredito', 'Notas de crédito', 'text-red-800'),
    pesos('cobrado', 'Cobrado', 'text-teal-700'),
    pesos('pendiente', 'Pendiente total', 'font-semibold'),
    pesos('sinPresentar', 'Sin presentar'),
    pesos('alDia', 'Al día'),
    pesos('vencido', 'Vencido', 'font-semibold text-red-800'),
  ]

  function exportar(lista: Fila[]) {
    descargarExcel(
      `companias-${hoy}`,
      ['Compañía', 'Facturado', 'Notas de crédito', 'Cobrado', 'Pendiente total', 'Sin presentar', 'Al día', 'Vencido'],
      [...lista.map((s) => [s.aseguradora.nombre, ...CLAVES.map((k) => s[k])]), ['Total', ...CLAVES.map((k) => sumar(lista, k))]],
    )
  }

  const pct = (v: number) => (situacion && situacion.pendiente > 0 ? Math.round((v / situacion.pendiente) * 100) : 0)
  const celdaPie = 'px-3 py-3 text-right whitespace-nowrap tabular-nums'

  return (
    <>
      <EncabezadoPagina titulo="Compañías" subtitulo={`Todo el grupo · al ${formatoFecha(hoy)}`} />
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : !situacion || !anual ? (
        <p className="text-sm text-slate-500">Cargando los totales…</p>
      ) : (
        <>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-noche">Año {anio}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Indicador titulo="Facturado" valor={formatoPesos(anual.facturado)} />
            <Indicador titulo="Cobrado" punto="bg-sem-verde" valor={formatoPesos(anual.cobrado)} />
            <Indicador titulo="Notas de crédito" punto="bg-red-700" valor={formatoPesos(-Math.abs(anual.notasCredito))} />
            <Indicador titulo="Falta cobrar" punto="bg-sem-amarillo" valor={formatoPesos(Math.max(0, anual.facturado - anual.cobrado - Math.abs(anual.notasCredito)))} />
          </div>

          <div className="mb-2 mt-6 flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-noche">Pendiente de cobro hoy:</h2>
            <span className="text-xl font-extrabold tabular-nums text-marca">{formatoPesos(situacion.pendiente)}</span>
          </div>
          <div className="mb-3 flex h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            <div className="bg-sem-amarillo" style={{ width: `${pct(situacion.sinPresentar)}%` }} />
            <div className="bg-etapa-compania" style={{ width: `${pct(situacion.alDia)}%` }} />
            <div className="bg-red-800" style={{ width: `${pct(situacion.vencido)}%` }} />
          </div>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Indicador titulo="Sin presentar" punto="bg-sem-amarillo" valor={formatoPesos(situacion.sinPresentar)} ayuda={`${pct(situacion.sinPresentar)} % · esperando documentación o presentación`} />
            <Indicador titulo="Al día" punto="bg-etapa-compania" valor={formatoPesos(situacion.alDia)} ayuda={`${pct(situacion.alDia)} % · presentado, todavía no vence`} />
            <Indicador titulo="Vencido" punto="bg-red-800" tono="rojo" valor={formatoPesos(situacion.vencido)} ayuda={`${pct(situacion.vencido)} % · presentado, vencido y sin cobrar`} />
          </div>

          <Tabla
            filas={filas}
            columnas={columnas}
            clave={(s) => s.aseguradora.id}
            buscar={(s) => s.aseguradora.nombre}
            textoBusqueda="Buscar compañía"
            ordenInicial={{ clave: 'pendiente', dir: 'desc' }}
            exportar={exportar}
            resumen={(l) => <><strong>{l.length}</strong> compañías</>}
            pie={(l) => (
              <tr>
                <td className="px-3 py-3">Total</td>
                {CLAVES.map((k) => (
                  <td key={k} className={`${celdaPie} ${k === 'vencido' ? 'text-red-800' : ''}`}>{formatoPesos(sumar(l, k))}</td>
                ))}
              </tr>
            )}
          />
        </>
      )}
    </>
  )
}
