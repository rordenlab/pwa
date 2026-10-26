/** `#script=<code>` in a URL or pasted text; group 1 is the code. */
export const LINK = /#script=([\w-]+)/

// Shared script links: `#script=<base64url(gzip(utf8))>`. The fragment never reaches the host.
// Plain base64url UTF-8 is accepted too, since assistants can write that but not gzip.

const toB64url = (b: Uint8Array) =>
  btoa(Array.from(b, (c) => String.fromCharCode(c)).join(''))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const pipe = async (b: Uint8Array<ArrayBuffer>, t: CompressionStream | DecompressionStream) =>
  new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(t)).arrayBuffer())

export const encodeScript = async (code: string) =>
  toB64url(await pipe(new TextEncoder().encode(code), new CompressionStream('gzip')))

// Far beyond any real script; bounds memory for hostile links (a few KB of gzip can expand to GBs).
export const MAX_SCRIPT = 1 << 20

/** Gunzip, stopping as soon as the output passes MAX_SCRIPT. */
async function inflate(b: Uint8Array<ArrayBuffer>) {
  const reader = new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip')).getReader()
  const parts: Uint8Array[] = []
  let size = 0
  for (let r = await reader.read(); !r.done; r = await reader.read()) {
    size += r.value.length
    if (size > MAX_SCRIPT) {
      reader.cancel()
      throw new Error('script too large')
    }
    parts.push(r.value)
  }
  return new Uint8Array(await new Blob(parts as BlobPart[]).arrayBuffer())
}

export async function decodeScript(s: string) {
  const b = Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
  const gz = b[0] === 0x1f && b[1] === 0x8b
  if (!gz && b.length > MAX_SCRIPT) throw new Error('script too large')
  return new TextDecoder().decode(gz ? await inflate(b) : b)
}
