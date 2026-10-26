# MRIvue
Desktop-style viewer for brain volumes and meshes (MRIcroGL/Surfice style), built on NiiVue. Runs as a web page or an installed app (Chrome/Edge); Safari and Firefox open files by picker/drop and save by download.

## Features
- Volumes, meshes, mesh layers, tracts and connectomes in one scene and one layer tree. Starts with the MNI152 template (Preferences to turn off).
- Drop, picker, Open Folder, Open Recent, OS "Open With" (installed app).
- Save documents (.nvd) in place, screenshots, volumes and meshes (MZ3). A failed open restores the previous scene.
- Window title shows the open document ("MRIvue: myScene", • when unsaved).
- Layer properties: colormap, range mode, per-layer colorbar, invert, outline, interpolation (hover for hints). Atlases (label layers) show region names in the status bar.
- Context panels: slices, mosaic, clip planes (presets), render, mesh, mesh layers, tracts (incl. tract groups dialog with per-group show/color), connectome, colorbar.
- Edit ▸ Undo/Redo (⌘Z/⇧⌘Z) for display settings.
- Scripting: right-edge rail (open editor, Run/Stop, Copy Prompt for AI), JavaScript `nv` API with a reference, Stop. `nv.resetScene()` restores fixed defaults.
- 26 templates (Script ▸ Templates, pick to run): atlas, basic, basic_paint_surface, clip, ct_abdomen, ct_head, cutout, embeddedMesh, explode, fmri_mesh, glass, hide_curves, hidezeros, invert, jagged, matcapPainted, mesh, mip, mosaic, mosaic2, newer_2017, node, shaders, track, tract_groups, VoxelPlusMesh.
- Share scripts as links (Script ▸ Copy Link, `#script=`); opening or pasting a link or script shows it for review and never runs it automatically.
- Bare file names in scripts resolve from cache, workspace folder or Recent.
- Volume-to-surface projection for Add Mesh Layer….
- Offline after first use; pinned demo samples cached by the service worker.
- Light/dark themes, preferences, keyboard-accessible menus, tree and dialogs.
- Install as an app: File ▸ Install as App… (own window, offline use, opens files from Finder/Explorer).
- AI assistants: `/pwa/llms.txt` brief and Help ▸ Copy Prompt for AI.

## Sample data licenses
Per-file licenses are in `src/catalog.json` (`about`) and `/pwa/llms.txt`; same-origin sample credits in `public/samples/README.md`. The BrainMesh_ICBM152 meshes come from BrainNet Viewer (GPL-3.0); replacements are being evaluated.

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
