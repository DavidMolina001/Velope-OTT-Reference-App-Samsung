# Notes

What the Samsung TV, the Tizen tooling and the Lightning renderer got wrong, or did differently
from their documentation, while this app was built. Each was found by running the app on the TV
(a Samsung UE43U7020 on Tizen 10) or in desktop Chrome, not by reading code. Versions as of
September 2026.

## Tizen and the TV

1. **The TV's native HLS player stays on the lowest variant.** Given the Mux Big Buck Bunny
   playlist as a `<video src>`, Tizen's own HLS stack played 320×184 with choppy audio and never
   climbed. Streaming through hls.js (MSE) reaches 1080p within seconds, so `host.ts` always uses
   hls.js for HLS on the TV and never the native path.
2. **`tizen.tvinputdevice.registerKeyBatch` rejects an undefined success callback.** Called with
   only the key list it throws `TypeMismatchError`, and the media keys (play/pause, stop, FF/RW)
   and Exit are never delivered to the app; arrows, Enter and Back arrive regardless. `registerKeys` in `host.ts`
   passes both callbacks and registers Exit separately, so a TV that refuses Exit still gets the
   media keys.
3. **macOS's Local Network permission blocks `sdb`.** `sdb` runs as a background process and never
   gets the prompt, so `sdb connect <TV>` fails while the TV answers a ping. Starting it once from
   the Terminal app triggers the prompt; `scripts/tizen.sh` says so when it cannot find the TV.
4. **The launcher caches the app icon.** A new `tizen/icon.png` does not show after a reinstall
   with the same version; bump `version` in `tizen/config.xml`, or uninstall the app and cold-boot
   the TV, before trusting what the Apps screen shows.
5. **`tizen:launch_screen` is not in the TV schema.** The packager rejects it for the `tv-samsung`
   profile. `tizen:video_splash_screen` is accepted and was tried (a still of the DMP frame in
   Samsung's loading slot) but looked wrong, so the OS loading dots stay and the app draws its own
   DOM splash (`splash.ts`) as soon as its page loads.
6. **Reusing one `<video>` for the next hero item by seeking it back stalls.** Sharing a single
   stream across the hero items (pause under the artwork, seek to 0, resume) was tried to avoid
   the cost of starting a stream per item; on the TV the resumed element stalled, and the items
   stand for different titles anyway, so each item starts its own preview
   (`tizenHeroPreview` in `host.ts`). The switch cost is kept down by starting the stream at its
   720p cap and preloading the neighbours' artwork.
7. **Only transform animations are smooth on the TV.** Growing the tile preview to full screen by
   animating width and height gave 4 frames and a 233 ms freeze; giving the box its full-screen
   size at once and scaling it from the tile (`expandToFull` in `host.ts`) runs at about 60 fps.
   The page changes that follow wait until the transform ends.
8. **Web Audio starts suspended on the TV but needs no gesture.** `AudioContext.resume()` succeeds
   at boot, so the splash chime plays; desktop Chrome refuses it until the page is clicked.
9. **The TV has no readable console.** `VITE_LOG_URL` (build time) makes `index.tsx` POST every
   console line, key, focus change and playback probe to any HTTP listener; nothing else worked.

## Lightning renderer and SolidTV

10. **TMDB `original` backdrops blow the texture budget.** They run up to 4K; six of them plus
    posters exceeded the renderer's 160 MB ceiling after one hero rotation and it started evicting
    and reloading every frame. `theme.ts` requests w1280 (`heroArtWidth`), which is
    indistinguishable behind the gradients on a TV at a quarter of the memory.
11. **`linearGradient` angle convention.** Angle 0 runs top to bottom and 3π/2 left to right,
    with `colors[0]` first; colours are `0xRRGGBBAA`, so a fade to transparent is the same RGB with
    alpha `00`, not black (`HeroBanner.tsx`).
12. **A `<For>` list created after mount draws on top of later siblings.** Nodes are appended in
    creation order, so hero artwork that arrives once the items load was rendered after, i.e. over,
    the gradients declared below it. Wrapping the list in its own `<view>` fixes the order
    (`HeroBanner.tsx`).
13. **The MSDF atlases lack glyphs.** ★ · ▶ ✓ and the em dash render as `?` or nothing. The rating
    line is plain text, the tick is drawn from two rotated bars (`Tick.tsx`) and the player's
    legend is DOM, where the system font has them. Regenerating the atlases needs the msdf tooling.
14. **Inherited: a translated container must not inherit its parent's size.** A `<view>` without
    `width`/`height` takes its parent's size; a row scroller that inherits 1830 px and sits at
    `x = -2400` is entirely off-screen, the renderer marks it OutOfBounds and defers its children,
    and the scrolled row goes blank. Every pure translation container is `width={0} height={0}`
    (`CarouselRow.tsx`, `HeroBanner.tsx`, `Home.tsx`).
15. **Inherited: text batching breaks draw order.** With `__renderTextBatching__` on, every text
    node is drawn after the frame's quads, so labels showed through the opaque error screen.
    `vite.config.ts` defines it `false`.
16. **Inherited: KeepAlive keeps the cached page in the render tree.** That is the intended
    zero-cost back-with-state; Home re-focuses its root when `isAlive` flips back to true, because
    `autofocus` only fires on creation (`App.tsx`, `Home.tsx`).
17. **Inherited: DRM is a runtime decision.** `AppPlayer.play` takes an ordered list of streams
    and asks EME (`requestMediaKeySystemAccess`) before committing to a DRM one, so a runtime
    without Widevine falls through to the clear stream. On this TV Widevine exists but the
    DRMtoday staging licence server refuses its requests (Shaka 6007), so `STREAMS` in
    `state/playback.ts` lists only the clear stream.
18. **Inherited: TMDB through XMLHttpRequest with `responseType = 'json'`.** Kept from the shared
    code (`services/tmdb.ts`), where it worked around a broken fetch polyfill on another runtime;
    it is harmless on Tizen and needs no change.

## What would be improved with more time

- A Widevine licence server that accepts the TV, so the DRM path is exercised on hardware.
- Favourites saved to `localStorage` and shared between the hero and the details page (built once,
  reverted; see the git history).
- Per-title trailers instead of one test asset for every preview.
- Regenerated MSDF atlases with a full Latin charset and the ★ · ▶ ✓ glyphs.
- An automated run of the network-remote key sequences as a test job, asserting on the `FOCUS`
  and `METRICS` lines from the remote log.
