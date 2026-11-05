import { useEffect, useState } from 'react'
import { ArrowLeft, Camera, Check, FileUp, Loader2, RotateCw, Trash2, X } from 'lucide-react'
import { armarPdf, procesarFoto, type ModoFoto, type Pagina } from '../lib/escaneo'

interface Foto {
  id: number
  original: File
  rotacion: number
  pagina?: Pagina
  vista?: string
}

let siguiente = 1

const MODOS: { clave: ModoFoto; titulo: string }[] = [
  { clave: 'original', titulo: 'Original' },
  { clave: 'mejorada', titulo: 'Mejorada' },
  { clave: 'byn', titulo: 'Blanco y negro' },
]

/**
 * Sacar fotos con la cámara del celular y subirlas como un PDF (una página por foto).
 * Se elige cómo queda (original, mejorada o blanco y negro) mirando cada página; antes de subir,
 * una pantalla muestra el documento completo para revisarlo.
 */
export function SacarFoto({ titulo, nombreArchivo, onListo, onCerrar }: { titulo: string; nombreArchivo: string; onListo: (pdf: File) => void; onCerrar: () => void }) {
  const [fotos, setFotos] = useState<Foto[]>([])
  const [modo, setModo] = useState<ModoFoto>('mejorada')
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ampliada, setAmpliada] = useState<number | null>(null)
  const [revisando, setRevisando] = useState(false)

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (ampliada !== null) setAmpliada(null)
      else if (revisando) setRevisando(false)
      else onCerrar()
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [onCerrar, ampliada, revisando])

  async function procesar(f: Foto, m: ModoFoto): Promise<Foto> {
    const pagina = await procesarFoto(f.original, { modo: m, rotacion: f.rotacion })
    return { ...f, pagina, vista: URL.createObjectURL(new Blob([pagina.jpeg as BlobPart], { type: 'image/jpeg' })) }
  }

  async function agregar(lista: FileList | null) {
    const nuevas = [...(lista ?? [])].filter((a) => a.type.startsWith('image/'))
    if (!nuevas.length) return
    setError(null)
    setTrabajando(true)
    try {
      const listas: Foto[] = []
      for (const a of nuevas) listas.push(await procesar({ id: siguiente++, original: a, rotacion: 0 }, modo))
      setFotos((l) => [...l, ...listas])
    } catch {
      setError('No se pudo procesar la foto. Probar de nuevo o subir un PDF escaneado.')
    } finally {
      setTrabajando(false)
    }
  }

  async function rehacer(cambio: (f: Foto) => Foto, ids: number[] | 'todas', m = modo) {
    setTrabajando(true)
    try {
      const nuevas: Foto[] = []
      for (const f of fotos) nuevas.push(ids === 'todas' || ids.includes(f.id) ? await procesar(cambio(f), m) : f)
      setFotos(nuevas)
    } finally {
      setTrabajando(false)
    }
  }

  function subir() {
    const paginas = fotos.map((f) => f.pagina).filter((p): p is Pagina => !!p)
    if (!paginas.length) return
    onListo(new File([armarPdf(paginas)], nombreArchivo, { type: 'application/pdf' }))
  }

  const fotoAmpliada = fotos.find((f) => f.id === ampliada)

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-fondo" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          {revisando && (
            <button type="button" onClick={() => setRevisando(false)} aria-label="Volver a editar" className="rounded-lg p-1.5 hover:bg-fondo">
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div>
            <div className="font-extrabold">{revisando ? 'Revisar el documento' : titulo}</div>
            <div className="text-xs text-slate-500">
              {revisando ? `${fotos.length} ${fotos.length === 1 ? 'página' : 'páginas'} · así se va a ver el PDF` : 'Cada foto es una página del PDF'}
            </div>
          </div>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-2 hover:bg-fondo">
          <X className="h-5 w-5" />
        </button>
      </div>

      {revisando ? (
        // Vista final: cada página a lo ancho, como queda en el PDF
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {fotos.map((f, i) => (
            <figure key={f.id} className="mx-auto max-w-2xl">
              <img src={f.vista} alt={`Página ${i + 1}`} className="w-full rounded-lg border border-slate-200 bg-white shadow-sm" />
              <figcaption className="mt-1 text-center text-xs text-slate-500">Página {i + 1}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <p className="mb-3 rounded-lg border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-600">
            Para que se lea bien: la hoja entera, apoyada sobre un fondo oscuro, con buena luz y sin sombras ni reflejos. Tocar una página
            para verla grande.
          </p>
          {error && <p className="mb-3 rounded-lg bg-sem-rojo/10 p-3 text-sm text-red-800">{error}</p>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {fotos.map((f, i) => (
              <div key={f.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                {f.vista && (
                  <button type="button" onClick={() => setAmpliada(f.id)} className="block w-full" aria-label={`Ver la página ${i + 1}`}>
                    <img src={f.vista} alt={`Página ${i + 1}`} className="h-48 w-full bg-slate-100 object-contain" />
                  </button>
                )}
                <div className="flex items-center justify-between px-2 py-1.5 text-xs">
                  <span className="font-semibold">Página {i + 1}</span>
                  <span className="flex gap-1">
                    <button type="button" disabled={trabajando} onClick={() => void rehacer((x) => ({ ...x, rotacion: x.rotacion + 90 }), [f.id])} aria-label="Girar" className="rounded p-1.5 hover:bg-fondo disabled:opacity-40">
                      <RotateCw className="h-4 w-4" />
                    </button>
                    <button type="button" disabled={trabajando} onClick={() => setFotos((l) => l.filter((x) => x.id !== f.id))} aria-label="Quitar" className="rounded p-1.5 text-red-700 hover:bg-sem-rojo/10 disabled:opacity-40">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </span>
                </div>
              </div>
            ))}
            <label className={`flex h-56 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-marca/50 bg-white text-sm font-semibold text-marca ${trabajando ? 'pointer-events-none opacity-60' : 'hover:bg-marca/5'}`}>
              {trabajando ? <Loader2 className="h-7 w-7 animate-spin" /> : <Camera className="h-7 w-7" />}
              {trabajando ? 'Procesando…' : fotos.length ? 'Agregar otra página' : 'Sacar foto'}
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { void agregar(e.target.files); e.target.value = '' }} />
            </label>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white px-4 py-3">
        {revisando ? (
          <>
            <button type="button" onClick={() => setRevisando(false)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-fondo">
              Volver a editar
            </button>
            <button type="button" onClick={subir} className="ml-auto inline-flex items-center gap-2 rounded-lg bg-marca px-4 py-2.5 text-sm font-semibold text-white hover:bg-marca-oscuro">
              <FileUp className="h-4 w-4" /> Subir PDF
            </button>
          </>
        ) : (
          <>
            {/* Cómo queda la imagen: se ve el cambio en cada página antes de elegir */}
            <div className="flex overflow-hidden rounded-lg border border-slate-200 text-xs font-semibold" role="radiogroup" aria-label="Cómo queda la imagen">
              {MODOS.map((m) => (
                <button
                  key={m.clave}
                  type="button"
                  role="radio"
                  aria-checked={modo === m.clave}
                  disabled={trabajando}
                  onClick={() => {
                    if (m.clave === modo) return
                    setModo(m.clave)
                    if (fotos.length) void rehacer((x) => x, 'todas', m.clave)
                  }}
                  className={`px-3 py-2 ${modo === m.clave ? 'bg-marca text-white' : 'bg-white text-slate-600 hover:bg-fondo'} disabled:opacity-60`}
                >
                  {m.titulo}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setRevisando(true)}
              disabled={trabajando || !fotos.length}
              className="ml-auto inline-flex items-center gap-2 rounded-lg bg-marca px-4 py-2.5 text-sm font-semibold text-white hover:bg-marca-oscuro disabled:opacity-50"
            >
              <Check className="h-4 w-4" /> Revisar{fotos.length ? ` (${fotos.length} ${fotos.length === 1 ? 'página' : 'páginas'})` : ''}
            </button>
          </>
        )}
      </div>

      {fotoAmpliada?.vista && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-noche/90 p-3" role="dialog" aria-label="Página ampliada" onClick={() => setAmpliada(null)}>
          <button type="button" onClick={() => setAmpliada(null)} aria-label="Cerrar" className="ml-auto rounded-lg p-2 text-white hover:bg-white/10">
            <X className="h-6 w-6" />
          </button>
          <img src={fotoAmpliada.vista} alt="Página ampliada" className="mx-auto min-h-0 flex-1 object-contain" />
        </div>
      )}
    </div>
  )
}
