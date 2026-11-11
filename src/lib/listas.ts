/** Varios mails o enlaces guardados en un solo campo, separados por coma. */
export function separarLista(texto: string | undefined | null): string[] {
  return (texto ?? '')
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean)
}

export function unirLista(valores: string[]): string {
  return [...new Set(valores.map((x) => x.trim()).filter(Boolean))].join(', ')
}

/** Un enlace escrito sin "https://" se completa, para que se abra bien */
export function completarEnlace(url: string): string {
  const u = url.trim()
  return !u || /^https?:\/\//i.test(u) ? u : `https://${u}`
}
