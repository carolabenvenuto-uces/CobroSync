import { useEffect, useState } from 'react'
import { Camera, FileUp, Loader2, RotateCw, Trash2, X } from 'lucide-react'
import { armarPdf, procesarFoto, type Pagina } from '../lib/escaneo'

interface Foto {
  id: number
  original: File
  rotacion: number
  pagina?: Pagina
  vista?: string
}

let siguiente = 1

/**
 * Sacar fotos con la cámara del celular y subirlas como un PDF (una página por foto).
 * Cada foto se mejora para que se lea como un escaneo; se puede girar o quitar antes de subir.
 */
export function SacarFoto({ titulo, nombreArchivo, onListo, onCerrar }: { titulo: string; nombreArchivo: string; onListo: (pdf: File) => void; onCerrar: () => void }) {
  const [fotos, setFotos] = useState<Foto[]>([])
  const [blancoYNegro, setBlancoYNegro] = useState(false)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [onCerrar])

  async function procesar(f: Foto, byn: boolean): Promise<Foto> {
    const pagina = await procesarFoto(f.original, { blancoYNegro: byn, rotacion: f.rotacion })
    return { ...f, pagina, vista: URL.createObjectURL(new Blob([pagina.jpeg as BlobPart], { type: 'image/jpeg' })) }
  }

  async function agregar(lista: FileList | null) {
    const nuevas = [...(lista ?? [])].filter((a) => a.type.startsWith('image/'))
    if (!nuevas.length) return
    setError(null)
    setTrabajando(true)
    try {
      const listas: Foto[] = []
      for (const a of nuevas) listas.push(await procesar({ id: siguiente++, original: a, rotacion: 0 }, blancoYNegro))
      setFotos((l) => [...l, ...listas])
    } catch {
      setError('No se pudo procesar la foto. Probar de nuevo o subir un PDF escaneado.')
    } finally {
      setTrabajando(false)
    }
  }

  async function rehacer(cambio: (f: Foto) => Foto, ids: number[] | 'todas', byn = blancoYNegro) {
    setTrabajando(true)
    try {
      const nuevas: Foto[] = []
      for (const f of fotos) nuevas.push(ids === 'todas' || ids.includes(f.id) ? await procesar(cambio(f), byn) : f)
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

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-fondo" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <div className="font-extrabold">{titulo}</div>
          <div className="text-xs text-slate-500">Cada foto es una página del PDF</div>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-2 hover:bg-fondo">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <p className="mb-3 rounded-lg border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-600">
          Para que se lea bien: la hoja entera, apoyada sobre un fondo oscuro, con buena luz y sin sombras ni reflejos.
        </p>
        {error && <p className="mb-3 rounded-lg bg-sem-rojo/10 p-3 text-sm text-red-800">{error}</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {fotos.map((f, i) => (
            <div key={f.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {f.vista && <img src={f.vista} alt={`Página ${i + 1}`} className="h-48 w-full bg-slate-100 object-contain" />}
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

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white px-4 py-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={blancoYNegro}
            disabled={trabajando}
            onChange={(e) => {
              setBlancoYNegro(e.target.checked)
              if (fotos.length) void rehacer((x) => x, 'todas', e.target.checked)
            }}
          />
          Blanco y negro (más nítido)
        </label>
        <button
          type="button"
          onClick={subir}
          disabled={trabajando || !fotos.length}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-marca px-4 py-2.5 text-sm font-semibold text-white hover:bg-marca-oscuro disabled:opacity-50"
        >
          <FileUp className="h-4 w-4" /> Subir PDF{fotos.length ? ` (${fotos.length} ${fotos.length === 1 ? 'página' : 'páginas'})` : ''}
        </button>
      </div>
    </div>
  )
}
