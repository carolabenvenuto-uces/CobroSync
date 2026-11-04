import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BookOpen, Building2, ClipboardCheck, Store } from 'lucide-react'
import { Isologo } from '../components/Logo'
import { BadgeEtapa } from '../components/ui/Badges'
import { useApp } from '../context/AppContext'
import { plazosActuales } from '../domain/plazos'
import { AUTORA, AUTORIA, PRODUCTO, VERSION } from '../lib/marca'

/**
 * Manual de uso: qué hace CobroSync y cómo se usa cada pantalla, por sector.
 *
 * Está armado como una lista de secciones (abajo, SECCIONES): para actualizarlo cuando cambia
 * algo, se edita el texto de la sección que corresponde. Cada sección dice para qué sector es.
 */
type Sector = 'todos' | 'sucursal' | 'gerencia' | 'auditoria'

interface Seccion {
  id: string
  sector: Sector
  titulo: string
  contenido: () => ReactNode
}

const Paso = ({ n, children }: { n: number; children: ReactNode }) => (
  <li className="flex gap-3">
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-marca text-xs font-bold text-white">{n}</span>
    <span className="pt-0.5">{children}</span>
  </li>
)
const Pasos = ({ children }: { children: ReactNode }) => <ol className="my-3 space-y-2">{children}</ol>
const Nota = ({ children }: { children: ReactNode }) => (
  <p className="my-3 rounded-lg border border-sem-amarillo/50 bg-amber-50 px-3 py-2 text-amber-950">{children}</p>
)
const Pantalla = ({ children }: { children: ReactNode }) => <strong className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-noche">{children}</strong>
const Etiqueta = ({ clase, children }: { clase: string; children: ReactNode }) => (
  <span className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ${clase}`}>{children}</span>
)

const SECCIONES: Seccion[] = [
  // ---------- Para todos ----------
  {
    id: 'que-es',
    sector: 'todos',
    titulo: '¿Qué es CobroSync?',
    contenido: () => (
      <>
        <p>
          CobroSync ordena el camino de cada factura a una compañía de seguros, desde que se emite hasta que se cobra: la sucursal sube la
          documentación, Auditoría la revisa y la presenta a la compañía, y Gerencia ve en qué estado está todo y cuánto falta cobrar.
        </p>
        <p className="mt-2">Cada persona entra con la cuenta de la empresa y ve solo lo que corresponde a su sector:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Sucursal:</strong> sube la factura y la orden firmada, corrige lo que se rechaza e informa las notas de crédito.
          </li>
          <li>
            <strong>Auditoría:</strong> revisa la documentación, presenta las facturas a las compañías y hace los reclamos.
          </li>
          <li>
            <strong>Gerencia:</strong> sigue los saldos, los atrasos por sucursal y lo que necesita su intervención.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'camino',
    sector: 'todos',
    titulo: 'El camino de una factura',
    contenido: () => (
      <>
        <p>Cada factura pasa por estas etapas. La etiqueta de color dice en cuál está y a quién le toca:</p>
        <ul className="mt-3 space-y-2">
          {(
            [
              ['doc_pendiente', 'Sucursal: falta subir la documentación, todavía dentro del plazo.'],
              ['doc_atrasada', 'Sucursal: falta la documentación y ya pasó el plazo.'],
              ['doc_observada', 'Sucursal: Auditoría o la compañía no aceptó un documento; hay que reemplazarlo.'],
              ['en_revision', 'Auditoría: la sucursal subió todo y Auditoría lo está revisando.'],
              ['pres_pendiente', 'Auditoría: documentación aprobada, falta presentarla a la compañía.'],
              ['al_dia', 'Compañía: presentada, todavía no venció el plazo de pago.'],
              ['vencida', 'Compañía: presentada, venció y no se cobró; Auditoría reclama.'],
              ['cobrado', 'Cobrada.'],
            ] as const
          ).map(([etapa, texto]) => (
            <li key={etapa} className="flex flex-wrap items-center gap-2">
              <BadgeEtapa etapa={etapa} />
              <span>{texto}</span>
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    id: 'colores',
    sector: 'todos',
    titulo: 'Qué significa cada color',
    contenido: () => (
      <>
        <p>En toda la plataforma, el mismo color quiere decir lo mismo:</p>
        <ul className="mt-3 space-y-2">
          <li>
            <Etiqueta clase="bg-sem-rojo/10 text-red-800">Rojo</Etiqueta> rechazado, observado o atrasado: hay que hacer algo ya.
          </li>
          <li>
            <Etiqueta clase="bg-red-800/10 text-red-900">Rojo oscuro</Etiqueta> vencido o crítico (lo más grave). También los importes que
            restan, como las notas de crédito, que llevan "−".
          </li>
          <li>
            <Etiqueta clase="bg-sem-amarillo/15 text-amber-900">Amarillo</Etiqueta> falta documentación, todavía en plazo; avisos importantes.
          </li>
          <li>
            <Etiqueta clase="bg-sky-500/10 text-sky-800">Celeste</Etiqueta> en revisión.
          </li>
          <li>
            <Etiqueta clase="bg-marca/10 text-blue-800">Azul</Etiqueta> botones principales, información y mensajes sin leer.
          </li>
          <li>
            <Etiqueta clase="bg-etapa-compania/10 text-violet-800">Violeta</Etiqueta> presentada y al día.
          </li>
          <li>
            <Etiqueta clase="bg-sem-verde/15 text-emerald-800">Verde</Etiqueta> aprobado o cobrado.
          </li>
          <li>
            <Etiqueta clase="bg-slate-100 text-slate-700">Gris</Etiqueta> informativo; no hace falta hacer nada.
          </li>
          <li>
            <Etiqueta clase="bg-noche text-white">! MiPyME</Etiqueta> factura MiPyME: tiene menos días de plazo, conviene hacerla primero.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'notificaciones',
    sector: 'todos',
    titulo: 'Notificaciones',
    contenido: () => (
      <>
        <p>
          <Pantalla>Notificaciones</Pantalla>, arriba de todo en el menú, funciona como un correo: a la izquierda la bandeja (lo no leído, en
          negrita y con un punto azul) y a la derecha el mensaje completo, con la factura y un botón para abrirla.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>El número al lado de "Notificaciones" es lo que falta leer.</li>
          <li>Al abrir un mensaje, o la factura de la que habla, queda marcado como leído.</li>
          <li>En la sucursal, los rechazos llevan una franja roja; los filtros separan rechazos y documentación faltante.</li>
          <li>El buscador de la bandeja encuentra un mensaje por número de factura o de siniestro.</li>
          <li>Se actualizan solas cada minuto; no hace falta recargar la página.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'tablas',
    sector: 'todos',
    titulo: 'Listas, filtros y Excel',
    contenido: () => (
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>Filtrar:</strong> debajo del título de cada columna hay un desplegable. Muestra solo las opciones que hay, con cuántas
          facturas tiene cada una. Se pueden combinar varios filtros; "Limpiar filtros" los saca a todos.
        </li>
        <li>
          <strong>Ordenar:</strong> con un clic en el título de la columna. Primer clic, de mayor a menor; segundo, de menor a mayor; tercero,
          vuelve al orden original. Las filas sin dato (por ejemplo, sin fecha) quedan siempre al final.
        </li>
        <li>
          <strong>Abrir una factura:</strong> con un clic en la fila. Se abre el legajo con sus documentos, su historial y lo que se puede hacer.
        </li>
        <li>
          <strong>Exportar a Excel:</strong> baja la lista tal como está filtrada, con cada dato en su columna.
        </li>
        <li>
          <strong>En el celular:</strong> cada fila se ve como una tarjeta; los filtros y el orden están en "Filtrar y ordenar".
        </li>
      </ul>
    ),
  },

  // ---------- Sucursal ----------
  {
    id: 'suc-plazo',
    sector: 'sucursal',
    titulo: 'El plazo para subir la documentación',
    contenido: () => {
      const p = plazosActuales()
      return (
        <>
          <p>
            Desde la fecha de la factura hay <strong>{p.comun} días</strong> para subir la <strong>factura</strong> y la{' '}
            <strong>orden firmada</strong> por el cliente. Si la factura es <strong>MiPyME</strong>, el plazo es de{' '}
            <strong>{p.mipyme} días</strong>, porque la compañía la acepta o la rechaza en pocos días.
          </p>
          <p className="mt-2">
            Después de {p.criticaComun} días ({p.criticaMipyme} si es MiPyME), la factura pasa a crítica y se avisa a Gerencia General.
          </p>
          <Nota>
            Si no es posible subirla a tiempo: dentro de la factura, el botón <strong>"Avisar fecha estimada de entrega"</strong> permite indicar
            el motivo y el día previsto. Auditoría sabe cuándo esperarla y la factura no figura como atrasada hasta esa fecha. Si la fecha pasa
            sin la documentación, se marca en rojo.
          </Nota>
          <p>Este aviso aparece la primera vez que se entra a Mis facturas y queda en el botón <strong>Plazos</strong>, arriba a la derecha.</p>
        </>
      )
    },
  },
  {
    id: 'suc-mis-facturas',
    sector: 'sucursal',
    titulo: 'Mis facturas: los cuatro estados',
    contenido: () => (
      <>
        <p>
          <Pantalla>Mis facturas</Pantalla> muestra en cuatro tarjetas en qué estado están las facturas de la sucursal. Cada tarjeta abre su
          listado en una pantalla aparte; con <strong>← Mis facturas</strong> o la cruz se vuelve.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Rechazos y observaciones:</strong> documentos que Auditoría o la compañía no aceptaron. El motivo dice quién lo rechazó y
            qué hay que cambiar.
          </li>
          <li>
            <strong>Por vencer o vencidas:</strong> facturas que pasaron el plazo o a las que les quedan 2 días o menos.
          </li>
          <li>
            <strong>Para subir:</strong> todas las facturas a las que les falta la factura o la orden firmada.
          </li>
          <li>
            <strong>En revisión:</strong> documentación ya enviada, que Auditoría está revisando. Sin tareas pendientes.
          </li>
        </ul>
        <p className="mt-2">
          En los rechazos y en las que están por vencer, primero van las <strong>MiPyME</strong> y después lo más atrasado; la casilla "Solo
          MiPyME" deja solo esas. Debajo de las tarjetas, el buscador encuentra cualquier factura de la sucursal.
        </p>
      </>
    ),
  },
  {
    id: 'suc-subir',
    sector: 'sucursal',
    titulo: 'Subir la documentación',
    contenido: () => (
      <>
        <h4 className="font-bold">De a una factura</h4>
        <Pasos>
          <Paso n={1}>
            En la tarjeta <strong>Para subir</strong> (o en la de rechazos), el botón <strong>Subir</strong> de la factura.
          </Paso>
          <Paso n={2}>El PDF de la factura y el de la orden firmada (o uno solo, si están escaneadas juntas).</Paso>
          <Paso n={3}>La factura pasa a "En revisión". Si Auditoría la observa, llega una notificación y aparece en Rechazos y observaciones.</Paso>
        </Pasos>
        <h4 className="mt-4 font-bold">Muchos archivos de una vez</h4>
        <Pasos>
          <Paso n={1}>
            El botón <strong>Subir varios PDF de una vez</strong>, arriba.
          </Paso>
          <Paso n={2}>
            Todos los PDF juntos. Cada uno va a su factura por el número del nombre: el punto de venta y el número, por ejemplo{' '}
            <code className="rounded bg-slate-100 px-1">35-11032 orden.pdf</code> o <code className="rounded bg-slate-100 px-1">35-11032 factura.pdf</code>.
          </Paso>
          <Paso n={3}>
            Lo que queda en rojo no se sube (no es PDF, o el número no es de una factura pendiente de la sucursal): hay que cambiarle el nombre y
            volver a soltarlo. Al final, <strong>Subir todo</strong>.
          </Paso>
        </Pasos>
        <Nota>
          Solo se aceptan <strong>PDF</strong>: las compañías no reciben fotos. Desde el celular, la cámara o Google Drive permiten escanear en
          PDF. Mientras un documento está en revisión, se puede quitar si hubo un error.
        </Nota>
        <p>Cada factura dice qué le falta: "+ Falta la orden firmada", "… Factura en revisión", "✓ Factura aprobada".</p>
      </>
    ),
  },
  {
    id: 'suc-nc',
    sector: 'sucursal',
    titulo: 'Informar una nota de crédito',
    contenido: () => (
      <>
        <p>Cuando una factura se anula, toda o una parte, hay que avisarlo para que Auditoría no la presente:</p>
        <Pasos>
          <Paso n={1}>
            En <Pantalla>Mis facturas</Pantalla>, el botón <strong>Informar una nota de crédito</strong>.
          </Paso>
          <Paso n={2}>La factura, si se anula completa o una parte (con el importe) y el motivo.</Paso>
          <Paso n={3}>Auditoría espera que la nota de crédito aparezca en el sistema y la asocia a la factura.</Paso>
        </Pasos>
        <p>Si después se vuelve a facturar, en Mis siniestros figura "Falta refacturar" hasta que esté la factura nueva.</p>
      </>
    ),
  },
  {
    id: 'suc-siniestros',
    sector: 'sucursal',
    titulo: 'Mis siniestros',
    contenido: () => (
      <>
        <p>
          <Pantalla>Mis siniestros</Pantalla> reúne todas las facturas de cada siniestro, con sus documentos (también los ya aprobados) y sus
          notas de crédito.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Lo más rápido es buscar por número de siniestro, patente o número de factura.</li>
          <li>Las compañías se despliegan; cada siniestro se abre con un clic.</li>
          <li>"En curso": con alguna factura sin cobrar. "Terminados": cobrados o anulados.</li>
          <li>
            Etiquetas: <Etiqueta clase="bg-amber-100 text-amber-900">Falta documentación</Etiqueta>{' '}
            <Etiqueta clase="bg-red-100 text-red-800">Falta refacturar</Etiqueta>{' '}
            <Etiqueta clase="bg-slate-200 text-slate-800">Con nota de crédito</Etiqueta> (esta última, solo informativa).
          </li>
        </ul>
      </>
    ),
  },

  // ---------- Gerencia ----------
  {
    id: 'ger-resumen',
    sector: 'gerencia',
    titulo: 'Resumen',
    contenido: () => (
      <>
        <p>
          <Pantalla>Resumen</Pantalla> muestra, para todas las sucursales o para una:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>El año:</strong> lo facturado, las notas de crédito (restan) y lo cobrado.
          </li>
          <li>
            <strong>El mes elegido:</strong> lo facturado, el cobro previsto (facturas presentadas que vencen en el mes) y lo cobrado, semana
            por semana. En los meses que ya pasaron, cuánto faltó cobrar.
          </li>
          <li>
            <strong>Pendiente de cobro hoy</strong>, en tres partes: <em>sin presentar</em> (esperando documentación o presentación),{' '}
            <em>al día</em> (presentado, sin vencer) y <em>vencido</em>. Cada tarjeta abre la lista de esas facturas.
          </li>
          <li>Las sucursales con más importe retenido y las compañías con más vencido.</li>
        </ul>
        <p className="mt-2">
          <strong>Imprimir o guardar en PDF</strong> arma una hoja A4 vertical para llevar a una reunión.
        </p>
      </>
    ),
  },
  {
    id: 'ger-informes',
    sector: 'gerencia',
    titulo: 'Ranking, Saldos e Impacto',
    contenido: () => (
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <Pantalla>Ranking de sucursales</Pantalla>: cuánto retiene cada sucursal por falta de documentación, cuántas facturas están en
          plazo, atrasadas o críticas, y si mejora o empeora.
        </li>
        <li>
          <Pantalla>Saldos por compañía</Pantalla>: facturado, notas de crédito, cobrado y pendiente de cada compañía, con lo vencido y los
          reclamos hechos.
        </li>
        <li>
          <Pantalla>Impacto económico</Pantalla>: cuánto cuesta en plata la demora en subir la documentación (los días de más que tarda en
          cobrarse).
        </li>
        <li>
          <Pantalla>Detalle de facturas</Pantalla>: todas las facturas con sus fechas (subida, aprobación, presentación, vencimiento y cobro),
          para buscar una puntual o exportar a Excel.
        </li>
      </ul>
    ),
  },
  {
    id: 'ger-avisos',
    sector: 'gerencia',
    titulo: 'Qué le llega a Gerencia',
    contenido: () => {
      const p = plazosActuales()
      return (
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Documentación crítica:</strong> facturas con más de {p.criticaComun} días sin documentación ({p.criticaMipyme} si es
            MiPyME), agrupadas por sucursal, para que intervenga ante la sucursal.
          </li>
          <li>
            <strong>Pedido de apoyo:</strong> compañías que no respondieron 3 reclamos de facturas vencidas.
          </li>
          <li>
            <strong>Mail de los lunes:</strong> un resumen de lo anterior. Si no hay nada pendiente, no se envía.
          </li>
        </ul>
      )
    },
  },

  // ---------- Auditoría ----------
  {
    id: 'aud-base',
    sector: 'auditoria',
    titulo: 'Auditoría (en preparación)',
    contenido: () => (
      <>
        <p>Esta parte del manual se completa cuando termine la revisión de las pantallas de Auditoría. Por ahora, en resumen:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <Pantalla>Avisos</Pantalla>: lo que hay que hacer hoy, por sector.
          </li>
          <li>
            <Pantalla>Pendientes de sucursales</Pantalla>: facturas esperando documentación, en plazo, atrasadas o críticas.
          </li>
          <li>
            <Pantalla>Control diario</Pantalla>: la carga del Excel del ERP y la revisión de documentos (aprobar u observar).
          </li>
          <li>
            <Pantalla>Presentar</Pantalla>: las facturas aprobadas, para armar el mail de presentación y marcarlas de una vez.
          </li>
          <li>
            <Pantalla>Vencidas y reclamos</Pantalla>: reclamos a las compañías, en lote.
          </li>
          <li>
            <Pantalla>Compañías</Pantalla>, <Pantalla>Usar mi planilla</Pantalla> y <Pantalla>Ajustes</Pantalla>: datos de las compañías,
            sincronización con la planilla de control, plazos y textos de las notificaciones.
          </li>
        </ul>
      </>
    ),
  },

  // ---------- Preguntas ----------
  {
    id: 'preguntas',
    sector: 'todos',
    titulo: 'Preguntas frecuentes',
    contenido: () => (
      <dl className="space-y-3">
        <div>
          <dt className="font-bold">¿Hace falta recargar la página para ver lo nuevo?</dt>
          <dd>No: los datos y las notificaciones se actualizan solos cada minuto.</dd>
        </div>
        <div>
          <dt className="font-bold">Se subió un archivo equivocado, ¿se puede quitar?</dt>
          <dd>Sí, mientras está en revisión: dentro de la factura, "Quitar" en ese documento. Una vez aprobado, hay que avisarle a Auditoría.</dd>
        </div>
        <div>
          <dt className="font-bold">¿Por qué no se puede subir un archivo?</dt>
          <dd>Tiene que ser PDF y tener en el nombre el punto de venta y el número de la factura (por ejemplo, 35-11032).</dd>
        </div>
        <div>
          <dt className="font-bold">¿Se puede usar desde el celular?</dt>
          <dd>Sí. Las listas se ven como tarjetas y se puede subir un PDF escaneado con la cámara.</dd>
        </div>
      </dl>
    ),
  },
]

const PESTANAS: { clave: Sector; titulo: string; icono: typeof Store }[] = [
  { clave: 'todos', titulo: 'Para todos', icono: BookOpen },
  { clave: 'sucursal', titulo: 'Sucursal', icono: Store },
  { clave: 'gerencia', titulo: 'Gerencia', icono: Building2 },
  { clave: 'auditoria', titulo: 'Auditoría', icono: ClipboardCheck },
]

export default function Manual({ suelto = false }: { suelto?: boolean }) {
  const { rol } = useApp()
  const [sector, setSector] = useState<Sector>(rol ?? 'todos')
  const visibles = SECCIONES.filter((s) => s.sector === 'todos' || s.sector === sector || sector === 'todos')
  // "Para todos" muestra lo general; cada sector, lo general primero y después lo suyo
  const lista = sector === 'todos' ? SECCIONES.filter((s) => s.sector === 'todos') : visibles

  const cuerpo = (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Manual de uso</h1>
          <p className="mt-1 text-sm text-slate-600">
            Cómo funciona {PRODUCTO} y qué hace cada pantalla, por sector.
          </p>
        </div>
        <span className="rounded-full bg-marca/10 px-3 py-1 text-xs font-semibold text-blue-800">
          v{VERSION}
        </span>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {PESTANAS.map((p) => (
          <button
            key={p.clave}
            type="button"
            onClick={() => setSector(p.clave)}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${sector === p.clave ? 'border-marca bg-marca text-white' : 'border-slate-200 bg-white hover:bg-fondo'}`}
          >
            <p.icono className="h-4 w-4" /> {p.titulo}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
        {/* Índice */}
        <nav className="hidden lg:block">
          <div className="sticky top-6 space-y-1 text-sm">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">En esta guía</div>
            {lista.map((s) => (
              <a key={s.id} href={`#${s.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' }) }} className="block rounded px-2 py-1 text-slate-600 hover:bg-white hover:text-noche">
                {s.titulo}
              </a>
            ))}
          </div>
        </nav>

        <div className="space-y-4">
          {lista.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-6 rounded-xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-700 shadow-sm">
              <h2 className="mb-2 text-lg font-extrabold text-noche">{s.titulo}</h2>
              {s.contenido()}
            </section>
          ))}
          <p className="pt-2 text-center text-xs text-slate-500">
            {AUTORIA} · © {new Date().getFullYear()} {AUTORA}
          </p>
        </div>
      </div>
    </div>
  )

  if (!suelto) return cuerpo
  // Desde la pantalla de ingreso, sin el menú
  return (
    <div className="min-h-screen bg-fondo px-4 py-8">
      <div className="mx-auto mb-6 flex max-w-4xl items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-marca hover:underline">
          <ArrowLeft className="h-4 w-4" /> Volver al ingreso
        </Link>
        <Isologo className="h-8 w-8" />
      </div>
      {cuerpo}
    </div>
  )
}
