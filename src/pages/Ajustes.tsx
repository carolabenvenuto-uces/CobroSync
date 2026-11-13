import { useMemo, useState } from 'react'
import { BellRing, CalendarClock, Mail, RotateCcw, Save, Timer } from 'lucide-react'
import { Card, CardTitulo, EncabezadoPagina } from '../components/ui/Card'
import { claseSelect } from '../components/ui/Estados'
import { useApp } from '../context/AppContext'
import { AVISOS_INICIALES, PLAZOS_INICIALES, type Ajustes as AjustesGuardados, type Plazos } from '../domain/plazos'
import { esperaALaSucursal } from '../domain/sucursales'
import { armarTexto, DATOS_DE_TEXTO, TEXTOS_INICIALES, type TextosAvisos } from '../domain/textos'
import { formatoPesos } from '../lib/formato'

/**
 * Ajustes de Cobranzas: los plazos de la documentación (común y MiPyME), cómo se reconoce una
 * factura MiPyME y los avisos por mail. Con Google se guardan en la pestaña Config.
 */
export default function Ajustes() {
  const { datos, hoy, fuente, guardarAjustes } = useApp()
  const { aseguradoras, meta, comprobantes } = datos!
  const [plazos, setPlazos] = useState<Plazos>({ ...PLAZOS_INICIALES, ...(meta.plazos ?? {}) })
  const [sinFce, setSinFce] = useState<Set<string>>(new Set(aseguradoras.filter((a) => a.recibeFce === false).map((a) => a.id)))
  const [avisos, setAvisos] = useState<AjustesGuardados['avisos']>(meta.avisos ?? AVISOS_INICIALES)
  const [textos, setTextos] = useState<TextosAvisos>({ ...TEXTOS_INICIALES, ...(meta.textos ?? {}) })
  const [puntos, setPuntos] = useState(plazos.puntosVentaMipyme.join(', '))
  const [estado, setEstado] = useState<{ texto: string; error?: boolean } | null>(null)
  const conGoogle = fuente.tipo === 'google'

  const plazosAGuardar: Plazos = { ...plazos, puntosVentaMipyme: puntos.split(/[^0-9]+/).filter(Boolean).map(Number) }

  // Cuántas facturas pendientes de documentación serían MiPyME con estos ajustes
  const vistaPrevia = useMemo(() => {
    const pendientes = comprobantes.filter((c) => esperaALaSucursal(c, hoy))
    const mipyme = pendientes.filter(
      (c) =>
        plazosAGuardar.puntosVentaMipyme.includes(c.puntoVenta) ||
        (!sinFce.has(c.aseguradoraId) && c.tipo === 'FC' && c.total >= plazosAGuardar.montoMinimoMipyme),
    )
    return { pendientes: pendientes.length, mipyme: mipyme.length }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comprobantes, hoy, sinFce, plazos.montoMinimoMipyme, puntos])

  const numero = (clave: keyof Omit<Plazos, 'puntosVentaMipyme'>, etiqueta: string, ayuda: string, max = 60) => (
    <label className="block text-xs font-semibold text-slate-500">
      {etiqueta}
      <input
        type="number"
        min={1}
        max={max}
        value={plazos[clave]}
        onChange={(e) => setPlazos({ ...plazos, [clave]: Math.max(1, Number(e.target.value) || 1) })}
        className={`${claseSelect} mt-1 block w-28`}
      />
      <span className="mt-1 block font-normal text-slate-400">{ayuda}</span>
    </label>
  )

  async function guardar() {
    const errores: string[] = []
    if (plazos.mipyme > plazos.comun) errores.push('el plazo MiPyME no puede ser más largo que el común')
    if (plazos.criticaComun <= plazos.comun) errores.push('las críticas tienen que ser más días que el plazo común')
    if (plazos.criticaMipyme <= plazos.mipyme) errores.push('las críticas MiPyME tienen que ser más días que su plazo')
    if (errores.length) {
      setEstado({ texto: `Falta corregir: ${errores.join('; ')}.`, error: true })
      return
    }
    try {
      setEstado({ texto: 'Guardando…' })
      await guardarAjustes({ plazos: plazosAGuardar, companiasSinFce: [...sinFce], avisos, textos })
      setEstado({ texto: conGoogle ? 'Listo: se guardó en la pestaña Config. Ya rige para todos.' : 'Listo: se guardó.' })
    } catch (e) {
      setEstado({ texto: e instanceof Error ? e.message : String(e), error: true })
    }
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Ajustes"
        subtitulo="Plazos de la documentación, facturas MiPyME, notificaciones y mails. Solo lo ve Cobranzas."
        acciones={
          <button
            type="button"
            onClick={() => void guardar()}
            className="inline-flex items-center gap-2 rounded-lg bg-marca px-4 py-2 text-sm font-semibold text-white hover:bg-marca-oscuro"
          >
            <Save className="h-4 w-4" /> Guardar
          </button>
        }
      />
      {estado && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${estado.error ? 'border-sem-rojo/30 bg-sem-rojo/5 text-red-900' : 'border-esmeralda/30 bg-esmeralda/5 text-teal-900'}`}
        >
          {estado.texto}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitulo>
            <span className="inline-flex items-center gap-2">
              <Timer className="h-4 w-4 text-marca" /> Plazos
            </span>
          </CardTitulo>
          <p className="-mt-2 mb-4 text-xs text-slate-500">
            Días corridos. Los de la sucursal se cuentan desde la fecha de la factura; la espera de un reclamo, desde el reclamo.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {numero('comun', 'Factura común', 'Después pasa a atrasada')}
            {numero('mipyme', 'Factura MiPyME', 'Más corto: la compañía tiene pocos días para aceptarla')}
            {numero('criticaComun', 'Crítica (común) desde', 'Le llega a Gerencia', 90)}
            {numero('criticaMipyme', 'Crítica (MiPyME) desde', 'Le llega a Gerencia', 90)}
            {numero('respuestaReclamo', 'Espera de respuesta a un reclamo', 'Después: volver a reclamar (con 3, pedir apoyo a Gerencia)', 30)}
          </div>
          {/* Inicio de CobroSync: lo anterior no se pide en la plataforma */}
          <label className="mt-4 block text-xs font-semibold text-slate-500">
            Inicio de CobroSync
            <input
              type="date"
              value={plazos.inicio ?? ''}
              onChange={(e) => setPlazos({ ...plazos, inicio: e.target.value })}
              className={`${claseSelect} mt-1 block`}
            />
            <span className="mt-1 block font-normal text-slate-500">
              A las facturas de antes de esta fecha no se les pide la documentación en la plataforma (está en el Drive de la empresa), no se le
              pide a la sucursal ni genera avisos. Si ya se presentaron, se siguen la presentación, el cobro y los reclamos. Vacío: se pide
              todo.
            </span>
          </label>
        </Card>

        <Card>
          <CardTitulo>
            <span className="inline-flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-marca" /> Cómo se reconoce una factura MiPyME
            </span>
          </CardTitulo>
          <p className="-mt-2 mb-4 text-xs text-slate-500">
            En Quiter se ven iguales ("FC E"). Es MiPyME cuando va a una compañía que recibe factura de crédito y el total llega al monto mínimo vigente.
          </p>
          <div className="flex flex-wrap gap-4">
            <label className="block text-xs font-semibold text-slate-500">
              Monto mínimo (total)
              <input
                type="number"
                min={0}
                value={plazos.montoMinimoMipyme}
                onChange={(e) => setPlazos({ ...plazos, montoMinimoMipyme: Number(e.target.value) || 0 })}
                className={`${claseSelect} mt-1 block w-40`}
              />
              <span className="mt-1 block font-normal text-slate-400">{formatoPesos(plazos.montoMinimoMipyme)}</span>
            </label>
            <label className="block text-xs font-semibold text-slate-500">
              Puntos de venta solo MiPyME (opcional)
              <input value={puntos} onChange={(e) => setPuntos(e.target.value)} placeholder="por ejemplo 50" className={`${claseSelect} mt-1 block w-40`} />
              <span className="mt-1 block font-normal text-slate-400">Separados por coma</span>
            </label>
          </div>
          <div className="mt-4 text-xs font-semibold text-slate-500">Compañías que reciben factura de crédito MiPyME</div>
          <div className="mt-2 grid max-h-48 grid-cols-2 gap-x-4 gap-y-1 overflow-y-auto text-sm">
            {aseguradoras.map((a) => (
              <label key={a.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!sinFce.has(a.id)}
                  onChange={(e) => {
                    const n = new Set(sinFce)
                    if (e.target.checked) n.delete(a.id)
                    else n.add(a.id)
                    setSinFce(n)
                  }}
                />
                {a.nombre}
              </label>
            ))}
          </div>
          <p className="mt-3 rounded-lg bg-fondo px-3 py-2 text-xs text-slate-600">
            Con estos ajustes, <strong>{vistaPrevia.mipyme}</strong> de las {vistaPrevia.pendientes} facturas que hoy esperan documentación son MiPyME.
          </p>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitulo>
            <span className="inline-flex items-center gap-2">
              <BellRing className="h-4 w-4 text-marca" /> Textos de las notificaciones a Gerencia
            </span>
          </CardTitulo>
          <p className="-mt-2 mb-4 text-xs text-slate-500">
            Entre llaves van los datos que completa CobroSync: {DATOS_DE_TEXTO.map((d) => (
              <code key={d} className="mx-0.5 rounded bg-fondo px-1 py-0.5 text-[11px] text-noche">{d}</code>
            ))}
            . Abajo de cada uno se ve cómo queda.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {(
              [
                { clave: 'apoyo', titulo: 'La compañía no responde 3 reclamos', ejemplo: { compania: 'Sancor', cantidad: 2 } },
                { clave: 'critica', titulo: 'Facturas críticas por falta de documentación', ejemplo: { sucursal: 'Alvarez Thomas', cantidad: 5, dias: plazos.criticaComun } },
              ] as const
            ).map((t) => (
              <label key={t.clave} className="block text-xs font-semibold text-slate-500">
                <span className="flex items-center justify-between">
                  {t.titulo}
                  {textos[t.clave] !== TEXTOS_INICIALES[t.clave] && (
                    <button
                      type="button"
                      onClick={() => setTextos({ ...textos, [t.clave]: TEXTOS_INICIALES[t.clave] })}
                      className="inline-flex items-center gap-1 font-normal text-marca hover:underline"
                    >
                      <RotateCcw className="h-3 w-3" /> Texto original
                    </button>
                  )}
                </span>
                <textarea
                  rows={3}
                  value={textos[t.clave]}
                  onChange={(e) => setTextos({ ...textos, [t.clave]: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-noche focus:border-marca focus:outline-none"
                />
                <span className="mt-1 block rounded-lg bg-fondo px-3 py-2 font-normal text-slate-700">
                  {armarTexto(textos[t.clave] || TEXTOS_INICIALES[t.clave], t.ejemplo)}
                </span>
              </label>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitulo>
            <span className="inline-flex items-center gap-2">
              <Mail className="h-4 w-4 text-marca" /> Avisos por mail
            </span>
          </CardTitulo>
          <ul className="-mt-2 mb-4 list-disc space-y-1 pl-5 text-xs text-slate-600">
            <li>Salen solo los <strong>lunes a las 8</strong>. Si no hay nada pendiente, no sale ningún mail.</li>
            <li>Al gerente de cada sucursal: sus facturas que pasaron el plazo (su correo está en la pestaña Sucursales).</li>
            <li>A Gerencia General: las compañías que no respondieron 3 reclamos y las facturas críticas, agrupadas.</li>
            <li>Durante la semana, todos lo ven en las notificaciones de CobroSync.</li>
          </ul>
          <div className="flex flex-wrap items-end gap-6">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={avisos.porMail} onChange={(e) => setAvisos({ ...avisos, porMail: e.target.checked })} />
              Mandar los mails de los lunes
            </label>
            <label className="block flex-1 text-xs font-semibold text-slate-500">
              Correos de Gerencia General
              <input
                value={avisos.correosGerencia}
                onChange={(e) => setAvisos({ ...avisos, correosGerencia: e.target.value })}
                placeholder="nombre@empresa.com.ar, otro@empresa.com.ar"
                className={`${claseSelect} mt-1 block w-full max-w-xl`}
              />
            </label>
          </div>
          <label className="mt-4 block text-xs font-semibold text-slate-500">
            Correo para los reportes de problemas técnicos (solo la desarrolladora)
            <input
              type="email"
              value={avisos.correoSoporte ?? ''}
              onChange={(e) => setAvisos({ ...avisos, correoSoporte: e.target.value })}
              placeholder="nombre@empresa.com.ar"
              className={`${claseSelect} mt-1 block w-full max-w-md`}
            />
            <span className="mt-1 block font-normal text-slate-500">Los avisos de Soporte técnico llegan solo a este correo, no al resto del sector.</span>
          </label>
          <label className="mt-4 block text-xs font-semibold text-slate-500">
            Nombre de quien da soporte
            <input
              value={avisos.nombreSoporte ?? ''}
              onChange={(e) => setAvisos({ ...avisos, nombreSoporte: e.target.value })}
              placeholder="Nombre y apellido"
              className={`${claseSelect} mt-1 block w-full max-w-md`}
            />
            <span className="mt-1 block font-normal text-slate-500">Aparece en la ventana de Soporte técnico, para que se sepa a quién se le escribe. El correo no se muestra.</span>
          </label>
        </Card>
      </div>
    </>
  )
}
