import { useMemo, useState } from 'react'
import { EncabezadoPagina } from '../components/ui/Card'
import { FiltroRapido } from '../components/ui/FiltroRapido'
import { PestanasSucursales } from '../components/PestanasSucursales'
import { Tabla, type Columna } from '../components/ui/Tabla'
import { useApp, useComprobantes } from '../context/AppContext'
import { NOMBRE_PEDIDO, pedidosAbiertos, type PedidoAbierto } from '../domain/pedidos'
import { descargarExcel, fechaExcel } from '../lib/exportar'
import { formatoComprobante, formatoFecha, formatoPesos } from '../lib/formato'

/**
 * Pedidos a sucursales: todo lo que Auditoría está esperando de las sucursales (errores de
 * factura, refacturaciones, notas de crédito sin avisar), con cuántos días lleva cada uno. Así no
 * hace falta acordarse a quién se le pidió qué: lo que la sucursal respondió queda para cerrar.
 */
export default function Pedidos() {
  const { hoy, abrirLegajo } = useApp()
  const comprobantes = useComprobantes()
  const lista = useMemo(() => pedidosAbiertos(comprobantes, hoy), [comprobantes, hoy])
  const [ver, setVer] = useState<'esperando' | 'respondido' | 'todos' | 'viejos'>('todos')
  const filas = lista.filter((p) => ver === 'todos' || (ver === 'viejos' ? p.estado === 'esperando' && p.dias > 7 : p.estado === ver))
  const esperando = lista.filter((p) => p.estado === 'esperando')
  const respondidos = lista.filter((p) => p.estado === 'respondido')
  const viejos = esperando.filter((p) => p.dias > 7).length

  const columnas: Columna<PedidoAbierto>[] = [
    { clave: 'comprobante', movil: 'titulo', titulo: 'Comprobante', celda: (p) => <span className="whitespace-nowrap font-medium">{formatoComprobante(p.c)}</span> },
    { clave: 'sucursal', titulo: 'Sucursal', filtro: (p) => p.c.sucursal, celda: (p) => <span className="whitespace-nowrap">{p.c.sucursal}</span> },
    { clave: 'tipo', titulo: 'Pedido', filtro: (p) => NOMBRE_PEDIDO[p.pedido.tipo], celda: (p) => <span className="whitespace-nowrap font-semibold">{NOMBRE_PEDIDO[p.pedido.tipo]}</span> },
    {
      clave: 'detalle',
      movil: 'ancha',
      titulo: 'Detalle',
      celda: (p) => (
        <span className="block min-w-[16rem] max-w-md text-xs text-slate-700">
          {p.pedido.detalle}
          {p.pedido.respuesta && <span className="mt-0.5 block font-semibold text-teal-800">Respuesta: {p.pedido.respuesta.texto}</span>}
        </span>
      ),
    },
    { clave: 'total', titulo: 'Importe', derecha: true, orden: (p) => p.c.total, celda: (p) => <span className="whitespace-nowrap tabular-nums">{formatoPesos(p.c.total)}</span> },
    { clave: 'desde', titulo: 'Desde', orden: (p) => p.pedido.fecha, celda: (p) => <span className="whitespace-nowrap">{formatoFecha(p.pedido.fecha)}</span> },
    {
      clave: 'dias',
      titulo: 'Días',
      derecha: true,
      orden: (p) => p.dias,
      celda: (p) => <span className={`font-semibold tabular-nums ${p.estado === 'esperando' && p.dias > 7 ? 'text-sem-rojo' : ''}`}>{p.dias}</span>,
    },
    {
      clave: 'estado',
      movil: 'accion',
      titulo: 'Estado',
      celda: (p) =>
        p.estado === 'esperando' ? (
          <span className="whitespace-nowrap rounded-md bg-sem-amarillo/15 px-2 py-0.5 text-xs font-semibold text-amber-900">Esperando a la sucursal</span>
        ) : (
          <span className="whitespace-nowrap rounded-md bg-sem-verde/15 px-2 py-0.5 text-xs font-semibold text-teal-800">Respondido: falta cerrar</span>
        ),
    },
  ]

  function exportar(l: PedidoAbierto[]) {
    descargarExcel(
      `pedidos-a-sucursales-${hoy}`,
      ['Comprobante', 'Sucursal', 'Pedido', 'Detalle', 'Importe', 'Desde', 'Días', 'Estado', 'Respuesta'],
      l.map((p) => [
        formatoComprobante(p.c),
        p.c.sucursal,
        NOMBRE_PEDIDO[p.pedido.tipo],
        p.pedido.detalle,
        p.c.total,
        fechaExcel(p.pedido.fecha),
        p.dias,
        p.estado === 'esperando' ? 'Esperando a la sucursal' : 'Respondido',
        p.pedido.respuesta?.texto ?? '',
      ]),
    )
  }

  return (
    <>
      <EncabezadoPagina titulo="Pendientes de sucursales" sucursal />
      <PestanasSucursales />
      <FiltroRapido
        opciones={[
          { clave: 'todos', titulo: 'Todos', cantidad: lista.length },
          { clave: 'esperando', titulo: 'Esperando a la sucursal', cantidad: esperando.length },
          { clave: 'viejos', titulo: 'Más de 7 días', cantidad: viejos, alerta: true },
          { clave: 'respondido', titulo: 'Respondidos: falta cerrar', cantidad: respondidos.length },
        ]}
        activa={ver}
        onElegir={(c) => setVer(c as typeof ver)}
      />
      <Tabla
        id="pedidos"
        key={ver}
        filas={filas}
        columnas={columnas}
        clave={(p) => p.pedido.id}
        onFila={(p) => abrirLegajo(p.c.id)}
        buscar={(p) => [formatoComprobante(p.c), p.c.siniestro, p.c.patente, p.c.sucursal, p.pedido.detalle].join(' ')}
        textoBusqueda="Buscar por número, sucursal o detalle"
        ordenInicial={{ clave: 'dias', dir: 'desc' }}
        exportar={exportar}
        resumen={(l) => `${l.length} ${l.length === 1 ? 'pedido' : 'pedidos'}`}
        vacio="Sin pedidos en esta lista."
      />
    </>
  )
}
