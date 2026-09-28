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
- **Exit.** The Exit key (registered through `tizen.tvinputdevice`) or Back at the root of the app
  (genre nav) opens a Yes/No exit dialog (`ExitDialog.tsx`); Yes closes the app.
- **Splash.** A DOM overlay (`src/splash.ts`) shown from boot until Home's first rows are ready:
  the DMP monogram drops in over a pulsing ring, then the bar and "A DAVID MOLINA PRODUCTION". Samsung's own loading dots before the app starts are
  the OS's and stay (its video-splash-screen option was tried and dropped: it looked wrong).
  Its chime is synthesised with Web Audio (a tick, C5-E5-G5 as the letters land, a C6/G6 shimmer),
  so no audio file ships. It stays at least 2.8 s and fades once the app is ready.
- **Icon.** `tizen/icon.png` is the DMP wordmark (512 px, rendered from the app's Raleway).
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

To see the TV layout in desktop Chrome, use DevTools device mode with a custom device of
**1920 × 1080 at device pixel ratio 1**, and reload after switching to it: the app fits its
1920 × 1080 scene to the window size it finds at start-up, so a window resized afterwards shows
a scene sized for the old window.

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
| Back | Escape / Backspace | Grid → nav → exit dialog; details → back to the grid with state intact |
| Exit | | Exit dialog, from anywhere (closes the player first) |

The exit dialog asks "Exit Velope TV?" with focus on No: Left/Right choose, OK confirms, Back
cancels and returns focus to where it was. Yes closes the app; reopen it from the TV's Apps list.

Browsing behaviour:

- **Hero banner** (`HeroBanner.tsx`, cycle in `Home.tsx`), after the Apple TV app's: the first 6
  titles with wide artwork from the current genre's first row, each with its backdrop, title,
  year and rating, synopsis, **Play** and a watchlist **+ / ✓** button, and page dots. One second
  after the hero shows, Big Buck Bunny plays full screen *behind* the canvas (the canvas is
  see-through, `clearColor` 0, body background in CSS) with sound; the artwork fades out and the
  gradients, text and buttons stay on top. The active dot stretches into a pill that fills over
  15 s, then the next item comes in (looping). Left/Right move between Play and the tick; Right
  from the tick is the next item, Left from Play the previous one. Down moves to the rows (the
  hero slides away and its video stops), Up returns; Back from the rows returns to the hero, Back
  on the hero opens the exit dialog. Play opens the full-screen player straight from the hero.

- **Focus walks first.** Moving right, focus crosses the screen to the middle tile (the 4th of 7),
  then stays there while the row slides and cycles forever. Moving left, focus walks back to the
  left edge before the row slides back, down to the real first item (`stepColumn` in `Home.tsx`).
- **Up / Down keep the column.** Focus lands on the tile directly above or below on screen; each
  row keeps its own scroll (`moveToRow`).
- **Preview.** Resting 3 s on a tile widens it to about twice its width (black until the video
  starts) and plays Big Buck Bunny over it with a progress bar along the bottom (where it is in the
  whole video), with sound, capped at 480p. In the middle
  slot the tile grows to both sides and its neighbours move apart; elsewhere it grows to the right.
  Any focus change, leaving the grid or opening the title stops it (`host.ts` `tizenPreview`,
  `CarouselRow.tsx` `tileX`).

In the player:

| Samsung remote | Keyboard (dev) | Action |
| --- | --- | --- |
| OK or Play/Pause | Enter | Play / pause (controls stay up while paused) |
| Play, Pause | | Play, pause |
| Left / Right | Arrow Left / Right | Seek 10 s (centre badge shows the total, e.g. +20s; repeat presses add up) |
| Rewind / Fast-forward | | Seek 30 s |
| Back or Stop | Escape / Backspace | Close the player |

### What plays

"Play now" plays **Big Buck Bunny** (clear HLS, Mux test streams; Blender Foundation, CC BY 3.0)
through hls.js. The TV's native HLS player stayed on the lowest variant (320×184, choppy audio);
hls.js reaches 1080p within seconds. The Widevine stream from the SolidTV app stays in
`src/state/playback.ts` for reference but is not played: the DRMtoday staging licence server
refuses the TV's requests (Shaka error 6007).

## Testing on the TV

- **Remote logging.** Build with `VITE_LOG_URL=http://<this Mac's IP>:9999 pnpm tizen` and run any
  HTTP listener on that port: the app POSTs every console line, key press (`KEY`), focus change
  (`FOCUS`), details state (`DETAILS`), video event (`VIDEO`) and a playback probe every 2 s
  (`PROGRESS`: media vs wall time, buffer, resolution). Without the variable none of it is built in.
- **Driving the remote.** Samsung TVs accept remote keys over `wss://<TV>:8002/api/v2/channels/samsung.remote.control`
  (`ms.remote.control`, e.g. `KEY_UP`, `KEY_ENTER`, `KEY_RETURN`, `KEY_PLAY`, `KEY_PAUSE`,
  `KEY_PLAY_BACK`, `KEY_FF`, `KEY_REWIND`, `KEY_STOP`), which is how the build was tested end to end.

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
