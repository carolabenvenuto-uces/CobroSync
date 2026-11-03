import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Building2,
  CalendarClock,
  EyeOff,
  FileSpreadsheet,
  FileWarning,
  FolderSearch,
  Hourglass,
  Receipt,
  ScanLine,
  Send,
  ShieldCheck,
  Users,
  Wrench,
} from 'lucide-react'
import { Isologo, Marca } from '../components/Logo'
import { PuntoSemaforo } from '../components/ui/Badges'
import { useApp } from '../context/AppContext'
import { calcularTotales } from '../domain/finanzas'
import { calcularSemaforo } from '../domain/semaforo'
import { formatoPesosCorto } from '../lib/formato'

const PROBLEMAS = [
  { icono: ScanLine, titulo: 'Escaneos borrosos', texto: 'La compañía rechaza el legajo y el cobro vuelve a empezar.' },
  { icono: FileWarning, titulo: 'Órdenes sin firma', texto: 'Una conformidad sin firma o sello frena la presentación.' },
  { icono: EyeOff, titulo: 'Documentos que no se ven', texto: 'El Drive falla o no todos ven todo: hay que reclamar a cada sucursal.' },
  { icono: Hourglass, titulo: 'Facturas sin presentar', texto: 'Se detectan tarde y el cobro se demora entre 15 y 45 días.' },
  { icono: Receipt, titulo: 'Notas de crédito sueltas', texto: 'Anulaciones que no se informan y descuadran los saldos.' },
  { icono: FileSpreadsheet, titulo: 'Planillas y correos', texto: 'La trazabilidad depende de Excel, carpetas y la memoria del equipo.' },
]

const PASOS = [
  { icono: FileSpreadsheet, titulo: 'Ingesta desde el ERP', texto: 'Las facturas llegan desde la exportación del ERP (Excel o CSV).' },
  { icono: FolderSearch, titulo: 'Armado del legajo', texto: 'Cada factura se asocia con su orden de reparación, remito y conformidad.' },
  { icono: ShieldCheck, titulo: 'Validación y semáforo', texto: 'Lo que falta, está ilegible o sin firma queda en rojo y no avanza.' },
  { icono: Send, titulo: 'Presentación y cobro', texto: 'Se presenta a cada compañía y se sigue hasta que el dinero ingresa.' },
]

const ROLES = [
  { icono: Wrench, titulo: 'Taller', texto: 'Carga facturas y órdenes, corrige rechazos y sube documentos desde el celular con un QR.' },
  { icono: Users, titulo: 'Administración y cobranzas', texto: 'Valida legajos, presenta, registra reclamos y controla vencimientos y notas de crédito.' },
  { icono: Building2, titulo: 'Gerencia', texto: 'Consulta indicadores, saldos por compañía y la proyección de cobros.' },
]

function VistaPreviaDashboard() {
  const { datos } = useApp()
  if (!datos) return <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />

  const totales = calcularTotales(datos.comprobantes, datos.meta.fechaCorte)
  const conteo = { rojo: 0, amarillo: 0, verde: 0 }
  for (const c of datos.comprobantes) {
    const color = calcularSemaforo(c).color
    if (color !== 'neutro') conteo[color] += 1
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
      <div className="flex items-center justify-between bg-noche px-5 py-3">
        <span className="text-sm font-semibold text-white">Dashboard general</span>
        <span className="rounded-full bg-esmeralda/20 px-2.5 py-1 text-[10px] font-bold tracking-wider text-esmeralda">
          DEMO · DATOS FICTICIOS
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
        {[
          { t: 'Facturado', v: formatoPesosCorto(totales.facturado), c: 'text-noche' },
          { t: 'Cobrado', v: formatoPesosCorto(totales.cobrado), c: 'text-esmeralda' },
          { t: 'Pendiente', v: formatoPesosCorto(totales.pendiente), c: 'text-marca' },
          { t: 'Vencido', v: formatoPesosCorto(totales.vencido), c: 'text-sem-rojo' },
        ].map((k) => (
          <div key={k.t} className="rounded-xl border border-slate-100 bg-fondo p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{k.t}</div>
            <div className={`mt-1 text-lg font-extrabold ${k.c}`}>{k.v}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-4 border-t border-slate-100 px-5 py-4 text-sm">
        <span className="flex items-center gap-2">
          <PuntoSemaforo color="rojo" /> {conteo.rojo} legajos bloqueados
        </span>
        <span className="flex items-center gap-2">
          <PuntoSemaforo color="amarillo" /> {conteo.amarillo} en curso
        </span>
        <span className="flex items-center gap-2">
          <PuntoSemaforo color="verde" /> {conteo.verde} cobrados
        </span>
      </div>
    </div>
  )
}

export default function Landing() {
  return (
    <div className="bg-white">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Marca />
          <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#problema" className="hidden hover:text-noche md:inline">
              El problema
            </a>
            <a href="#solucion" className="hidden hover:text-noche md:inline">
              La solución
            </a>
            <a href="#modulos" className="hidden hover:text-noche md:inline">
              Módulos
            </a>
            <Link
              to="/app"
              className="rounded-lg bg-marca px-4 py-2 font-semibold text-white shadow-sm hover:bg-marca-oscuro"
            >
              Ver demo operativa
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-fondo to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-esmeralda/30 bg-esmeralda/10 px-3 py-1 text-xs font-semibold text-emerald-800">
              <ShieldCheck className="h-3.5 w-3.5" />
              Gestión documental y cobranzas para empresas B2B
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-noche sm:text-5xl">
              La documentación correcta, presentada a tiempo y cobrada sin perder trazabilidad
            </h1>
            <p className="mt-5 text-lg text-slate-600">
              CobroSync centraliza legajos, facturas, validación documental y seguimiento de cobranzas para
              empresas B2B.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/app"
                className="inline-flex items-center gap-2 rounded-lg bg-marca px-5 py-3 font-semibold text-white shadow-sm hover:bg-marca-oscuro"
              >
                Ver demo operativa <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#solucion"
                className="rounded-lg border border-slate-200 bg-white px-5 py-3 font-semibold text-noche hover:bg-fondo"
              >
                Conocer la solución
              </a>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Demo verticalizada en concesionarias y talleres que trabajan con compañías de seguros.
            </p>
          </div>
          <VistaPreviaDashboard />
        </div>
      </section>

      {/* Problema */}
      <section id="problema" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-16">
        <h2 className="text-3xl font-extrabold tracking-tight">Un documento mal escaneado demora el cobro semanas</h2>
        <p className="mt-3 max-w-2xl text-slate-600">
          Cada factura a una aseguradora necesita un legajo de respaldo. Cuando algo falta o no se lee, la compañía
          lo rechaza o lo retiene en auditoría, y suben los días promedio de cobro (DSO).
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROBLEMAS.map(({ icono: Icono, titulo, texto }) => (
            <div key={titulo} className="rounded-xl border border-slate-200 p-5">
              <Icono className="h-6 w-6 text-sem-rojo" />
              <h3 className="mt-3 font-bold">{titulo}</h3>
              <p className="mt-1 text-sm text-slate-600">{texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Solución */}
      <section id="solucion" className="scroll-mt-20 bg-noche text-white">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-3xl font-extrabold tracking-tight">Cómo funciona</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-4">
            {PASOS.map(({ icono: Icono, titulo, texto }, i) => (
              <div key={titulo}>
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-marca text-sm font-bold">
                    {i + 1}
                  </span>
                  <Icono className="h-5 w-5 text-esmeralda" />
                </div>
                <h3 className="mt-4 font-bold">{titulo}</h3>
                <p className="mt-1 text-sm text-slate-400">{texto}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {[
              { color: 'rojo' as const, t: 'Rojo', d: 'Falta un documento, está ilegible o sin firma. No puede avanzar.' },
              { color: 'amarillo' as const, t: 'Amarillo', d: 'Completo: pendiente de presentación, respuesta o pago.' },
              { color: 'verde' as const, t: 'Verde', d: 'Validado, conciliado y cobrado.' },
            ].map((s) => (
              <div key={s.t} className="rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-2 font-bold">
                  <PuntoSemaforo color={s.color} /> {s.t}
                </div>
                <p className="mt-2 text-sm text-slate-400">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-3xl font-extrabold tracking-tight">Cada área ve lo que necesita</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {ROLES.map(({ icono: Icono, titulo, texto }) => (
            <div key={titulo} className="rounded-xl border border-slate-200 p-5">
              <Icono className="h-6 w-6 text-marca" />
              <h3 className="mt-3 font-bold">{titulo}</h3>
              <p className="mt-1 text-sm text-slate-600">{texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Módulos */}
      <section id="modulos" className="scroll-mt-20 bg-fondo">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-3xl font-extrabold tracking-tight">Módulos</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="text-sm font-bold uppercase tracking-wider text-marca">Standard</div>
              <h3 className="mt-1 text-xl font-extrabold">Operación documental</h3>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li>• Importación de facturas desde el ERP</li>
                <li>• Legajo por factura con sus documentos</li>
                <li>• Semáforo operativo y control diario</li>
                <li>• Carga de documentos desde el celular (QR)</li>
              </ul>
            </div>
            <div className="rounded-2xl border-2 border-esmeralda bg-white p-6">
              <div className="text-sm font-bold uppercase tracking-wider text-esmeralda">Premium</div>
              <h3 className="mt-1 text-xl font-extrabold">Financiero y gerencial</h3>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li>• Cuentas corrientes y saldos por compañía</li>
                <li>• Notas de crédito, vencidos y DSO</li>
                <li>• Proyección semanal de cobros</li>
                <li>• Dashboard gerencial</li>
              </ul>
            </div>
          </div>
          <div className="mt-10 text-center">
            <Link
              to="/app"
              className="inline-flex items-center gap-2 rounded-lg bg-marca px-6 py-3 font-semibold text-white shadow-sm hover:bg-marca-oscuro"
            >
              <CalendarClock className="h-4 w-4" /> Ver demo operativa
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <Isologo className="h-6 w-6" />
            CobroSync by CAROLA · desarrollado por CaroIA Studio
          </div>
          <div>Demo con datos ficticios</div>
        </div>
      </footer>
    </div>
  )
}
