// Parse NiiVue's published type declarations (pure: shared by the in-app reference and the AI brief).

export type Entry = { name: string; sig: string; doc: string; settable: boolean }

const MEMBER = /^ {4}(?:(async) )?(get )?([a-zA-Z]\w*)(\(.*\)): (.*);$/
const firstSentence = (doc: string[]) => (doc.join(' ').split(/\s{2,}|(?<=\.) (?=[A-Z])/)[0] ?? '').trim()

/** Public methods and getters (with their first doc sentence) of a class declaration. */
export function parseMembers(dts: string): Entry[] {
  const out = new Map<string, Entry>()
  const setters = new Set([...dts.matchAll(/^ {4}set (\w+)\(/gm)].map((m) => m[1]))
  let doc: string[] = []
  let inTag = false // @example code etc. is not prose (and uses names like nv1)
  for (const line of dts.split('\n')) {
    const t = line.trim()
    if (t.startsWith('/**')) {
      doc = []
      inTag = false
    }
    if (t.startsWith('*') || t.startsWith('/**')) {
      const text = t
        .replace(/^\/?\*+\/?\s?/, '')
        .replace(/\*\/$/, '')
        .trim()
      if (text.startsWith('@')) inTag = true
      if (!inTag && text) doc.push(text)
      continue
    }
    const m = line.match(MEMBER)
    if (m && !out.has(m[3])) {
      const [, , getter, name, args, ret] = m
      out.set(name, {
        name,
        sig: getter ? `nv.${name}: ${ret}` : `nv.${name}${args}: ${ret}`,
        doc: firstSentence(doc),
        settable: !!getter && setters.has(name),
      })
    }
    if (t && !t.startsWith('*')) doc = []
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Fields of `export type Name = { ... }` as "name?: type — first doc sentence". */
export function parseTypeFields(dts: string, name: string): string[] {
  const start = dts.indexOf(`export type ${name} = {`)
  if (start < 0) return []
  const end = dts.indexOf('\n};', start)
  const fields: string[] = []
  let doc: string[] = []
  for (const line of dts.slice(start, end).split('\n').slice(1)) {
    const t = line.trim()
    if (t.startsWith('/**') || t.startsWith('*')) {
      const text = t
        .replace(/^\/?\*+\/?\s?/, '')
        .replace(/\*\/$/, '')
        .trim()
      if (text && !text.startsWith('@')) doc.push(text)
      continue
    }
    const m = t.match(/^(\w+\??): (.*);$/)
    if (m) fields.push(`${m[1]}: ${m[2]}${doc.length ? ` — ${firstSentence(doc)}` : ''}`)
    doc = []
  }
  return fields
}
