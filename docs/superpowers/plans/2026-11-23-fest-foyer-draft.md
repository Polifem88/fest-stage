# Фойе (`foyer`, Этап 1 — черновик) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` with Antigravity **Swarm (`swarm`)** — Tasks 0–1 run sequentially on the coordinator to lock the shared config contract, Tasks 2–4 fan out in parallel to 3 disjoint workers (`@arch`, `@trusses`, `@interior` in `workspace: "share"`), then Tasks 5–8 integrate, verify via `@verifier`, preview, and release. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and ship the `draft` 3D venue module `fest-foyer` (`#v=foyer`) covering the two-story foyer architecture, bent 13+9 staircase with railings, open panoramic glazing, complete `Q25/31` aluminium truss system, static furniture, stationary orange staircase curtain, and duty lighting, merged into `master` with 100% parity on all 3 `ready` venues.

**Architecture:** Modular venue package under `app/src/venues/fest-foyer/` (`config/` SSOT + 8 focused `build/` modules + `index.js`) registered via `catalog.js` and `registry.js`. Reuses `venues/_template/trusses.js` untouched for orthogonal/vertical trusses and adds a local sloped/canted helper in `fest-foyer/build/trusses.js`; appends 7 new general-purpose materials to the end of `core/materials.js`.

**Tech Stack:** Three.js (r170+), Vite + `vite-plugin-singlefile`, Vitest (unit/contract/boundary tests), Playwright + Chromium (visual shots, E2E, perf, parity), PowerShell on Windows (`npm.cmd`/`npx.cmd`).

**Spec:** [`docs/superpowers/specs/2026-11-23-fest-foyer-draft-design.md`](../specs/2026-11-23-fest-foyer-draft-design.md)

---

## Global Constraints

- **Module boundaries (`boundaries.test.js`):** shared code (`core/`, `engine/`, `systems/`, `ui/`, `library/`, `export/`, `_template/`) MUST NOT contain venue ids/names (`foyer`, `фойе`) or import `venues/*` (except `catalog.js`/`registry.js`); `fest-foyer` MUST NOT import other venues.
- **No magic numbers:** all room dimensions, axes, elevations, column/stair/truss/screen/counter coords come strictly from `fest-foyer/config/dimensions.js`; visual detail proportions (baluster collar height, frame thickness) live as named constants at the top of their builder.
- **Materials append-only:** new materials in `app/src/core/materials.js` MUST be appended strictly at the end of `createMaterials()` so draw order of `big`, `chamber`, `roof` stays byte/pixel identical.
- **Single-file & mobile budgets (`perf.spec.js`):** `dist/desktop.html` & `dist/mobile.html` ≤ 1.3 MB, `dist/index.html` ≤ 0.1 MB, `file://` loads cleanly without network; mobile WebGL budget `calls ≤ 150`, `triangles ≤ 200 000`, `cpuMs < 33.3 ms` at 4× CPU slowdown.
- **100% parity on `ready` venues:** `big`, `chamber`, `roof` must pass `node scripts/parity.mjs compare` with exit code 0 against a fresh `master` baseline captured in Task 0.
- **Stable layer order:** `['walls','windows','stairs','curtain','furniture','ceiling','trusses','lights','duty']` — never reorder; Stage 2 layers (`hall`, `blinds`) append at the end only.
- **Synchronous `ASSUMPTIONS.md`:** every `assumption: true` entry in `fest-foyer/config/dimensions.js` MUST have a matching row in `ASSUMPTIONS.md` in the same commit.
- **10-commit backup rule (`AGENTS.md` §5):** check `git rev-list --count HEAD` after every commit; whenever `% 10 === 0` (starting with **commit #110**, then #120), run `cd app; npm.cmd run backup` and verify 100% match + ZIP listing.
- **Windows / PowerShell:** every shell call starts fresh (`cd app;`), use `npm.cmd`/`npx.cmd`, UTF-8 output encoding when inspecting Cyrillic paths.

---

## Review Focus

1. **Mobile triangle explosion on `ОГ-2` railings & 22.25 m truss grid:** naive dense balusters (`0.10 m` spacing across ~74 m of railings = 700+ cylinders) + full truss lacing would blow past the 200k mobile triangle budget — pin desktop vs mobile triangle budgets in `foyer.test.js` (`mobile < 90 000` triangles for foyer alone) and verify in `perf.spec.js`.
2. **Ceiling occluding `overview` and `plan` views:** if 2nd-floor ceiling panels are `DoubleSide` or flipped upward, top-down views render a blank grey roof — pin downward-only `FrontSide` normals (`ny < -0.5` on every ceiling triangle) in `foyer.test.js` and visually verify `overview` & `plan` shots.
3. **Bent staircase geometry & clearance under ceiling/truss:** upper (9 risers) + lower (13 risers, 28°) flights must meet cleanly at `Y = 1.75` and `Y = 3.00`, stay strictly inside the atrium void, and LED screen top (`Y = 6.765`) must stay below the `Y = 7.00` truss — pin exact height/clearance invariants in `foyer.test.js`.
4. **Empty `fixtures.list` & last `'soon'` venue removed:** `venues.spec.js` previously asserted `foyer` is disabled (`aria-disabled="true"`), and `state.test.js` / `shots.spec.js` / `perf.spec.js` must exercise `foyer` without console errors, empty-geometry `EdgesGeometry` crashes in blueprint mode (`+bp`), or broken `#v=foyer` URL round-trips.
5. **`fest-roof` and `fest-studio` untouched parity:** `_template/trusses.js` must remain completely unmodified; `core/materials.js` changes are append-only; parity diff on `big`, `chamber`, `roof` must be 0 bytes / 0 pixels.

---

## Swarm Parallel Topology

| Phase | Owner | Tasks | Files Owned (disjoint!) |
|---|---|---|---|
| **Phase 0 (Setup)** | Coordinator | Task 0, Task 1 | parity baseline, `core/materials.js`, `fest-foyer/config/dimensions.js`, `fest-foyer/config/fixtures.js`, `tests/unit/foyer.config.test.js` |
| **Phase 1 (Parallel Fan-Out)** | `@arch` (`workspace: "share"`) | Task 2 | `fest-foyer/build/architecture.js`, `fest-foyer/build/stairs.js`, `fest-foyer/build/windows.js`, `tests/unit/foyer.arch.test.js` |
| **Phase 1 (Parallel Fan-Out)** | `@trusses` (`workspace: "share"`) | Task 3 | `fest-foyer/build/trusses.js`, `tests/unit/foyer.trusses.test.js` |
| **Phase 1 (Parallel Fan-Out)** | `@interior` (`workspace: "share"`) | Task 4 | `fest-foyer/build/interior.js`, `fest-foyer/build/curtain.js`, `fest-foyer/build/emitters.js`, `fest-foyer/build/ambient.js`, `fest-foyer/build/overlays.js`, `tests/unit/foyer.interior.test.js` |
| **Phase 2 (Integration)** | Coordinator | Task 5, Task 6 | merge worker branches, `fest-foyer/index.js`, `catalog.js`, `registry.js`, `ASSUMPTIONS.md`, `tests/unit/state.test.js`, `tests/e2e/{venues,shots,perf}.spec.js` |
| **Phase 3 (Verification)** | `@verifier` (`workspace: "inherit"`) | Task 7 | full `npm.cmd run check`, `parity.mjs compare`, `$env:VENUE='foyer'; npm.cmd run shots`, visual diff vs `data/foyer/Фото/`, spec audit |
| **Phase 4 (Release)** | Coordinator | Task 8 | user visual & localhost review, doc updates (`AGENTS.md`, `venue-module-authoring`), backup check, merge `foyer → master` & `git push` |

---

### Task 0: Fresh Parity Baseline from `master`

**Files:**
- Artifact (gitignored): `app/review/modular/baseline/dist-foyer-pre/`

**Interfaces:**
- Produces: verified fresh parity baseline of `big`, `chamber`, `roof` before any code edits.

- [ ] **Step 1: Build clean `master` and capture parity baseline**

Run (PowerShell):
```powershell
git checkout master
cd app; npm.cmd run build
Copy-Item -Recurse -Force dist review/modular/baseline/dist-foyer-pre
node scripts/parity.mjs capture review/modular/baseline/dist-foyer-pre
```
Expected: capture finishes with exit code 0 for `big`, `chamber`, `roof`.

- [ ] **Step 2: Self-verify baseline (mandatory per `AGENTS.md` §4.3)**

Run:
```powershell
cd app; node scripts/parity.mjs compare review/modular/baseline/dist-foyer-pre
```
Expected: exit code 0, 100% match across all 3 `ready` venues.

- [ ] **Step 3: Return to branch `foyer`**

Run:
```powershell
git checkout foyer
git rev-list --count HEAD
```
Expected: on branch `foyer`, clean working tree.

---

### Task 1: Append-Only Materials & `fest-foyer` SSOT Config Contract

**Files:**
- Modify: `app/src/core/materials.js` (append strictly at end of `createMaterials()`)
- Create: `app/src/venues/fest-foyer/config/dimensions.js`
- Create: `app/src/venues/fest-foyer/config/fixtures.js`
- Test: `app/tests/unit/foyer.config.test.js`

**Interfaces:**
- Consumes: `app/src/library/fixtureTypes.js` (`venueTypes`), `app/src/library/specs.js` (`SPECS`)
- Produces:
  - New material keys in `createMaterials()`: `tileFloorDark`, `plasterLight`, `plasterGray`, `ceilPerfGray`, `woodSlats`, `grilyato`, `velvetOrange` (general-purpose names, no venue names).
  - `export const FOYER` in `fest-foyer/config/dimensions.js` with keys:
    - `room`: `{ x0: -11.93, x1: 11.56, dGlass1: 0, dGlass2: -0.80, dWhite1: 14.13, dWall2: 20.22, y2: 3.00, slabThick: 0.30, tile: 0.597 }`
    - `ceil1`: `{ reception: 2.53, wardrobeSlab: 2.65, wardrobeGrilyato: 2.35, buffet: 2.82 }`
    - `ceil2`: `{ glassY: 9.20, shelfY: 8.50, shelfFromD: 2.58, stepD: 5.58, atriumY: 7.45, bendD: 14.10, wallY: 6.37 }`
    - `columns`: `{ outer: [...5], inner: [...4], extraB: {...}, pilasterA: {...} }` — exact `[x0, x1, d0, d1]` from Spec §2.2
    - `atrium`: `{ westD: 5.83, westX0: -10.25, westX1: 3.11, eastD: 14.17, eastX0: -6.15, eastX1: 2.55, southEdge: [[3.11, 5.83], [2.55, 14.17]], buffetEdgeD: 11.45, buffetX1: -6.15 }`
    - `stairs`: `{ width: 2.50, tread: 0.31, landingY: 1.75, lower: { risers: 13, angleDeg: 28.0, bottom: [[0.54, 9.21], [1.71, 11.43]], top: [[-2.78, 10.90], [-1.57, 13.18]] }, upper: { risers: 9, xTop: -6.15, xBot: -3.67, d0: 11.45, d1: 13.95 } }`
    - `railing`: `{ h: 0.95, inset: 0.10, railR: 0.0254, postR: 0.019, balusterR: 0.008, postStep: 1.00, balusterStep: 0.10, balusterStepMobile: 0.28, collarH: 0.18 }`
    - `smallStairs`: `{ x0: -7.90, x1: -4.92, d0: 18.93, d1: 20.22, y0: 3.00, y1: 3.84, risers: 5, assumption: true }`
    - `zones`: `{ elevator, vestibule, wardrobe, buffet, corridors, doors }` — exact coordinates from Spec §3.4
    - `windows`: `{ vb6, vb3, ok16 }` — exact spans & rolled blind boxes from Spec §4
    - `trusses`: `{ size: 0.25, tube: 0.04, brace: 0.016, pitch: 0.25, longitudinal: [...5], transverseX: [-11.25, -5.00, 0.25, 5.75, 8.38, 11.00], windowY0: 8.00, atriumY0: 7.00, wallY0: 6.00, stepD: 5.70, bendD: 14.10, wallD: 19.55, posts: [...], perimeter: { y0: 2.70, west: {...}, south: [[3.25, 5.98], [2.68, 14.00]] } }`
    - `screen`: `{ x: 11.56, protrude: 0.10, w: 5.12, h: 2.88, y0: 3.885, d0: 8.40, d1: 13.52 }`
    - `furniture`: `{ receptionB1, buffetB2, sofas1f, sofas2f, showcases }` (Spec §6.2, photo-placed sofas/showcases flagged `assumption: true`)
    - `curtain`: `{ pipeR: 0.016, stopStepFromBottom: 4, topY: 3.00, underStairBlack: {...} }` (Spec §6.3)
    - `duty`: `{ downlights1f, downlights2f, sconces, pendants, r: 0.09, assumption: true }`
    - `ambient`: `{ duty: { color: 0xffe4b8, decay: 1.35, full: 18, lite: 44 } }`
    - `zeroLineLabel`: `'d = 0 — внутреннее стекло витража 1-го этажа (ВБ6)'`
  - `export function foyerCeilY(d)` and `export function foyerTrussY0(d)` — pure piecewise functions returning exact ceiling `Y` and truss bottom `Y` for any `d ∈ [-0.80, 20.22]`.
  - `fest-foyer/config/fixtures.js`: exports `FIXTURES = []`, `TYPES`, `SPECS`, `GROUPS = {}`, `GROUP_SETS = []`, `LIGHT_PLANS = { full: [], lite: [] }` (identical shape to `fest-studio/config/fixtures.js`).

- [ ] **Step 1: Write failing unit tests in `app/tests/unit/foyer.config.test.js`**

Test assertions to include:
- `FOYER.room.dWall2 - FOYER.room.dGlass2` is `21.02` (±0.01) — matches measured `W1`.
- `FOYER.atrium.eastD - FOYER.atrium.westD` is `8.34` (±0.01) — matches `A1 = 8.44 − 0.10`.
- `FOYER.stairs.lower.risers === 13`, `FOYER.stairs.upper.risers === 9`, `landingY === 1.75`, `room.y2 === 3.00`.
- `foyerCeilY(-0.80) === 9.20`, `foyerCeilY(2.58) === 8.50`, `foyerCeilY(5.50) === 8.50`, `foyerCeilY(6.00) === 7.45`, `foyerCeilY(14.10) === 7.45`, `foyerCeilY(20.22) === 6.37`.
- `foyerTrussY0(0.00) === 8.00`, `foyerTrussY0(5.60) === 8.00`, `foyerTrussY0(6.00) === 7.00`, `foyerTrussY0(14.10) === 7.00`, `foyerTrussY0(19.55) === 6.00`.
- LED screen clearance: `FOYER.screen.y0 + FOYER.screen.h < FOYER.trusses.atriumY0` (`6.765 < 7.00`).
- Perimeter truss flush check: `FOYER.trusses.perimeter.y0 + FOYER.trusses.size <= FOYER.room.y2` (`2.95 <= 3.00`).
- Every photo-estimated item carries `assumption: true`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app; npx.cmd vitest run tests/unit/foyer.config.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Append the 7 materials to `app/src/core/materials.js`**

Add helper canvas textures (`tileGridTex`, `perfCeilTex`, `woodSlatsTex`, `grilyatoTex`) and append `tileFloorDark`, `plasterLight`, `plasterGray`, `ceilPerfGray`, `woodSlats`, `grilyato`, `velvetOrange` strictly at the end of `m = { ... }` in `createMaterials()`, plus `uvScale` entries (`tileFloorDark: 0.597`, `ceilPerfGray: 0.60`, `woodSlats: 0.50`, `grilyato: 0.40`). Keep names completely venue-agnostic.

- [ ] **Step 4: Implement `fest-foyer/config/dimensions.js` and `fest-foyer/config/fixtures.js`**

Write all verified constants from Spec §§1–6 and pure `foyerCeilY(d)` / `foyerTrussY0(d)` helpers.

- [ ] **Step 5: Run unit & boundary tests**

Run: `cd app; npx.cmd vitest run tests/unit/foyer.config.test.js tests/unit/boundaries.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add app/src/core/materials.js app/src/venues/fest-foyer/config/ app/tests/unit/foyer.config.test.js
git commit -m "Фойе (этап 1): материалы и конфигурация размеров (SSOT)"
```

---

### Task 2 [Swarm Worker `@arch`]: Architecture, Ceilings, Windows & Bent Staircase

**Files:**
- Create: `app/src/venues/fest-foyer/build/architecture.js`
- Create: `app/src/venues/fest-foyer/build/stairs.js`
- Create: `app/src/venues/fest-foyer/build/windows.js`
- Test: `app/tests/unit/foyer.arch.test.js`

**Interfaces:**
- Consumes: `FOYER`, `foyerCeilY` from `../config/dimensions.js`; `box`, `rect`, `wallWithHoles`, `P`, `StaticBatch` from `../../../core/geom.js`; `tubeBetween` from `../../_template/build.js`; `M` keys from Task 1.
- Produces:
  - `export function buildArchitecture(batch, M, { mobile = false } = {})` — adds floors 1F/2F (2F slab with exact trapezoidal atrium cutout & 0.30 m fascia edge), walls (brick `И`/`А` with pilasters & `ОК16*` cutouts, white wall 1F, grey wall 2F with corridor openings), both column rows (dark tile 1F, light plaster 2F), single-sided downward-facing ceilings (1F zones + 3-zone 2F ceiling + `1.05 m` vertical step at `d = 5.58`), elevator shaft, vestibule frame, wardrobe shell + grilyato + schematic coat racks, buffet niche + brick pier, Big Stage corridors + doors. Layers: `'walls'`, `'ceiling'`.
  - `export function buildStairs(batch, M, { mobile = false } = {})` — adds bent grand staircase (`13` angled risers at 28° + trapezoidal mid-landing `Y = 1.75` + `9` straight risers to `Y = 3.00`, stringers/under-slab), `ОГ-2` railings (`0.95 m` height, `Ø50.8` handrail, `Ø38` posts with brass collars `M.brass`, `Ø16` balusters using `balusterStep` on desktop and `balusterStepMobile` on mobile), and 5-step small staircase to booth (`Y = 3.00 → 3.84`). Layer: `'stairs'`.
  - `export function buildWindows(batch, M, { mobile = false } = {})` — adds open panoramic glazing `ВБ6` (`d = 0`), `ВБ3` (`d = −0.80`), vestibule glass `ВБ7/ВБ8`, end-wall slit windows `ОК16*`, aluminium mullions/transoms, and rolled-up blackout blind cassettes at top of bays (Stage 2 anchor). Layer: `'windows'`.

- [ ] **Step 1: Write failing tests in `app/tests/unit/foyer.arch.test.js`**

Use `fakeM` + `StaticBatch` (same pattern as `tests/unit/roof.test.js`):
- `buildArchitecture` produces non-empty meshes in tags `'walls'` and `'ceiling'`.
- **Ceiling normal check (Review Focus #2):** every triangle in tag `'ceiling'` (except the vertical step strip at `d = 5.58`) has downward normal `ny < -0.5` and uses single-sided material (`FrontSide`), so top-down views never get blocked.
- **2F atrium void check:** 2nd-floor slab geometry has zero horizontal triangles covering the atrium center `(x = −2, d = 10, y = 3.00)`.
- `buildStairs` generates 22 grand risers + 5 small risers, bounding box spans `Y ∈ [0, 4.80]`, and mobile build has significantly fewer triangles than desktop (`mobileTris < desktopTris * 0.65`, `mobileTris < 45_000` for stairs+railings — Review Focus #1).
- `buildWindows` emits geometry strictly into tag `'windows'` spanning `d ∈ [-0.85, 2.75]` and `Y ∈ [0, 9.20]`.

- [ ] **Step 2: Run test to verify failure**

Run: `cd app; npx.cmd vitest run tests/unit/foyer.arch.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement `architecture.js`, `stairs.js`, `windows.js`**

Key implementation rules:
- Build the 2F floor slab & 2F ceiling using `THREE.Shape` / `ShapeGeometry` (for the trapezoidal atrium cutout on `Y = 3.00`) or clean non-overlapping quads/triangles with consistent winding; verify downward normal (`ny < 0`) on all ceiling quads/shapes.
- Build the bent lower staircase flight by placing each of the 13 steps in the local frame of the 28° axis (origin at `(0.54, 9.21)`, width `2.50 m`, tread `0.31 m`, rise `1.75 / 13`), capped by the exact trapezoidal mid-landing (`Y = 1.75`) and 9 orthogonal upper steps (`d = 11.45..13.95`, `X = -3.67 → -6.15`).
- On `ОГ-2` railings, merge via `StaticBatch` (`tubeBetween` or slender boxes for balusters — using 4-sided prisms or 5-segment tubes on desktop and 4-sided prisms at `balusterStepMobile = 0.28` on mobile keeps triangle count super tight!).

- [ ] **Step 4: Run tests to verify pass**

Run: `cd app; npx.cmd vitest run tests/unit/foyer.arch.test.js`
Expected: PASS.

- [ ] **Step 5: Commit in worker workspace**

```powershell
git add app/src/venues/fest-foyer/build/architecture.js app/src/venues/fest-foyer/build/stairs.js app/src/venues/fest-foyer/build/windows.js app/tests/unit/foyer.arch.test.js
git commit -m "Фойе (этап 1): архитектура, потолки, витражи и ломаная лестница"
```

---

### Task 3 [Swarm Worker `@trusses`]: Complete `Q25/31` Aluminium Truss System

**Files:**
- Create: `app/src/venues/fest-foyer/build/trusses.js`
- Test: `app/tests/unit/foyer.trusses.test.js`

**Interfaces:**
- Consumes: `FOYER` from `../config/dimensions.js`; `trussLineTubes`, `trussPostTubes` from `../../_template/trusses.js` (**read-only — do NOT edit `_template/trusses.js`!**); `tubeBetween` from `../../_template/build.js`; `P` from `../../../core/geom.js`.
- Produces:
  - `export function angledTrussTubes(p0, p1, T, { mobile = false } = {})` — builds a 4-chord square truss along an arbitrary 3D segment `p0 → p1` (`[x, y0, d]` bottom-center endpoints) using an orthonormal cross-section frame (`side = normalize(dir × up)` and `orthoUp = side × dir`), with zigzag lacing on desktop and 4 chords only on mobile.
  - `export function buildTrusses(batch, M, { mobile = false } = {})` — adds all 5 longitudinal lines (`ФВ-1`, `ФВ-2`, `ФВ-2М`, `ФВ-3`, `ФВ-4`), all 6 transverse lines (window horizontal `8.00` + `1.00 m` vertical step-downs + atrium horizontal `7.00` + gallery sloped `7.00 → 6.00`), 2 floor-standing vertical posts (`3.00 m` at small stairs, `5.00 m` at screen corner + tie-in stub), and L-shaped perimeter truss (`Y = 2.70..2.95`, west orthogonal leg + south canted leg) into tag `'trusses'` with `M.trussAlu`.

- [ ] **Step 1: Write failing tests in `app/tests/unit/foyer.trusses.test.js`**

Test assertions:
- `angledTrussTubes` on a sloped gallery segment `([0.25, 7.00, 14.10] → [0.25, 6.00, 19.55])` returns 4 chords on `mobile: true` and `> 4` tubes (chords + lacing + end frames) on `mobile: false`; bounding box spans `Y ∈ [6.00, 7.25]` and `d ∈ [14.10, 19.55]`.
- `buildTrusses` emits all geometry strictly into tag `'trusses'` using `M.trussAlu`.
- Bounding box covers `Y ∈ [2.70, 8.25]` (from perimeter truss bottom `+2.70` to window truss top `+8.25`) and `X ∈ [-11.5, +11.5]`.
- **Mobile triangle budget (Review Focus #1):** `mobileTris < 35_000` (4-chord only, 6-sided cylinders).
- Verify `_template/trusses.js` has zero modifications.

- [ ] **Step 2: Run test to verify failure**

Run: `cd app; npx.cmd vitest run tests/unit/foyer.trusses.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement `fest-foyer/build/trusses.js`**

Use `trussLineTubes` for all axis-aligned horizontal runs (`ФВ-1..4`, window transverse segments, atrium transverse segments, west perimeter leg), `trussPostTubes` for the `6` vertical `1.00 m` drops (`Y = 7.00..8.00`) and `2` vertical floor posts (`3.00 m` and `5.00 m`), and `angledTrussTubes` for the `6` sloped gallery transverse segments (`Y = 7.00 → 6.00`) and the canted south perimeter leg (`Y = 2.70`).

- [ ] **Step 4: Run tests to verify pass**

Run: `cd app; npx.cmd vitest run tests/unit/foyer.trusses.test.js`
Expected: PASS.

- [ ] **Step 5: Commit in worker workspace**

```powershell
git add app/src/venues/fest-foyer/build/trusses.js app/tests/unit/foyer.trusses.test.js
git commit -m "Фойе (этап 1): система алюминиевых ферм Q25/31 (сетка, уклон, опуск и периметр)"
```

---

### Task 4 [Swarm Worker `@interior`]: Interior Furniture, Curtain, Duty Emitters & Overlays

**Files:**
- Create: `app/src/venues/fest-foyer/build/interior.js`
- Create: `app/src/venues/fest-foyer/build/curtain.js`
- Create: `app/src/venues/fest-foyer/build/emitters.js`
- Create: `app/src/venues/fest-foyer/build/ambient.js`
- Create: `app/src/venues/fest-foyer/build/overlays.js`
- Test: `app/tests/unit/foyer.interior.test.js`

**Interfaces:**
- Consumes: `FOYER` from `../config/dimensions.js`; `box`, `rect`, `P` from `../../../core/geom.js`; `tubeBetween` from `../../_template/build.js`; `buildDimsFromList`, `fmtM` from `../../../core/overlays.js`.
- Produces:
  - `export function buildInterior(batch, M, { mobile = false } = {})` — adds LED screen `5.12 × 2.88` (tag `'walls'`), counters `B1`, `B2`, wardrobe counter (`M.woodSlats` + dark countertop), orange ribbed sofas on 1F & 2F (`M.velvetOrange` + dark seat + wood plinth), and 5 glass display cases on 2F (tag `'furniture'`).
  - `export function buildCurtain(batch, M, { mobile = false } = {})` — adds black curtain pipe (`Ø32`) clamped to staircase balusters, stationary orange velvet pleated drapery hanging from the pipe to `Y = 0` from top down to 4th step from bottom (`M.velvetOrange`), and black backstage curtain under upper flight (`M.molton`). All in tag `'curtain'` (clean hook for Stage 2 swap/hide!).
  - `export function buildEmitters(M)` → `{ groups: { duty, house }, dutyPoints }` (direct children of `groups.duty` with `userData.emitter = 'duty'`; `groups.house` empty Group — matching `fest-studio/build/emitters.js` contract!).
  - `export function ambientLights(plan, em)` → `{ duty, blue: [], house: [] }` (`full`: 4–6 PointLights across 1F & 2F; `lite`: 2 PointLights).
  - `export function buildDims(labels)` and `export function buildGrid(labels)` — 2D/3D dimension lines (width `23.49`, depth `21.02`, atrium `8.34`, heights `3.00 / 6.37 / 7.45 / 8.50 / 9.20`) and `1 m` floor grid + `FOYER.zeroLineLabel`.

- [ ] **Step 1: Write failing tests in `app/tests/unit/foyer.interior.test.js`**

Test assertions:
- `buildInterior` places LED screen in `'walls'` (`Y ∈ [3.88, 6.77]`, `d ∈ [8.35, 13.57]`) and sofas/counters/showcases in `'furniture'`.
- `buildCurtain` emits non-empty geometry strictly in tag `'curtain'`, with orange curtain bottom reaching `Y = 0` and top ≤ `Y = 3.05`.
- `buildEmitters(fakeM)` returns `{ groups: { duty, house } }` where every child of `groups.duty` has `userData.emitter === 'duty'` and `groups.house.children.length === 0`.
- `ambientLights('full', em).duty.length >= 4` and `ambientLights('lite', em).duty.length <= 3`.
- Mobile triangle count for interior + curtain `< 25_000`.

- [ ] **Step 2: Run test to verify failure**

Run: `cd app; npx.cmd vitest run tests/unit/foyer.interior.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement `interior.js`, `curtain.js`, `emitters.js`, `ambient.js`, `overlays.js`**

Follow `fest-studio/build/{emitters,ambient,overlays}.js` idioms closely so `LightingSystem` and `OverlaySystem` integrate seamlessly.

- [ ] **Step 4: Run tests to verify pass**

Run: `cd app; npx.cmd vitest run tests/unit/foyer.interior.test.js`
Expected: PASS.

- [ ] **Step 5: Commit in worker workspace**

```powershell
git add app/src/venues/fest-foyer/build/interior.js app/src/venues/fest-foyer/build/curtain.js app/src/venues/fest-foyer/build/emitters.js app/src/venues/fest-foyer/build/ambient.js app/src/venues/fest-foyer/build/overlays.js app/tests/unit/foyer.interior.test.js
git commit -m "Фойе (этап 1): мебель, LED-экран, оранжевая ткань, дежурный свет и оверлеи"
```

---

### Task 5 [Coordinator]: Merge Swarm Branches, Venue Assembly, Registration & `ASSUMPTIONS.md`

**Files:**
- Create: `app/src/venues/fest-foyer/index.js`
- Modify: `app/src/venues/catalog.js` (line 17: `foyer` → `status: 'draft'`, `type: 'Двухсветное фойе с парадной лестницей'`)
- Modify: `app/src/venues/registry.js` (add `foyer: () => import('./fest-foyer/index.js')`)
- Modify: `ASSUMPTIONS.md` (add §1.5 Фойе table covering every `assumption: true` flag in `fest-foyer/config/dimensions.js`, renumber existing §1.5 → §1.6)

**Interfaces:**
- Consumes: `buildArchitecture`, `buildStairs`, `buildWindows` (Task 2), `buildTrusses` (Task 3), `buildInterior`, `buildCurtain`, `buildEmitters`, `ambientLights`, `buildDims`, `buildGrid` (Task 4), `FOYER` & `fixtures.js` (Task 1).
- Produces: default export `VenueModule` in `fest-foyer/index.js` passing `validateVenue()` with 0 errors.

- [ ] **Step 1: Merge `@arch`, `@trusses`, `@interior` branches into `foyer`**

Land all 3 worker branches cleanly (zero conflicts expected because file ownership is strictly disjoint) and kill the 3 authoring workers only after verifying their commits are on `foyer`.

- [ ] **Step 2: Create `app/src/venues/fest-foyer/index.js`**

Wire all 9 layers in exact locked order (Spec §7), 8 views (`overview`, `atrium1f`, `gallery2f`, `stairs`, `windows2f`, `ceiling`, `plan`, `section`), `caps` (`duty: true`, others `false`), `fixtures` (`list: []`, `rectFloor`), `lightPlans`, `exports: {}`, and `build(ctx)`.

- [ ] **Step 3: Register `foyer` in `catalog.js` and `registry.js`, update `ASSUMPTIONS.md`**

Update `catalog.js:17`, add dynamic loader in `registry.js`, and document every `assumption: true` field in `ASSUMPTIONS.md`.

- [ ] **Step 4: Run all Vitest unit, contract, boundary, and parity-config tests**

Run: `cd app; npx.cmd vitest run`
Expected: ALL unit tests PASS (`venues.contract.test.js`, `boundaries.test.js`, `parity-config.test.js`, `foyer.*.test.js`).

- [ ] **Step 5: Commit (+ check 10-commit backup rule!)**

```powershell
git add app/src/venues/fest-foyer/index.js app/src/venues/catalog.js app/src/venues/registry.js ASSUMPTIONS.md
git commit -m "Фойе (этап 1): сборка модуля, регистрация в каталоге и реестр допущений"
git rev-list --count HEAD
```
If count `% 10 === 0` (watch for **commit #110**!), immediately run `cd app; npm.cmd run backup` and verify 100% match + ZIP!

---

### Task 6 [Coordinator]: Update Unit State Test & E2E Tests for `foyer` (`draft`)

**Files:**
- Modify: `app/tests/unit/state.test.js` (add `foyer` to v2 round-trip loop around line 50)
- Modify: `app/tests/e2e/venues.spec.js` (lines 33, 38, 108: `foyer` is now `draft` and opens instead of being disabled `'soon'` — update assertion so all 5 venues open and `studio` + `foyer` show «черновик»!)
- Modify: `app/tests/e2e/shots.spec.js` (line 130: add `'foyer'` to `OTHER_VENUES`)
- Modify: `app/tests/e2e/perf.spec.js` (line 44: add `'foyer:overview'`, `'foyer:plan'` to `otherCases`)

- [ ] **Step 1: Update `state.test.js` and run Vitest**

Run: `cd app; npx.cmd vitest run tests/unit/state.test.js`
Expected: PASS (v2 URL round-trip for `foyer` including `curtain: false` layer toggle and empty `fixturesOn`).

- [ ] **Step 2: Update `venues.spec.js`, `shots.spec.js`, `perf.spec.js`**

Ensure `venues.spec.js` verifies `#v=foyer` opens with «черновик» badge, zero console errors, and switches cleanly to/from `big`, `chamber`, `roof`, `studio`.

- [ ] **Step 3: Commit**

```powershell
git add app/tests/unit/state.test.js app/tests/e2e/venues.spec.js app/tests/e2e/shots.spec.js app/tests/e2e/perf.spec.js
git commit -m "Фойе (этап 1): подключение в тесты состояния, E2E, снимки и perf"
```

---

### Task 7 [Swarm Worker `@verifier`]: Full Check, Parity, Visual Shots & Spec Audit

**Files:**
- Verify (read-only audit + review screenshots in `app/review/shots/`)

- [ ] **Step 1: Run full `npm.cmd run check` (unit + single-file build + all Playwright E2E/perf/bundle-size/touch-targets)**

Run: `cd app; npm.cmd run check`
Expected: exit code 0; `dist/desktop.html` & `dist/mobile.html` ≤ 1.3 MB, `dist/index.html` ≤ 0.1 MB; mobile `foyer` `calls ≤ 150`, `triangles ≤ 200 000`, `cpuMs < 33.3 ms`.

- [ ] **Step 2: Run parity comparison against Task 0 `master` baseline**

Run: `cd app; node scripts/parity.mjs compare`
Expected: exit code 0, **100% match** for `big`, `chamber`, `roof` (byte-identical DXF/GLB, pixel-identical screenshots).

- [ ] **Step 3: Capture & visually inspect all Foyer shots vs real photos**

Run: `cd app; $env:VENUE='foyer'; npm.cmd run shots`
Inspect EVERY generated shot in `app/review/shots/<round>/<project>/foyer/` via `read_file` and compare side-by-side against `data/foyer/Фото/` (`143518`, `143535`, `143654`, `143717`, `172807`, `182003`, `181957`, `143516`):
- Verify `overview` & `plan` see cleanly inside (ceiling not blocking from above);
- Verify `section+bp+dims` cleanly shows the 3-zone ceiling (`9.20 → 8.50 | 7.45 → 6.37`) and trusses (`8.00 | 7.00 → 6.00` + `+2.70` perimeter);
- Verify bent 13+9 staircase alignment, orange curtain from top to 4th step, LED screen clearance under truss, open glass glazing, no floating meshes, no z-fighting, clean blueprint (`+bp`) lines!
- Fix any visual/camera defects found, re-run `shots` + `npm.cmd run check` + `parity.mjs compare` until clean.

- [ ] **Step 4: STOP POINT — Present Foyer screenshots & assumptions list to user**

Show the user key rendered views (`overview`, `atrium1f`, `gallery2f`, `section+bp+dims`, `plan+bp+dims`, `ceiling`) and the list of `assumption: true` items for visual sign-off before release!

---

### Task 8 [Coordinator]: Local Preview, Docs Update, Backup Check & Merge to `master`

**Files:**
- Modify: `AGENTS.md` (update top summary: `Фойе (черновик: ...)`)
- Modify: `.agents/skills/venue-module-authoring/SKILL.md` (if venue table lists `foyer` status)

- [ ] **Step 1: STOP POINT — Start local preview server for user check**

Serve `app/dist/` or `npm.cmd run dev` and let the user inspect `#v=foyer` interactively (desktop + mobile). Apply any tweaks requested, then re-verify `npm.cmd run check` and `parity.mjs compare`.

- [ ] **Step 2: Update project docs (`AGENTS.md`, skills) and commit**

```powershell
git add AGENTS.md .agents/skills/venue-module-authoring/SKILL.md
git commit -m "Фойе (этап 1): обновление документации (статус черновика)"
```

- [ ] **Step 3: Check 10-commit backup rule before/after merge**

Run: `git rev-list --count HEAD` — if `% 10 === 0` (or passed a multiple of 10), run `cd app; npm.cmd run backup` and verify `VERIFIED (100% MATCH)` + ZIP (`tar.exe -tf`).

- [ ] **Step 4: STOP POINT — Merge `foyer → master` and `git push` (ONLY after explicit user «ок»)**

```powershell
git checkout master
git merge --no-ff foyer -m "Слияние ветки foyer: черновик Фойе (архитектура, фермы, интерьер, оранжевая ткань)"
git push origin master
```
Verify commit count for backup policy once more (`git rev-list --count HEAD % 10 === 0`).
