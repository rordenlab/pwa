import catalog from './catalog.json'

// Pinned demo data (plan §8): `samples/` is same-origin, everything else the pinned CDN commit.
export type Sample = { group: string; name: string; url: string }

// `labels` (atlas label tables) resolve by name in scripts but are not openable from the menu.
export const samples: Sample[] = Object.entries({ ...catalog.groups, Labels: catalog.labels }).flatMap(
  ([group, paths]) =>
    paths.map((p) => ({
      group,
      name: p.slice(p.lastIndexOf('/') + 1),
      url: p.startsWith('samples/') ? `${import.meta.env.BASE_URL}${p}` : catalog.cdn + p,
    })),
)
export const groups = Object.keys(catalog.groups)
