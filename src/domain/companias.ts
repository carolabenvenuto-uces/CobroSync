/**
 * Razón social, CUIT y plazo de pago de cada compañía, como figuran en la pestaña "CP" de la
 * planilla de control (datos públicos de las compañías, no de clientes).
 *
 * Se usan para completar las compañías que llegan desde la planilla, que solo traen el nombre
 * corto: así la carga del ERP las reconoce por CUIT.
 */
export const DATOS_CP: Record<string, { razonSocial: string; cuit: string; plazo?: number }> = {
  Allianz: { razonSocial: 'ALLIANZ ARGENTINA COMPAÑIA DE SEGUROS', cuit: '30500037217' },
  ATM: { razonSocial: 'ASEGURADORA TOTAL MOTOVEHICULAR S.A.', cuit: '30699408154' },
  'Auto Corp': { razonSocial: 'AUTO CORP S.A.', cuit: '30708934875' },
  Barbuss: { razonSocial: 'BARBUSS RISK SEGUROS ARGENTINA S.A.', cuit: '30500017011' },
  Berkley: { razonSocial: 'BERKLEY INTERNATIONAL SEGUROS S.A.', cuit: '30500035788' },
  Chubb: { razonSocial: 'CHUBB SEGUROS ARGENTINA S.A.', cuit: '30500016260' },
  'El Norte': { razonSocial: 'COMPAÑIA DE SEGUROS EL NORTE S.A.', cuit: '30500040455' },
  Experta: { razonSocial: 'EXPERTA SEGUROS SOCIEDAD ANONIMA UNIPERSONAL', cuit: '30714590541' },
  'F. Patronal': { razonSocial: 'FEDERACION PATRONAL SEGUROS SAU', cuit: '33707366589', plazo: 7 },
  Galeno: { razonSocial: 'GALENO SEGUROS S.A.', cuit: '30714395196' },
  Galicia: { razonSocial: 'SEGUROS GALICIA S. A.', cuit: '30500000127' },
  Holando: { razonSocial: 'LA HOLANDO SUDAMERICANA CIA DE SEGS. S.A.', cuit: '33500038069' },
  'Inst. Seg. SA': { razonSocial: 'INSTITUTO DE SEGUROS S.A.', cuit: '30707250484' },
  Integrity: { razonSocial: 'INTEGRITY SEGUROS ARGENTINA S.A.', cuit: '30704961983' },
  Iuñigo: { razonSocial: 'IUÑIGO ARGENTINA COMPAÑIA DE SEGUROS S.A.', cuit: '30711802971' },
  Iutrace: { razonSocial: 'IUTRACE S.A.S.', cuit: '30717437558' },
  'La Caja': { razonSocial: 'CAJA DE SEGUROS', cuit: '30663205621' },
  'La Equitativa': { razonSocial: 'LA EQUITATIVA DEL PLATA S.A.', cuit: '30515419760' },
  'La Segunda': { razonSocial: 'LA SEGUNDA COOP. LTDA.DE SEGUROS GENERALES', cuit: '30500017704' },
  LAX: { razonSocial: 'LAX S.A.', cuit: '30716216744' },
  'M. Andina': { razonSocial: 'COMPAÑIA DE SEGUROS LA MERCANTIL ANDINA S.A.', cuit: '30500036911' },
  Mapfre: { razonSocial: 'MAPFRE ARGENTINA SEGUROS S.A.', cuit: '30500007539' },
  Meridional: { razonSocial: 'LA MERIDIONAL CIA. ARGENTINA DE SEGUROS SA', cuit: '30500051163' },
  Metropol: { razonSocial: 'METROPOL CIA.ARG.DE SEG.SA', cuit: '30500061339' },
  Nacion: { razonSocial: 'NACION SEGUROS S.A.', cuit: '30678561165' },
  Nativa: { razonSocial: 'NATIVA COMPAÑIA ARGENTINA DE SEGUROS S.A.', cuit: '30500051856' },
  Parana: { razonSocial: 'PARANA SOCIEDAD ANONIMA DE SEGUROS', cuit: '30500057102' },
  Provincia: { razonSocial: 'PROVINCIA SEGUROS S.A.', cuit: '30527508165' },
  RDA: { razonSocial: 'RDA RENTING S A', cuit: '30712257357' },
  Rivadavia: { razonSocial: 'SEGUROS BERNARDINO RIVADAVIA COOP.LTDA', cuit: '30500050310' },
  'S. Cristobal': { razonSocial: 'SAN CRISTOBAL S.M.S.G.', cuit: '34500045339' },
  'S.M.G.': { razonSocial: 'S.M.G. COMPAÑIA ARGENTINA DE SEGUROS S.A.', cuit: '30500031960' },
  Sancor: { razonSocial: 'SANCOR COOPERATIVA DE SEGUROS LIMITADA', cuit: '30500049460' },
  Segurcoop: { razonSocial: 'SEGURCOOP COOPERATIVA DE SEGUROS LIMITADA', cuit: '30500057277' },
  Sura: { razonSocial: 'SEGUROS SURA SA', cuit: '30500000127' },
  Victoria: { razonSocial: 'COMPAÑIA DE SEGUROS VICTORIA S.A.', cuit: '30500032266' },
  Zurich: { razonSocial: 'ZURICH ARGENTINA COMPAÑIA DE SEG', cuit: '30500049770' },
}

const clave = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

const POR_CLAVE = new Map(Object.entries(DATOS_CP).map(([nombre, d]) => [clave(nombre), d]))

/** Datos de la pestaña CP para un nombre de compañía de la planilla ("F. Patronal", "S. Cristobal"…). */
export function datosCompania(nombre: string) {
  return POR_CLAVE.get(clave(nombre)) ?? null
}
