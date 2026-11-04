const NUMERO = /^(?:[^:]*?·\s*)?((?:FC|NC) E \d+-\d+):\s*/

/**
 * Los avisos llegan como "Auditoría · FC E 21-11226: Observado: orden firmada (ilegible)". Para que
 * se lea como un mail: la factura va aparte y el asunto es lo que pasó ("Observado").
 */
export function partesDe(texto: string): { factura: string | null; asunto: string; cuerpo: string } {
  const m = texto.match(NUMERO)
  const cuerpo = m ? texto.slice(m[0].length) : texto
  const corte = cuerpo.search(/[:.]\s/)
  let asunto = corte > 3 && corte <= 70 ? cuerpo.slice(0, corte) : cuerpo
  if (asunto.length > 70) asunto = `${asunto.slice(0, 67).trimEnd()}…`
  return { factura: m ? m[1] : null, asunto: asunto.charAt(0).toUpperCase() + asunto.slice(1), cuerpo: cuerpo.charAt(0).toUpperCase() + cuerpo.slice(1) }
}
