# MRIvue
Desktop-style viewer for brain volumes and meshes (MRIcroGL/Surfice style), built on NiiVue. Runs as a web page or an installed app (Chrome/Edge); Safari and Firefox open files by picker/drop and save by download.

## Features
- Volumes, meshes, mesh layers, tracts and connectomes in one scene and one layer tree.
- Drop, picker, Open Folder, Open Recent, OS "Open With" (installed app).
- Save documents (.nvd) in place, screenshots, volumes and meshes (MZ3). A failed open restores the previous scene.
- Window title shows the open document ("MRIvue: myScene", • when unsaved).
- Context panels: slices, mosaic, clip planes, render, mesh, mesh layers, tracts, connectome, colorbar.
- JavaScript scripting with the `nv` API, 22 templates (pick to run), Stop, and a scripting reference.
- Bare file names in scripts resolve from cache, workspace folder or Recent.
- Volume-to-surface projection for Add Mesh Layer….
- Offline after first use; pinned demo samples cached by the service worker.
- Light/dark themes, preferences, keyboard-accessible menus, tree and dialogs.

- Install as an app: File ▸ Install as App… (own window, offline use, opens files from Finder/Explorer).
- AI assistants: `/pwa/llms.txt` brief and Help ▸ Copy Prompt for AI.

Live: https://rordenlab.github.io/pwa/ (GitHub Pages; `.github/workflows/deploy.yml` lints, tests, builds and publishes `dist/` to the `gh-pages` branch on every push to main).

## Commands
```bash
bun install
bun run dev      # http://localhost:5173/pwa/
bun run build    # dist/, deploy under /pwa/
bun run lint && bun run test && bun run e2e
```

## Test prerequisites
- `npx playwright install chromium webkit firefox`
- Template tests serve pinned demo data from a local niivue-demo-images clone if present (`DEMO_IMAGES=/path/to/clone`, default `../niivue-demo-images` next to this repo), otherwise from the pinned jsDelivr CDN (needs network). They never skip.
- `tests/prod.spec.ts` needs network for its online pass (real pinned jsDelivr URLs); set `OFFLINE_ONLY=1` to skip it.
- Visual check: `SHOTS=basic,node SHOT_DIR=/tmp npx playwright test tests/shot.spec.ts`.

## Deploy
GitHub Pages subpath `/pwa/` (`base` in `vite.config.ts`; manifest scope and start_url match).

## Docs
Design notes, progress and audit responses are kept locally (not in the repository).
