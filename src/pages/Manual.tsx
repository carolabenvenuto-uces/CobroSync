import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BookOpen, Building2, ChevronDown, ClipboardCheck, LifeBuoy, Store } from 'lucide-react'
import { Isologo } from '../components/Logo'
import { VentanaSoporte } from '../components/Soporte'
import { BadgeEtapa, EtiquetaMipyme } from '../components/ui/Badges'
import { useApp } from '../context/AppContext'
import { plazosActuales } from '../domain/plazos'
import { AUTORIA, VERSION } from '../lib/marca'

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
          documentación, Cobranzas la revisa y la presenta a la compañía, y Gerencia ve en qué estado está todo y cuánto falta cobrar.
        </p>
        <p className="mt-2">Cada persona entra con la cuenta de la empresa y ve solo lo que corresponde a su sector:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Sucursal:</strong> sube la factura y la orden firmada, corrige lo que se rechaza e informa las notas de crédito.
          </li>
          <li>
            <strong>Cobranzas:</strong> revisa la documentación, presenta las facturas a las compañías y hace los reclamos.
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
    titulo: '¿Por qué etapas pasa una factura?',
    contenido: () => (
      <>
        <p>Cada factura pasa por estas etapas. La etiqueta de color dice en cuál está y a quién le toca:</p>
        <ul className="mt-3 space-y-2">
          {(
            [
              ['doc_pendiente', 'Sucursal: falta subir la documentación, todavía dentro del plazo.'],
              ['doc_atrasada', 'Sucursal: falta la documentación y ya pasó el plazo.'],
              ['doc_observada', 'Sucursal: Cobranzas o la compañía no aceptó un documento; hay que reemplazarlo.'],
              ['en_revision', 'Cobranzas: la sucursal subió todo y Cobranzas lo está revisando.'],
              ['pres_pendiente', 'Cobranzas: documentación aprobada, falta presentarla a la compañía.'],
              ['al_dia', 'Compañía: presentada, todavía no venció el plazo de pago.'],
              ['vencida', 'Compañía: presentada, venció y no se cobró; Cobranzas reclama.'],
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
    titulo: '¿Qué significa cada color?',
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
    titulo: '¿Cómo funcionan las notificaciones?',
    contenido: () => (
      <>
        <p>
          <Pantalla>Notificaciones</Pantalla>, la campanita arriba, al lado del nombre, funciona como un correo: la bandeja a lo ancho, con lo no leído en
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
    titulo: '¿Cómo se filtra, ordena o exporta una lista?',
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
    titulo: '¿Cuánto tiempo hay para subir la documentación?',
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
            el motivo y el día previsto. Cobranzas sabe cuándo esperarla y la factura no figura como atrasada hasta esa fecha. Si la fecha pasa
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
    titulo: '¿Qué muestra cada tarjeta de Mis facturas?',
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
            <strong>En revisión:</strong> documentación ya enviada, que Cobranzas está revisando. Sin tareas pendientes.
          </li>
          <li>
            <strong>Por vencer o vencidas:</strong> facturas que pasaron el plazo o a las que les quedan 2 días o menos.
          </li>
          <li>
            <strong>Rechazos y observaciones:</strong> documentos que Cobranzas o la compañía no aceptaron. El motivo dice quién lo rechazó y
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
    titulo: '¿Cómo se sube la documentación?',
    contenido: () => (
      <>
        <h4 className="font-bold">De a una factura</h4>
        <Pasos>
          <Paso n={1}>
            En la tarjeta <strong>Para subir</strong> (o en la de rechazos), el botón <strong>Subir</strong> de la factura.
          </Paso>
          <Paso n={2}>El PDF de la factura y el de la orden firmada (o uno solo, si están escaneadas juntas).</Paso>
          <Paso n={3}>La factura pasa a "En revisión". Si Cobranzas la observa, llega una notificación y aparece en Rechazos y observaciones.</Paso>
        </Pasos>
        <h4 className="mt-4 font-bold">Muchos archivos de una vez</h4>
        <Pasos>
          <Paso n={1}>
            El botón <strong>Subir varios PDF de una vez</strong>, arriba.
          </Paso>
          <Paso n={2}>
            Todos los PDF juntos. En el nombre, el número de factura y el siniestro, por ejemplo{' '}
            <code className="rounded bg-slate-100 px-1">35-11032 siniestro 22365.pdf</code> (si se quiere, <code className="rounded bg-slate-100 px-1">fc</code> u{' '}
            <code className="rounded bg-slate-100 px-1">or</code> para decir qué es). Nombres cortos, hasta 40 caracteres, sin la compañía. Si falta el siniestro, se escribe en la fila. Las facturas de hoy, que todavía no aparecen porque el ERP se carga al día siguiente, se suben igual: quedan en espera y se unen a su legajo cuando Cobranzas carga el ERP.
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
    titulo: '¿Cómo se informa una nota de crédito?',
    contenido: () => (
      <>
        <p>Cuando una factura se anula, toda o una parte, hay que avisarlo para que Cobranzas no la presente:</p>
        <Pasos>
          <Paso n={1}>
            En <Pantalla>Mis facturas</Pantalla>, el botón <strong>Informar una nota de crédito</strong>.
          </Paso>
          <Paso n={2}>La factura, si se anula completa o una parte (con el importe) y el motivo.</Paso>
          <Paso n={3}>Cobranzas espera que la nota de crédito aparezca en el sistema y la asocia a la factura.</Paso>
        </Pasos>
        <p>Si después se vuelve a facturar, en Mis siniestros figura "Falta refacturar" hasta que esté la factura nueva.</p>
      </>
    ),
  },
  {
    id: 'suc-siniestros',
    sector: 'sucursal',
    titulo: '¿Para qué sirve Mis siniestros?',
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
    titulo: '¿Qué muestra el Resumen?',
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
    titulo: '¿Qué informes hay?',
    contenido: () => (
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <Pantalla>Control por sucursal</Pantalla>: las sucursales en orden alfabético, con el porcentaje de facturas subidas en plazo,
          lo pendiente hoy (atrasado o crítico) y el importe que retiene cada una.
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
    titulo: '¿Qué avisos le llegan a Gerencia?',
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

  // ---------- Cobranzas ----------
  {
    id: 'aud-base',
    sector: 'auditoria',
    titulo: '¿Qué pantallas usa Cobranzas en el día a día?',
    contenido: () => (
      <>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <Pantalla>Inicio</Pantalla>: lo que hay que hacer hoy, separado por quién tiene que actuar. Cada aviso abre sus facturas.
          </li>
          <li>
            <Pantalla>Control diario</Pantalla>: la carga del Excel del ERP (las filas van solas a la pestaña Quiter de la planilla) y la
            revisión de documentos: aprobar u observar cada uno. Arriba se elige ver <strong>por factura</strong> o{' '}
            <strong>por siniestro</strong> (todas las facturas, documentos y notas de crédito de un siniestro juntos).
          </li>
          <li>
            <Pantalla>Presentar</Pantalla>: una fila por compañía con lo aprobado y su canal (mail o plataforma). Al abrirla: elegir las
            facturas, <strong>descargar todos los documentos en un .zip</strong> (cada PDF con el número de factura en el nombre), armar el
            mail o abrir la plataforma (los mails y enlaces de la compañía están ahí mismo), y marcarlas como presentadas. Vuelven acá las que la compañía pidió reenviar.
          </li>
          <li>
            <Pantalla>Seguimiento</Pantalla>, solapa <strong>Compañías</strong>: las vencidas. Las tarjetas de arriba separan qué hay que
            reclamar, corregir o pedir apoyo; al marcar facturas aparece la barra para registrar
            reclamos en lote y la respuesta de la compañía con un clic: pasa a pagos (se espera
            un mes), reenviar la documentación (vuelve a Presentar) o refacturar (pedido a la sucursal).
          </li>
          <li>
            <Pantalla>Seguimiento</Pantalla>, solapa <strong>Sucursales</strong>: la documentación que falta. Y en <strong>Pedidos</strong>: lo que se les pidió (errores de factura, refacturaciones, notas de crédito sin
            avisar), con los días de espera. Lo respondido queda para revisar y dar por resuelto. Los pedidos sin responder también salen
            en el mail de los lunes de cada sucursal.
          </li>
          <li>
            <Pantalla>Ajustes</Pantalla>: en <strong>Compañías</strong>, los datos de cada una (cómo se presenta, mails, enlaces a la
            plataforma, tolerancia, alta y pausa); en <strong>Planilla</strong>, la conexión con la planilla de control, que se lee sola cada
            hora. <Pantalla>Informes</Pantalla> reúne el Resumen, el control por sucursal, los saldos y el impacto económico.
          </li>
        </ul>
        <Nota>
          Para no pisarse: al abrir una factura, o al preparar una presentación, queda tomada unos minutos a nombre de quien la abrió. La otra
          persona ve el aviso "La está presentando…" y no puede elegirla en Presentar.
        </Nota>
      </>
    ),
  },

  {
    id: 'soporte',
    sector: 'todos',
    titulo: '¿Qué hacer si algo de la plataforma no funciona?',
    contenido: () => <RespuestaSoporte />,
  },
  // ---------- Preguntas ----------
  {
    id: 'preguntas',
    sector: 'todos',
    titulo: 'Otras preguntas',
    contenido: () => (
      <dl className="space-y-3">
        <div>
          <dt className="font-bold">¿Hace falta recargar la página para ver lo nuevo?</dt>
          <dd>No: los datos y las notificaciones se actualizan solos cada minuto.</dd>
        </div>
        <div>
          <dt className="font-bold">Se subió un archivo equivocado, ¿se puede quitar?</dt>
          <dd>Sí, mientras está en revisión: dentro de la factura, "Quitar" en ese documento. Una vez aprobado, hay que avisarle a Cobranzas.</dd>
        </div>
        <div>
          <dt className="font-bold">¿Por qué no se puede subir un archivo?</dt>
          <dd>Tiene que ser PDF, con el número de la factura en el nombre (por ejemplo, 35-11032 siniestro 22365) y no más de 40 caracteres.</dd>
        </div>
        <div>
          <dt className="font-bold">¿Se puede usar desde el celular?</dt>
          <dd>Sí. Las listas se ven como tarjetas y, con el botón Foto, se sacan fotos de los documentos que se suben como PDF.</dd>
        </div>
      </dl>
    ),
  },
]

/** Respuesta de la pregunta de soporte: explica a quién va y abre la misma ventana del menú */
function RespuestaSoporte() {
  const [abierta, setAbierta] = useState(false)
  return (
    <div className="space-y-3">
      <p>
        Si una pantalla no carga, un botón no responde o un cambio no se guarda, se avisa con <strong>Soporte técnico</strong>, en el menú
        (debajo de Manual de uso). Se elige la pantalla y el problema, y se cuenta qué pasó; el aviso le llega a quien da soporte a la
        plataforma.
      </p>
      <p>Las dudas sobre una factura (un documento, un plazo, un reclamo) se consultan con Cobranzas.</p>
      <button type="button" onClick={() => setAbierta(true)} className="inline-flex items-center gap-2 rounded-lg bg-marca px-4 py-2 text-sm font-semibold text-white hover:bg-marca-oscuro">
        <LifeBuoy className="h-4 w-4" /> Avisar un problema
      </button>
      {abierta && <VentanaSoporte onCerrar={() => setAbierta(false)} />}
    </div>
  )
}

/** Orden de las preguntas para cada sector: primero qué es CobroSync, después lo de todos los días, al final lo general */
const ORDEN: Record<Exclude<Sector, 'todos'>, string[]> = {
  sucursal: ['que-es', 'suc-mis-facturas', 'suc-subir', 'suc-plazo', 'suc-nc', 'notificaciones', 'suc-siniestros', 'colores', 'camino', 'tablas', 'soporte', 'preguntas'],
  gerencia: ['que-es', 'ger-resumen', 'ger-avisos', 'ger-informes', 'notificaciones', 'colores', 'camino', 'tablas', 'soporte', 'preguntas'],
  auditoria: ['que-es', 'aud-base', 'camino', 'colores', 'notificaciones', 'tablas', 'soporte', 'preguntas'],
}

const PESTANAS: { clave: Sector; titulo: string; icono: typeof Store }[] = [
  { clave: 'todos', titulo: 'Para todos', icono: BookOpen },
  { clave: 'sucursal', titulo: 'Sucursal', icono: Store },
  { clave: 'gerencia', titulo: 'Gerencia', icono: Building2 },
  { clave: 'auditoria', titulo: 'Cobranzas', icono: ClipboardCheck },
]

export default function Manual({ suelto = false }: { suelto?: boolean }) {
  const { rol } = useApp()
  // Cada usuario ve solo su manual. Las pestañas quedan para quien lo abre desde el ingreso, sin usuario.
  const conPestanas = !rol
  const [sector, setSector] = useState<Sector>(rol ?? 'todos')
  const sectorVisto = (rol ?? sector) as Sector
  const lista =
    sectorVisto === 'todos'
      ? SECCIONES.filter((s) => s.sector === 'todos')
      : ORDEN[sectorVisto].map((id) => SECCIONES.find((s) => s.id === id)).filter((s): s is (typeof SECCIONES)[number] => !!s)
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set())
  const alternar = (id: string) =>
    setAbiertas((a) => {
      const n = new Set(a)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const [buscar, setBuscar] = useState('')
  const normal = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const filtradas = buscar.trim() ? lista.filter((s) => normal(s.titulo).includes(normal(buscar.trim()))) : lista

  const cuerpo = (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Manual de uso</h1>
          <p className="mt-1 text-sm text-slate-600">
            Tocar una pregunta para ver la respuesta.
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


      {/* Cada pregunta se despliega al tocarla: así no hay que leer todo el manual */}
      <div className="mb-3">
        <input
          type="search"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          placeholder="Buscar una pregunta"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/20"
        />
      </div>
      <div className="space-y-2">
        {filtradas.map((s) => {
          const desplegada = abiertas.has(s.id)
          return (
            <section key={s.id} id={s.id} className="rounded-xl border border-slate-200 bg-white text-sm leading-relaxed text-slate-700 shadow-sm">
              <button
                type="button"
                onClick={() => alternar(s.id)}
                aria-expanded={desplegada}
                className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
              >
                <span className="font-bold text-noche">{s.titulo}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${desplegada ? 'rotate-180' : ''}`} />
              </button>
              {desplegada && <div className="border-t border-slate-100 px-5 pb-5 pt-3">{s.contenido()}</div>}
            </section>
          )
        })}
        {filtradas.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Sin preguntas con esa búsqueda.</p>}
      </div>
      <p className="pt-6 text-center text-xs text-slate-500">
        {AUTORIA} · © {new Date().getFullYear()}
      </p>
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
