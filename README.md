# Velope TV Reference (Samsung / Tizen)

The Velope OTT Developer Test reference app for **Samsung TVs**. It is the SolidTV reference
app (SolidJS driving the Lightning 3 WebGL renderer, genre nav, 12 infinitely looping carousel
rows, details, DRM playback) copied from `Velope-OTT-Reference-App-SolidTV` and made
Samsung-specific. The Apple TV (NativeScript) parts were left out.

## What is Samsung-specific

All of it lives in `src/host.ts` (plus `tizen/` and `scripts/tizen.sh`); pages and components are
unchanged apart from two small hooks:

- **Remote keys.** Samsung's Back key is keyCode 10009 (added to the focus manager's Back list).
  The media keys (play/pause, play, pause, stop, fast-forward, rewind) are only delivered to apps
  that register them, so the host registers them through `tizen.tvinputdevice` at start-up.
- **Player controls.** The `<video>` player draws its own on-screen controls: title, play/pause
  state, progress bar, elapsed and total time, a buffering indicator and a key legend. They fade
  out 4 s after the last key while playing and stay up while paused. While the player is up it
  owns the remote: OK or Play/Pause toggles, Left/Right seek 10 s, Rewind/Fast-forward seek 30 s,
  Back or Stop closes it.
- **Exit.** Back at the root of the app (genre nav) closes the app, per Samsung's guidelines.
- **Packaging.** Vite builds with relative asset URLs (`base: './'`) because the packaged app loads
  from the TV's filesystem. `tizen/config.xml` declares the app (id `VelSamsung.VelopeTV`) and its
  privileges (internet, TV input device, DRM playback).

## Samsung TV

Requires the Tizen SDK (`~/tizen-sdk`, CLI installer; Tizen Studio is retired), the TV in
Developer Mode pointing at this computer's IP, and a Samsung signing profile whose distributor
certificate includes the TV's DUID.

```sh
pnpm install
cp .env.example .env        # then add your TMDB key (below)
pnpm tizen                  # build + package + install + launch on the TV
pnpm tizen:package          # build + package only: tizen-build/VelopeTV.wgt
```

`scripts/tizen.sh` reads `TV_IP` (default 192.168.1.216), `TIZEN_PROFILE` (default `Ellery`) and
`TIZEN_SDK` (default `~/tizen-sdk`) from the environment.

On macOS, `sdb` is a background process the Local Network privacy setting can silently block. If
the TV answers but `sdb connect` fails, start sdb once from the Terminal app.

## Desktop browser (development)

Requires Node 20+ and pnpm 10.

```sh
pnpm install
cp .env.example .env        # then add your TMDB key (below)
pnpm dev                    # Vite dev server on http://localhost:5173
pnpm build                  # production bundle in dist/
pnpm typecheck              # strict tsc over src/
```

### TMDB key

Register a free API key at https://developer.themoviedb.org/docs/getting-started and put the
v3 key (32-char hex) in `.env`:

```
VITE_TMDB_API_KEY=your_key_here
```

The key is only ever read from the environment at build time; nothing is committed. The
build reads it through Vite and exposes it as `import.meta.env.VITE_TMDB_API_KEY`. Without a key the app boots into its error
screen with a message telling you exactly this.

## Controls

| Samsung remote | Keyboard (dev) | Action |
| --- | --- | --- |
| Up / Down | Arrow Up / Down | Move between the genre nav and rows |
| Left / Right | Arrow Left / Right | Move within a row or the nav; a row's 20 titles cycle seamlessly |
| OK | Enter | Open a title / choose a genre / press a button |
| Back | Escape / Backspace | Grid → nav → exit the app; details → back to the grid with state intact |

In the player:

| Samsung remote | Keyboard (dev) | Action |
| --- | --- | --- |
| OK or Play/Pause | Enter | Play / pause (controls stay up while paused) |
| Play, Pause | | Play, pause |
| Left / Right | Arrow Left / Right | Seek 10 s |
| Rewind / Fast-forward | | Seek 30 s |
| Back or Stop | Escape / Backspace | Close the player |

### What plays

"Play now" plays **Big Buck Bunny** (clear HLS, Mux test streams; Blender Foundation, CC BY 3.0),
played natively by the TV. The Widevine stream from the SolidTV app stays in
`src/state/playback.ts` for reference but is not played: the DRMtoday staging licence server
refuses the TV's requests (Shaka error 6007).

## Resolution and diagnostics

- The scene is authored at 1920×1080. On the web it is fitted to the window (1:1 on a 1080p
  panel); append `?res=720` to render the identical coordinate system on a 1280×720 canvas
  (stage scaling; reload-based by design). On the TV the web view is 1920×1080.
- Append `?fps=1` on the web to show the FPS counter (top-right).
- `tools/tmdb-mock.server.mjs` is a TMDB stand-in for fault injection: it proxies the real API
  and flips failures, delays, short rows and exhaustion at runtime (see its header). Point the
  app at it with `VITE_TMDB_BASE_URL=http://localhost:8787` in `.env.local`.

## Reproducing the 6× CPU-throttle performance test (web)

1. Open the app with the FPS counter on: `http://localhost:5173/?fps=1`
2. Open Chrome DevTools → **Performance** tab → gear icon → **CPU: 6× slowdown**.
3. Hold **Arrow Right** for ~10 seconds inside a row, riding through the seam where the 20
   items cycle.
4. Hold **Arrow Down** through all 12 rows, then back up into the nav.
5. Switch genres a few times and open/close a details page.

What you should observe: the FPS readout stays at the display rate during scrolling (short
dips only while a new row's components are created), the focus ring never detaches or lands on
a stale tile, and no blank frames appear. For memory: DevTools → **Memory** — heap and GPU
stay flat however far you scroll, because at most 5 rows × 11 tiles exist at any time (see
PLAN.md). A dev build also exposes `__velope.countNodes()` in the console: 373 renderer nodes
at the top of the catalogue, 185 at the last row.

A desktop browser says little about a TV's GPU; measure performance on the TV itself.

## Known limitations

- **No DRM playback yet**: Widevine against DRMtoday staging fails on the TV (licence refused);
  it needs a licence server that accepts the TV's requests.
- The player controls are DOM over the video, not Lightning nodes, so they are styled in CSS.
- The MSDF font atlases (from the L3 build) miss a few glyphs, e.g. the em dash renders as `?`.

## Dependencies

- `@solidtv/solid` 1.6.3 + `@solidtv/renderer` 1.9.3 — SolidJS bindings over the Lightning 3
  WebGL renderer (`solid-js`, `@solidjs/router` for the hash router it wraps).
- `shaka-player` (DASH + Widevine via EME) and `hls.js` (HLS where the browser lacks it), both
  loaded on demand.
- `vite` + `vite-plugin-solid` (dev) — the web build; `typescript` (dev) — strict checks.

## Project layout

```
src/
  index.tsx              Boot: renderer options, fonts, focus manager (incl. Samsung Back 10009), router
  host.ts / host.types   Samsung host: media-key registration, player with on-screen controls, exit
  App.tsx                HashRouter: Home (kept alive) and Details
  services/tmdb.ts       TMDB access: XHR JSON with timeout+abort, response cache, image sizing
  services/rows.ts       Row collections (12 per genre), one 20-title page per row
  pages/Home.tsx         The focus engine: single model {zone, rowIndex, cols[]} + all key input
  pages/Details.tsx      Poster, metadata, mock action buttons, back handling
  components/            Prop-driven view components (no state of their own beyond visuals)
  state/selection.ts     The title handed from Home to Details
  state/playback.ts      The streams Play now tries (Big Buck Bunny; Widevine/FairPlay kept for reference)
  debug.ts               Dev-only hooks (__velope: state, node count)
tizen/config.xml, icon.png  Samsung app manifest (id VelSamsung.VelopeTV, privileges)
scripts/tizen.sh         Build, package (signed .wgt), install and launch on the TV
tools/tmdb-mock.server.mjs   Fault-injection proxy for TMDB
```

`NOTES.md` (carried over from the SolidTV app) lists what the framework and its guides got wrong.
`PLAN.md` and `ANSWERS.md` stay in the SolidTV repo.
