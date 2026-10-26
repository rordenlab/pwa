// Generate public/llms.txt (the AI brief) from the pinned NiiVue types, the sample catalog and templates.
// Run: bun scripts/llms.ts (also runs before every build; a unit test fails if the file is stale).
import { readFileSync, writeFileSync } from 'node:fs'
import catalog from '../src/catalog.json' with { type: 'json' }
import { aiBrief } from '../src/script/aiBrief'
import { parseMembers, parseTypeFields } from '../src/script/apiParse'

const root = new URL('..', import.meta.url).pathname
const read = (p: string) => readFileSync(root + p, 'utf8')
const EXAMPLES = ['basic', 'basic_paint_surface', 'explode']

export function generate(): string {
  const dist = 'node_modules/@niivue/niivue/dist/'
  const typesDts = read(`${dist}NVTypes.d.ts`)
  const about = catalog.about as Record<string, { desc: string; license: string }>
  return aiBrief({
    version: JSON.parse(read('package.json')).dependencies['@niivue/niivue'],
    members: parseMembers(read(`${dist}NVControlBase.d.ts`)),
    types: Object.fromEntries(
      [
        'ImageFromUrlOptions',
        'MeshFromUrlOptions',
        'MeshLayerFromUrlOptions',
        'NVTractOptions',
        'NVConnectomeOptions',
      ].map((t) => [t, parseTypeFields(typesDts, t)]),
    ),
    samples: Object.entries(catalog.groups).flatMap(([group, paths]) =>
      paths.map((p) => {
        const name = p.slice(p.lastIndexOf('/') + 1)
        return { name, group, ...about[name] }
      }),
    ),
    examples: EXAMPLES.map((name) => ({ name, code: read(`src/script/templates/${name}.js`) })),
  })
}

if (import.meta.main) writeFileSync(`${root}public/llms.txt`, generate())
