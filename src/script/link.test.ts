import { expect, test } from 'vitest'
import { decodeScript, encodeScript, MAX_SCRIPT } from './link'

test('script links round-trip byte for byte; plain base64url is accepted', async () => {
  const code = 'await nv.loadVolumes([{ url: \'spm152\' }]) // µ → 脳\n\ttabs, "quotes" + / = ?'
  const link = await encodeScript(code)
  expect(link).toMatch(/^[\w-]+$/)
  expect(await decodeScript(link)).toBe(code)
  const plain = Buffer.from(code).toString('base64url')
  expect(await decodeScript(plain)).toBe(code)
})

test('links that expand past MAX_SCRIPT are rejected while decompressing', async () => {
  const bomb = await encodeScript(' '.repeat(MAX_SCRIPT + 1)) // ~1 KB link
  await expect(decodeScript(bomb)).rejects.toThrow('too large')
})
