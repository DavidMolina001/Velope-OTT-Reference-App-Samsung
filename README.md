# Reference App (Samsung / Tizen)

The Velope OTT Developer Test reference app for **Samsung TVs**. It is the SolidTV reference
app (SolidJS driving the Lightning 3 WebGL renderer, genre nav, 12 infinitely looping carousel
rows, details, DRM playback) copied from `Velope-OTT-Reference-App-SolidTV` and made
Samsung-specific. The Apple TV (NativeScript) parts were left out.

The full user flow (every screen and where each remote button leads) is in `docs/user-flow.html`
(shared page: https://claude.ai/artifact/FaW71BFj8i9dG5qyy4mmoU).

## Before you build: two things you must supply

The repository contains no secrets. To build and run the app you need both of these, and
neither is in the repo:

1. **A TMDB API key** (free). The app reads its catalogue from The Movie Database. Register at
   https://developer.themoviedb.org/docs/getting-started, then:

   ```sh
   cp .env.example .env
   # edit .env and set VITE_TMDB_API_KEY=<your 32-character v3 key>
   ```

   Without it the app boots into its error screen saying exactly this. `.env` is git-ignored.

2. **A Samsung signing certificate that includes your TV.** Samsung TVs only install test apps
   signed with a certificate that lists the TV's own ID (its *DUID*). The certificate is not in the
   repo and cannot be shared with you; create your own in ~10 minutes:
   1. Install the Tizen SDK (CLI installer from https://samsungtizenos.com/tools-download/; Tizen
      Studio is retired) plus the *Samsung Certificate Extension* and *Samsung Tizen TV SDK*
      packages: `~/tizen-sdk/package-manager/package-manager-cli.bin install --accept-license
      Certificate-Manager,cert-add-on,TV-SAMSUNG-Public-WebAppDevelopment`.
   2. Put the TV in Developer Mode: on the TV open **Apps**, type **1 2 3 4 5** on the remote,
      switch Developer Mode **On**, enter your computer's IP address, and restart the TV.
   3. Connect and read the TV's DUID:
      ```sh
      ~/tizen-sdk/tools/sdb connect <TV IP>
      ~/tizen-sdk/tools/sdb shell 0 getduid
      ```
   4. Open `~/tizen-sdk/tools/certificate-manager/certificate-manager.app`, press **+**, choose
      **Samsung → TV**, name the profile (say `MyTV`), create an author certificate, sign in with a
      Samsung account when asked, then create a distributor certificate and make sure the DUID
      from step 3 is in its device list. Finish.
   5. Build with your profile name: `TIZEN_PROFILE=MyTV TV_IP=<TV IP> pnpm tizen`.

   Already have a signed `ReferenceApp.wgt` from someone whose certificate lists your TV? Then you
   only need steps 1–3 and `~/tizen-sdk/tools/ide/bin/tizen install -n ReferenceApp.wgt -s <TV IP>:26101`.

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
  from the TV's filesystem. `tizen/config.xml` declares the app (shown as "Reference App"; internal id `VelSamsung.VelopeTV`, kept so updates replace the installed app) and its
  privileges (internet, TV input device, DRM playback).

## Samsung TV

Requires the Tizen SDK, the TV in Developer Mode pointing at this computer's IP, a TMDB key in
`.env` and a Samsung signing profile whose distributor certificate includes the TV's DUID; see
**Before you build** above for all four.

```sh
pnpm install
cp .env.example .env        # then add your TMDB key (below)
pnpm tizen                  # build + package + install + launch on the TV
pnpm tizen:package          # build + package only: tizen-build/ReferenceApp.wgt
```

`scripts/tizen.sh` reads `TV_IP` (default 192.168.1.216), `TIZEN_PROFILE` (the signing profile
name from Certificate Manager; the default `Ellery` is the original author's and will not exist on
your machine, so set your own) and `TIZEN_SDK` (default `~/tizen-sdk`) from the environment.

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

The exit dialog asks "Exit Reference App?" with focus on No: Left/Right choose, OK confirms, Back
cancels and returns focus to where it was. Yes closes the app; reopen it from the TV's Apps list.

Browsing behaviour:

- **Hero banner** (`HeroBanner.tsx`, cycle in `Home.tsx`), after the Apple TV app's: the first 6
  titles with wide artwork from the current genre's first row, each with its backdrop, title,
  year and rating, synopsis, **Play** and a watchlist **+ / ✓** button, and page dots. One second
  after the hero shows, Big Buck Bunny plays full screen *behind* the canvas (the canvas is
  see-through, `clearColor` 0, body background in CSS) with sound; the artwork fades out and the
  gradients, text and buttons stay on top. Every item is its own title, so every item starts its
  own preview from the beginning (the one test asset stands in for six different trailers). The
  preview is capped at 720p and starts at that level; the artwork is TMDB's w1280 (the original,
  up to 4K, blew the renderer's 160 MB texture budget after one rotation and made it thrash) and
  the neighbours' artwork is preloaded. The hero waits for the splash to fade before playing, so
  its sound never overlaps the chime. The active dot stretches into a pill that fills over
  15 s; then the preview stops and the item stays. The next item only comes in (looping) once the
  remote has been idle for 7 s, so the item never changes while the viewer is pressing keys; if
  they were already idle when the preview ended, it moves on straight away. Left/Right move between Play and the tick; Right
  from the tick is the next item, Left from Play the previous one. Down moves to the rows (the
  hero slides away and its video stops), Up returns; Back from the rows returns to the hero, Back
  on the hero opens the exit dialog. Play opens the full-screen player straight from the hero and, when the preview is playing from
  the start of the asset, continues it seamlessly: the player adopts the preview's own video
  element and streaming engine (`handOver` in `host.ts`), so nothing reloads or rewinds. Before
  the preview has started (or for a preview that began mid-asset) Play starts from 0.

- **Focus walks first.** Moving right, focus crosses the screen to the middle tile (the 4th of 7),
  then stays there while the row slides and cycles forever. Moving left, focus walks back to the
  left edge before the row slides back, down to the real first item (`stepColumn` in `Home.tsx`).
- **Up / Down keep the column.** Focus lands on the tile directly above or below on screen; each
  row keeps its own scroll (`moveToRow`).
- **Preview.** Resting 3 s on a tile widens it to about twice its width (black until the video
  starts) and plays Big Buck Bunny over it with a progress bar along the bottom (where it is in the
  whole video), with sound, capped at 480p. In the middle
  slot the tile grows to both sides and its neighbours move apart; elsewhere it grows to the right.
  Pressing OK once the preview has played for 7 s commits to it: the preview grows from the tile
  into the full player (0.4 s, a GPU transform: the box takes its full-screen size at once and is
  scaled from the tile, about 60 fps on the TV; page changes wait until it ends) and carries on
  from the same second. Then the 480p cap is lifted and hls.js switches to the top variant
  (flushing the buffered 480p) before returning to adaptive quality. Back from that player opens
  the title's details page. Before 7 s, OK opens the details page as usual.
  Any other focus change or leaving the grid stops it (`host.ts` `tizenPreview`,
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

## Performance notes (measured on the UE43U7020)

- With `VITE_LOG_URL` set, the app logs a `METRICS` line every 5 s (JS heap, DOM/video/canvas
  counts, renderer nodes, fps, main-thread long tasks), which is how the numbers below were taken.
- Rows: 60 fps, no long tasks. Memory is flat (no leaks were found in a code audit of every
  create/destroy pair).
- Hero item changes went from 5–10 s at 37–48 fps with 300–760 ms freezes to ~5 s at 45–53 fps
  with nothing above 250 ms, by: w1280 artwork instead of `original` (preloaded for the
  neighbours), the preview starting straight at its 720p cap, and the page-pill ticker at 300 ms
  instead of 100 ms (each tick redraws the whole scene over the composited video). The remaining
  cost is the TV starting a new stream, which one-preview-per-title requires: sharing one stream
  across items was tried and rejected, since the items stand for different titles.
- All hls.js instances set `backBufferLength: 30` so played-back video is released from memory.
- Dormant: after 10 minutes without a key press the previews stop (artwork stays); any key wakes it.
- The see-through canvas costs one full-screen blend per composited frame; it is inherent to
  drawing the hero over a video and is left as is.

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
