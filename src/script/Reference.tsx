import { useMemo, useState } from 'react'
import { reference } from './apiDocs'

/** Searchable list of the `nv` API (Help ▸ Scripting Reference). Click inserts the name. */
export default function Reference({ insert }: { insert: (text: string) => void }) {
  const all = useMemo(reference, [])
  const [q, setQ] = useState('')
  const hits = all.filter((e) => `${e.name} ${e.doc}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="reference">
      <input
        type="search"
        placeholder={`Filter ${all.length} methods and properties`}
        aria-label="Filter reference"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <ul>
        {hits.map((e) => (
          <li key={e.name}>
            <button type="button" className="link" onClick={() => insert(`nv.${e.name}`)}>
              <code>{e.sig}</code>
            </button>
            {e.doc && <p>{e.doc}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}
