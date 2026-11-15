import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { descomprimirJson } from '../src/lib/comprimido'

describe('datos comprimidos del servidor', () => {
  it('descomprime lo mismo que se mandó (con acentos y ñ)', async () => {
    const datos = { comprobantes: [{ id: 'a', texto: 'Compañía · Rocamora' }], n: 9207 }
    const b64 = gzipSync(Buffer.from(JSON.stringify(datos), 'utf8')).toString('base64')
    expect(await descomprimirJson(b64)).toEqual(datos)
  })
})
