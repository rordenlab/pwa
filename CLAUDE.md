# MRIvue (NiiVue PWA)

**MRIvue**: desktop-style NiiVue viewer (MRIcroGL/Surfice look) as a web page and installable PWA: volumes, meshes, tracts, connectomes in one scene; menubar, context panels, script editor. React 19 + Vite 8 + TS, bun, `@niivue/niivue` 1.0.0-rc.37 (exact pin, `@niivue/niivue/webgl2`). Local (gitignored) notes: `plan_pwa.md` (§2 decisions, §15 accepted answers), `plan_ai.md` (next goal), `progress_pwa.md`, `audit_response.md`.

## Commands
```bash
bun install
bun run dev      # http://localhost:5173/pwa/
bun run build    # tsc + vite build → dist/ (base /pwa/)
bun run lint     # biome check src tests
bun run test     # vitest, src/**/*.test.ts (5)
bun run e2e      # playwright: chromium, webkit, firefox, prod (79)
```
- e2e prerequisite: `npx playwright install chromium webkit firefox`.
- Template tests use a local niivue-demo-images clone if present (`DEMO_IMAGES`, default `../niivue-demo-images`), else the pinned jsDelivr CDN. Never skip.
- `tests/prod.spec.ts` (built app + service worker) needs network; `OFFLINE_ONLY=1` skips it.
- Visual check: `SHOTS=basic,node SHOT_DIR=/tmp npx playwright test tests/shot.spec.ts`, then view the PNGs.
- WebKit/Firefox run only the non-FSA fallback subset (see `playwright.config.ts`).

## Architecture
- `src/nv.ts` — the single NiiVue instance; revision store (`useNv(select)` via useSyncExternalStore, `bump()`); `attach()`.
- `src/doc.ts` — document state (`doc.revision`, `doc.id`, dirty), open/save/close, `markChanged()`, screenshot, volume/MZ3 export. `doc` is on globalThis like `nv` (tests read `doc.dirty`).
  - Every scene replacement (open .nvd, Close All, replace with data, script document) goes through `transition()`, which runs inside the drop queue (`enqueue` in `io/files.ts`). Never call `enqueue`/`closeAll`/`transition` from inside a queued task (deadlock). `transition()` = queue + `doc.busy`; `replace()` = snapshot/run/rollback. On failure it rolls back the scene and restores doc id/name/handle/dirty.
  - Rollback carries per-layer app data (`layerData()`/`restoreLayerData()`, by `liveLayers()` position: volumes, then each mesh followed by its layers) and the selection.
  - `saveDocument` captures handle + `doc.id` up front; clears dirty only for the same document and revision.
  - Title: "MRIvue" for an unnamed scene; "MRIvue: myScene" (+ " •" unsaved) once a .nvd is opened/saved (`App.tsx`).
- `src/state.ts` — app-owned state (selection, notifications). `app.selection` is position-shaped but backed by the selected object (`select`), re-derived on every add/remove/reorder/documentLoaded event (`follow`). `selectedSurfaceObject()` for work that waits. `src/layers.ts` — layer tree model (`moveVolumeTo` re-finds the volume each step). `src/prefs.ts` — localStorage prefs.
- `src/io/` — the only boundary for FSA, `<input>`, downloads, launchQueue, IndexedDB handles (`fs.ts`, `idb.ts`, `files.ts` drop/add queue, `classify.ts`, `project.ts` volume→mesh projection).
- `src/script/run.ts` — runner, cooperative Stop, `nv` proxy (bumps UI, marks eventless edits dirty). Script `nv.loadDocument` → `scriptDocument()` (queued, no handle, throws on failure). Locate dialogs serialized (`locateInTurn`); run end/Stop closes them (`finally`); a stale picker can't close a newer dialog. `Token.docId`: script stops ("another scene was opened") if `doc.id` changes under it; its own `loadDocument` updates it. `check(t)` also fails while `doc.busy` (another transition), except during the script's own `loadDocument` (`t.ownTransition`). Proxy `set`/`defineProperty`/`deleteProperty` call `check(t)`; `setPrototypeOf` refused. `QUEUED`: async core loaders without file args run in the scene queue. Listeners added via `nv.addEventListener` are removed at run end; console output from a finished run is dropped.
  - Accepted (trusted scripts): `globalThis.nv`/`doc` and raw objects read through the proxy (`nv.volumes[i]`, `.img`, `mesh.layers`) bypass checks — mutate through `nv` methods. Microtask window after a script's own `loadDocument` before `t.docId` updates.
- `src/script/resolve.ts` — bare-name resolver: live layers first (never cached), then cache, workspace, Recent, Locate; `resetResolver()` on document change (workspace change clears only the cache).
- `src/script/templates/*.js` + `templates.ts` (Script ▸ Templates auto-runs bundled code; files/drops never auto-run); `apiDocs.ts`/`Reference.tsx` — reference parsed from pinned d.ts (lazy chunk).
- `src/panels/` — `Layers` (rows keyed by `idOf` WeakMap id), `LayerProps` (no mesh-layer controls), `context.tsx` (context sections + icon strip; `MeshLayersPanel` = Mesh layers section with mesh›layer picker synced to tree), `fields.tsx`, `icons.tsx` (`MeshIcon`, `MeshLayerIcon`, `ColorbarIcon`).
- `src/App.tsx` — layout (storage id `main-v2`, tools panel default 240px).
- `src/menu/menus.ts` — menus as data; `Menubar.tsx` renders; `keys.ts` shortcuts.
- `src/catalog.json` — samples: pinned CDN commit or same-origin `public/samples/`.
- `vite.config.ts` — base, manifest, file_handlers, workbox runtime caching.

## Conventions & gotchas
- NiiVue azimuth = 360 − Surfice/MRIcroGL azimuth.
- L/R/A/P/S/I: in 2D step the crosshair one voxel (`moveCrosshairInVox`, RAS grid); in 3D turn the camera.
- Cutaway clip planes remove the mirrored octant: plane [d,az,el] removes toward (360−az, −el).
- Unused clip planes sit at depth ±2.
- rc.37 does not clip meshes (volumes only).
- `setCrosshairPos` takes mm.
- Core colormap names are capitalized; lookup is case-insensitive.
- `setClipPlanes`, rename, `loadMatcap` emit no event → call `markChanged()`. Camera props don't dirty.
- Workbox runtime-cache matchers must be regexes (closures are lost on serialization). The CDN regex built from `catalog.cdn` escapes only `.`.
- Playwright routing bypasses the SW cache (prod test uses real CDN URLs).
- Fake FileSystemHandles can't be stored in IndexedDB; tests use OPFS handles.
- Projected NIfTI→mesh layer must be named `.mz3`.
- NaN masking fails on scaled integer volumes.
- Radix Tooltip needs `disableHoverableContent`.
- Radix Menubar trigger keeps focus after a pick: style only `[data-state=open]` / `:focus-visible`.
- CodeMirror inserts dropped files as text unless a `domEventHandlers({drop})` handler claims it (`Script.tsx`).
- CSS `::before` checkmark uses `content: "✓" / ""` (keeps it out of accessible names).
- StrictMode double effects are guarded in `attach()`.
- Every e2e test fails on console errors (`tests/util.ts` fixture; `allowedConsole` option for expected ones).

- Script loads run inside the scene queue (`enqueue`); their file references (and Locate dialogs) resolve before queueing. Transitions take a `proceed()` predicate checked when they run.
- `sources` (resolver) are set only after a successful load. Fetch via `io/fs.ts` `fetchFile()` (checks `res.ok`).
- Render panel: MatCap "(none)" ⇔ `volumeIllumination` 0 (derived, not stored); slider min 0.05 while lit.

- Saves: `saveTo()` in doc.ts picks the destination first, then serializes and writes inside the scene queue. Script saves use their own ordered chain.
- Script sources: `WeakMap` keyed by layer object (`retain`, `retainNew` after script loads); never key by file name.
- Hold objects (mesh, volume, layer), never indices, across any await (incl. queue, picker, projection); re-find with `indexOf` just before use. Capture the target at call/drop time (`selectedSurfaceObject`, script `nv.addMeshLayer`). Sync index handlers are fine (core binds the object before its first await).
- Per-layer app data (WeakMaps: `sourceOf`, `app.sidecars`, `hiddenOpacity`) must be added to `layerData()`/`restoreLayerData()` in doc.ts, or rollback loses it. Keep the maps separate.
- New layers from a load: diff `layerSet()` before/after; never attach to "the last" layer.
- Selection follows objects automatically: don't re-select after moves/reorders.
- Layer-list rows keyed by `idOf(object)`, never by index.
- Property controls in context.tsx: `bind(k)` helper, not inline `onChange` setters.
- Strip icons: `data-state` shown/hidden/unused (`aria-disabled`; Playwright needs `force` to click those).

- Quality: View ▸ Quality / Preferences — MSAA (default on) and resolution (Auto = device ratio capped at 2, High-DPI, Standard 1×), applied via `nv.reinitializeView`; `pixelRatio()` in prefs.ts. Narrow screens (≤600px) get one ☰ menu and start with panes collapsed. Headless test rendering is software: MSAA makes tract templates ~4× slower (template test timeout 120 s).

- AI brief: `public/llms.txt` is generated (`bun run llms`, also in `bun run build`) by `scripts/llms.ts` from `src/script/aiBrief.ts` (curated API `CURATED`), `apiParse.ts` (d.ts parsers), `catalog.json` (`about`: description + license per file) and three templates. `aiBrief.test.ts` fails if it is stale or a curated name vanishes. Help ▸ Copy Prompt for AI = brief + current scene (clipboard via promise for Safari). Next steps: plan_ai.md.

- Hosting: GitHub Pages at https://rordenlab.github.io/pwa/ via `.github/workflows/deploy.yml` (bun 1.3.13: install --frozen-lockfile, lint, unit tests, build → `gh-pages`). Playwright e2e is local only. `plan*.md`, `progress*.md`, `audit*.md` are gitignored (local notes).

- Install: `src/install.ts` captures `beforeinstallprompt`; File ▸ Install as App… prompts or shows per-browser steps; hidden when `display-mode` is standalone/WCO.

- Overlay interpolation: no UI toggle. Core (rc.37) colors overlay voxels (incl. threshold) before GPU filtering, so `isNearestInterpolation` does not visibly change thresholded overlays; MRIcroGL-style smooth overlays (interpolate, then threshold) would need a core change.
- App icon: MRIcroGL artwork (`public/favicon.svg` from MRIcroGL's mricrogl.svg; `icon-192/512.png` rendered from it with rsvg-convert); manifest icons purpose `any` (no maskable safe zone).

## Rules
- Commit only when asked.
- Verify lint/tsc/tests by exit code (`bun run lint; echo $?`), never by grepping the last output line.
- `src/io` stays the only FSA/download module.
- Lean code: no defensive layering, no speculative abstractions (owner preference).
- mono and niivue-demo-images are read-only (plan §15.3).
- Update `progress_pwa.md` each iteration.
