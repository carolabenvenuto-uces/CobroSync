import { useState, type ReactNode } from 'react'
import { reportarProblemaEnGoogle } from '../services/google'
import { Link } from 'react-router-dom'
import { ArrowLeft, BookOpen, Building2, ClipboardCheck, LifeBuoy, Send, Store } from 'lucide-react'
import { Isologo } from '../components/Logo'
import { BadgeEtapa, EtiquetaMipyme } from '../components/ui/Badges'
import { useApp } from '../context/AppContext'
import { plazosActuales } from '../domain/plazos'
import { AUTORIA, PRODUCTO, VERSION } from '../lib/marca'

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
            <Etiqueta clase="bg-red-800/10 text-red-900">Rojo oscuro</Etiqueta> vencido o crítico (lo más grave), y las notas de crédito.
          </li>
          <li>
            <Etiqueta clase="bg-sem-amarillo/15 text-amber-900">Amarillo</Etiqueta> falta documentación, todavía en plazo; avisos importantes.
          </li>
          <li>
            <Etiqueta clase="bg-orange-50 text-orange-900">Naranja</Etiqueta> la documentación está por vencer o ya venció.
          </li>
          <li>
            <Etiqueta clase="bg-sky-500/10 text-sky-800">Celeste</Etiqueta> en revisión.
          </li>
          <li>
            <Etiqueta clase="bg-marca/10 text-indigo-800">Lila</Etiqueta> botones principales, información y mensajes sin leer.
          </li>
          <li>
            <Etiqueta clase="bg-etapa-compania/10 text-blue-800">Azul</Etiqueta> presentada y al día.
          </li>
          <li>
            <Etiqueta clase="bg-sem-verde/15 text-teal-800">Verde agua</Etiqueta> aprobado o cobrado.
          </li>
          <li>
            <Etiqueta clase="bg-slate-100 text-slate-700">Gris</Etiqueta> informativo; no hace falta hacer nada.
          </li>
          <li>
            <EtiquetaMipyme /> factura MiPyME: tiene menos días de plazo, conviene hacerla primero.
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
          <Pantalla>Notificaciones</Pantalla>, arriba de todo en el menú, funciona como un correo: la bandeja a lo ancho, con lo no leído en
          negrita y con un punto azul. Al abrir un mensaje se lee completo, con la factura y un botón para abrirla; "Volver a la bandeja" regresa
          a la lista.</p>
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
            <strong>Para subir:</strong> todas las facturas a las que les falta la factura o la orden firmada.
          </li>
          <li>
            <strong>En revisión:</strong> documentación ya enviada, que Auditoría está revisando. Sin tareas pendientes.
          </li>
          <li>
            <strong>Por vencer o vencidas:</strong> facturas que pasaron el plazo o a las que les quedan 2 días o menos.
          </li>
          <li>
            <strong>Rechazos y observaciones:</strong> documentos que Auditoría o la compañía no aceptaron. El motivo dice quién lo rechazó y
            qué hay que cambiar.
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
          Solo se aceptan <strong>PDF</strong>. Desde el celular, el botón <strong>Foto</strong> de cada documento abre la cámara: cada foto
          es una página, se mejora para que se lea como un escaneo (con la opción de blanco y negro, más nítida) y se sube como PDF. Para
          mejor calidad, la hoja entera sobre un fondo oscuro, con buena luz y sin sombras. También sirven los escáneres del celular (Google
          Drive o la app Notas en iPhone). Mientras un documento está en revisión, se puede quitar si hubo un error.
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
          <Pantalla>Mis siniestros</Pantalla> funciona como una bandeja: a la izquierda la lista de siniestros (lo más reciente primero) y a la
          derecha el siniestro elegido, con sus importes y cada factura con sus documentos (también los ya aprobados).
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Búsqueda por número de siniestro, patente o número de factura; si hay un solo resultado, se abre solo.</li>
          <li>Filtros por compañía y por estado: en curso (algo sin cobrar) o terminados (cobrados o anulados).</li>
          <li>Las notas de crédito aparecen debajo de la factura que acreditan, con el importe en rojo y si anulan todo o una parte.</li>
          <li>Si una nota de crédito deja algo por volver a facturar, se indica como pendiente.</li>
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
            <strong>El año:</strong> lo facturado, las notas de crédito y lo cobrado.
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
    titulo: 'Auditoría: el día a día',
    contenido: () => (
      <>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <Pantalla>Control diario</Pantalla>: la carga del Excel del ERP (las filas van solas a la pestaña Quiter de la planilla) y la
            revisión de documentos: aprobar u observar cada uno.
          </li>
          <li>
            <Pantalla>Presentar</Pantalla>: una fila por compañía con lo aprobado y su canal (mail o plataforma). Al abrirla: elegir las
            facturas, <strong>descargar todos los documentos en un .zip</strong> (cada PDF con el número de factura en el nombre), armar el
            mail o abrir la plataforma, y marcarlas como presentadas. Vuelven acá las que la compañía pidió reenviar.
          </li>
          <li>
            <Pantalla>Vencidas y reclamos</Pantalla>: los botones de arriba muestran cada estado; al marcar facturas aparece la barra para registrar
            reclamos en lote y la respuesta de la compañía con un clic: pasa a pagos (se espera
            un mes), reenviar la documentación (vuelve a Presentar) o refacturar (pedido a la sucursal).
          </li>
          <li>
            <Pantalla>Pendientes de sucursales</Pantalla>, pestaña <strong>Pedidos</strong>: lo que se les pidió (errores de factura, refacturaciones, notas de crédito sin
            avisar), con los días de espera. Lo respondido queda para revisar y dar por resuelto. Los pedidos sin responder también salen
            en el mail de los lunes de cada sucursal.
          </li>
          <li>
            <Pantalla>Compañías</Pantalla>: por dónde se presenta a cada una y los días de tolerancia antes de reclamar a las que suelen
            pagar.
          </li>
        </ul>
        <Nota>
          Para no pisarse: al abrir una factura, o al preparar una presentación, queda tomada unos minutos a nombre de quien la abrió. La otra
          persona ve el aviso "La está presentando…" y no puede elegirla en Presentar.
        </Nota>
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
          <dd>Sí. Las listas se ven como tarjetas y, con el botón Foto, se sacan fotos de los documentos que se suben como PDF.</dd>
        </div>
      </dl>
    ),
  },
]

/** "¿Algo no funciona?": un mensaje que le llega por mail solo a la desarrolladora. */
function ReportarProblema({ conGoogle }: { conGoogle: boolean }) {
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState<{ tipo: 'nada' | 'enviando' | 'ok' | 'error'; mensaje?: string }>({ tipo: 'nada' })
  const enviar = async () => {
    if (!texto.trim()) return
    if (!conGoogle) {
      setEstado({ tipo: 'error', mensaje: 'El envío funciona en la versión conectada a la cuenta de la empresa.' })
      return
    }
    setEstado({ tipo: 'enviando' })
    try {
      await reportarProblemaEnGoogle(texto, { pantalla: window.location.hash, navegador: navigator.userAgent })
      setTexto('')
      setEstado({ tipo: 'ok' })
    } catch (e) {
      setEstado({ tipo: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo enviar.' })
    }
  }
  return (
    <section id="soporte" className="scroll-mt-6 rounded-xl border border-marca/30 bg-white p-5 text-sm text-slate-700 shadow-sm">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-extrabold text-noche">
        <LifeBuoy className="h-5 w-5 text-marca" /> ¿Algo no funciona?
      </h2>
      <p>
        Para un error técnico (una pantalla que no carga, un botón que no responde, un dato que se ve mal), el mensaje le llega directamente a la
        desarrolladora de {PRODUCTO}. Para dudas sobre una factura, el canal es Auditoría.
      </p>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={3}
        placeholder="Qué pasó, en qué pantalla y, si corresponde, con qué factura"
        className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/20"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={enviar}
          disabled={!texto.trim() || estado.tipo === 'enviando'}
          className="inline-flex items-center gap-2 rounded-lg bg-marca px-4 py-2 text-sm font-semibold text-white hover:bg-marca-oscuro disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> {estado.tipo === 'enviando' ? 'Enviando…' : 'Enviar a la desarrolladora'}
        </button>
        {estado.tipo === 'ok' && <span className="text-xs font-semibold text-teal-700">Enviado. Gracias por avisar.</span>}
        {estado.tipo === 'error' && <span className="text-xs font-semibold text-sem-rojo">{estado.mensaje}</span>}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">Se envía junto con el usuario, el sector y la pantalla, para poder revisarlo.</p>
    </section>
  )
}

const PESTANAS: { clave: Sector; titulo: string; icono: typeof Store }[] = [
  { clave: 'todos', titulo: 'Para todos', icono: BookOpen },
  { clave: 'sucursal', titulo: 'Sucursal', icono: Store },
  { clave: 'gerencia', titulo: 'Gerencia', icono: Building2 },
  { clave: 'auditoria', titulo: 'Auditoría', icono: ClipboardCheck },
]

export default function Manual({ suelto = false }: { suelto?: boolean }) {
  const { rol, fuente } = useApp()
  // Cada usuario ve lo general y lo de su sector. Auditoría (y quien entra sin usuario) ve todo, por pestañas.
  const conPestanas = !rol || rol === 'auditoria' || suelto
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
        <span className="rounded-full bg-marca/10 px-3 py-1 text-xs font-semibold text-indigo-800">
          v{VERSION}
        </span>
      </div>

      {conPestanas && (
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
      )}

      <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
        {/* Índice */}
        <nav className="hidden lg:block">
          <div className="sticky top-6 space-y-1 text-sm">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">En esta guía</div>
            {rol && (
              <a href="#soporte" onClick={(e) => { e.preventDefault(); document.getElementById('soporte')?.scrollIntoView({ behavior: 'smooth' }) }} className="block rounded px-2 py-1 font-semibold text-marca hover:bg-white">
                ¿Algo no funciona?
              </a>
            )}
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
          {rol && <ReportarProblema conGoogle={fuente.tipo === 'google'} />}
          <p className="pt-2 text-center text-xs text-slate-500">
            {AUTORIA} · © {new Date().getFullYear()}
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
