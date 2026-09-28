// The Samsung (Tizen) host: the seam between the shared SolidTV app and the TV.
//
// Everything Samsung-specific lives here, so src/pages and src/components stay the same as the
// SolidTV reference app:
// - remote keys: Tizen only delivers the media keys (play/pause, stop, FF/RW) to apps that
//   register them, and its Back key is keyCode 10009 rather than Escape/Backspace;
// - the player: a <video> over the WebGL canvas with its own on-screen controls (title,
//   play/pause state, progress bar, times) and its own remote handling while it is up;
// - exit: Back at the root of the app closes it, as Samsung's app guidelines expect.
import { loadFonts } from '@solidtv/solid'
import type { AppHeroPreview, AppHost, AppPlayer, AppPreview, PreviewRect } from './host.types'
import { isDash, isHls } from './state/playback'
import { setExitPromptOpen } from './state/exit'

export type { AppHeroPreview, AppHost, AppPlayer, AppPreview, PreviewRect, SdfFont } from './host.types'

/** Samsung remote key codes (Tizen TV). */
export const TV_KEYS = {
  back: 10009,
  exit: 10182,
  playPause: 10252,
  play: 415,
  pause: 19,
  stop: 413,
  fastForward: 417,
  rewind: 412,
  enter: 13,
  left: 37,
  up: 38,
  right: 39,
  down: 40,
} as const

interface TizenApi {
  tvinputdevice?: { registerKeyBatch(keys: string[], ok?: () => void, err?: (e: unknown) => void): void }
  application?: { getCurrentApplication(): { exit(): void } }
}

function tizenApi(): TizenApi | undefined {
  return (globalThis as unknown as { tizen?: TizenApi }).tizen
}

/**
 * Asks Tizen to deliver the media keys and the Exit key to the app (arrows, Enter and Back always
 * arrive). Exit is registered on its own so that, if a TV refuses it, the media keys still work
 * (the TV then simply closes the app on Exit itself).
 */
function registerKeys(): void {
  const register = (keys: string[], label: string) => {
    try {
      // Tizen type-checks both callbacks: passing undefined throws TypeMismatchError.
      tizenApi()?.tvinputdevice?.registerKeyBatch(
        keys,
        () => console.log(`KEYS ${label} registered`),
        (e) => console.warn(`KEYS ${label} register failed`, e)
      )
    } catch (e) {
      console.warn(`KEYS ${label} register failed`, e)
    }
  }
  register(['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaFastForward', 'MediaRewind'], 'media')
  register(['Exit'], 'exit')
  // Exit anywhere outside the player (the player handles it itself, see onKey) asks to exit.
  window.addEventListener('keydown', (event) => {
    if (event.keyCode !== TV_KEYS.exit) return
    event.preventDefault()
    setExitPromptOpen(true)
  })
}

const SEEK_STEP = 10
const FAST_SEEK_STEP = 30
const CONTROLS_TIMEOUT = 4000
const SEEK_BADGE_TIMEOUT = 1000

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const s = Math.floor(seconds % 60)
  const m = Math.floor(seconds / 60) % 60
  const h = Math.floor(seconds / 3600)
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}

/**
 * The seek badge: a large centre badge (Netflix style) showing the direction and the total seek,
 * e.g. "+30s". Presses in the same direction within SEEK_BADGE_TIMEOUT add up (+30s, +60s...);
 * changing direction starts again. It is independent of the controls, so it shows even while
 * they are fading out.
 */
function createSeekBadge() {
  const root = document.createElement('div')
  root.style.cssText =
    'position:fixed;left:50%;top:44%;z-index:12;transform:translate(-50%,-50%) scale(.9);width:240px;height:240px;border-radius:50%;' +
    'background:rgba(11,14,23,.72);color:#fff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'opacity:0;transition:opacity .2s,transform .2s;pointer-events:none'
  root.innerHTML = '<div data-r="icon" style="font-size:88px;line-height:1;color:#8b6cff"></div><div data-r="amount" style="font-size:44px;font-weight:bold;margin-top:8px"></div>'
  const icon = root.querySelector('[data-r="icon"]') as HTMLElement
  const amount = root.querySelector('[data-r="amount"]') as HTMLElement
  let total = 0
  let hideTimer: ReturnType<typeof setTimeout> | undefined
  return {
    root,
    show(delta: number) {
      clearTimeout(hideTimer)
      // Same direction while the badge is up: accumulate; otherwise start from this press.
      total = root.style.opacity === '1' && Math.sign(total) === Math.sign(delta) ? total + delta : delta
      icon.textContent = total > 0 ? '⏩' : '⏪'
      amount.textContent = `${total > 0 ? '+' : '−'}${Math.abs(total)}s`
      root.style.opacity = '1'
      root.style.transform = 'translate(-50%,-50%) scale(1)'
      if (import.meta.env.VITE_LOG_URL) console.log(`SEEKBADGE ${amount.textContent} ${icon.textContent}`)
      hideTimer = setTimeout(() => {
        root.style.opacity = '0'
        root.style.transform = 'translate(-50%,-50%) scale(.9)'
      }, SEEK_BADGE_TIMEOUT)
    },
    destroy() {
      clearTimeout(hideTimer)
      root.remove()
    },
  }
}

/** The on-screen controls, plain DOM over the video (the canvas is underneath both). */
function createControls(title: string) {
  const root = document.createElement('div')
  root.style.cssText =
    'position:fixed;left:0;right:0;bottom:0;z-index:11;padding:0 96px 64px;color:#fff;font-family:sans-serif;' +
    'background:linear-gradient(transparent,rgba(0,0,0,.85));transition:opacity .3s;opacity:1;padding-top:160px'
  root.innerHTML = `
    <div data-r="status" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);font-size:96px;text-shadow:0 0 24px #000"></div>
    <div style="font-size:44px;font-weight:bold;margin-bottom:28px" data-r="title"></div>
    <div style="display:flex;align-items:center;gap:32px">
      <div data-r="state" style="font-size:40px;width:48px;text-align:center"></div>
      <div data-r="current" style="font-size:30px;min-width:120px;text-align:right"></div>
      <div style="flex:1;height:10px;border-radius:5px;background:rgba(255,255,255,.3);overflow:hidden">
        <div data-r="bar" style="height:100%;width:0;background:#7c5cff"></div>
      </div>
      <div data-r="duration" style="font-size:30px;min-width:120px"></div>
    </div>
    <div style="margin-top:24px;font-size:24px;color:rgba(255,255,255,.7)">
      OK / ▶❚❚ play-pause &nbsp;&nbsp; ◀ ▶ seek 10s &nbsp;&nbsp; ◀◀ ▶▶ seek 30s &nbsp;&nbsp; Back / ■ stop
    </div>`
  const ref = (name: string) => root.querySelector(`[data-r="${name}"]`) as HTMLElement
  ref('title').textContent = title
  let hideTimer: ReturnType<typeof setTimeout> | undefined
  let visible = true
  return {
    root,
    update(video: HTMLVideoElement, buffering: boolean) {
      // No DOM work while the controls are hidden: every layout/paint competes with the decoder.
      if (!visible) return
      const duration = video.duration
      const live = !Number.isFinite(duration)
      ref('state').textContent = video.paused ? '▶' : '❚❚'
      ref('current').textContent = formatTime(video.currentTime)
      ref('duration').textContent = live ? 'LIVE' : formatTime(duration)
      ref('bar').style.width = live || !duration ? '0' : `${(video.currentTime / duration) * 100}%`
      ref('status').textContent = buffering ? '…' : ''
    },
    show(video: HTMLVideoElement) {
      clearTimeout(hideTimer)
      if (!visible) {
        visible = true
        root.style.display = ''
        this.update(video, false)
      }
      root.style.opacity = '1'
      // Stay up while paused; fade out a few seconds after the last key while playing, then
      // leave the layout entirely (display:none) so nothing is composited over the video.
      if (!video.paused)
        hideTimer = setTimeout(() => {
          root.style.opacity = '0'
          hideTimer = setTimeout(() => {
            visible = false
            root.style.display = 'none'
          }, 400)
        }, CONTROLS_TIMEOUT)
    },
    destroy() {
      clearTimeout(hideTimer)
      root.remove()
    },
  }
}

// DASH (Widevine/PlayReady through EME) plays through Shaka Player; HLS plays through hls.js
// (Media Source Extensions), which does proper adaptive bitrate on the TV.
function tizenPlayer(): AppPlayer {
  let video: HTMLVideoElement | undefined
  let hls: { destroy(): void } | undefined
  let shaka: { destroy(): Promise<void> } | undefined
  let teardown: (() => void) | undefined
  const hasEme = typeof navigator !== 'undefined' && 'requestMediaKeySystemAccess' in navigator
  const stop = () => {
    teardown?.()
    teardown = undefined
    hls?.destroy()
    hls = undefined
    void shaka?.destroy()
    shaka = undefined
    if (video) {
      video.pause()
      video.removeAttribute('src')
      video.load()
      video.remove()
      video = undefined
    }
  }
  return {
    canPlay(stream) {
      if (stream.fairplay) return false
      if (!stream.drm) return true
      return hasEme && 'com.widevine.alpha' in stream.drm
    },
    play(streams, onClosed, title = '') {
      stop()
      const element = document.createElement('video')
      element.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;background:#000;object-fit:contain;z-index:10'
      element.autoplay = true
      element.playsInline = true
      const controls = createControls(title)
      const seekBadge = createSeekBadge()
      let buffering = true
      let closed = false
      const close = () => {
        if (closed) return
        closed = true
        stop()
        onClosed()
      }
      const refresh = () => controls.update(element, buffering)
      const seek = (delta: number) => {
        if (!Number.isFinite(element.duration)) return
        element.currentTime = Math.max(0, Math.min(element.duration - 1, element.currentTime + delta))
        seekBadge.show(delta)
      }
      const toggle = () => {
        if (element.paused) void element.play().catch(() => undefined)
        else element.pause()
      }
      // While the player is up it owns the remote: the listener runs in the capture phase on
      // window, before the focus manager's document listener, and swallows every key so the
      // details page underneath never moves.
      const onKey = (event: KeyboardEvent) => {
        event.preventDefault()
        event.stopImmediatePropagation()
        if (event.type !== 'keydown') return
        switch (event.keyCode) {
          case TV_KEYS.exit:
            close()
            setExitPromptOpen(true)
            return
          case TV_KEYS.back:
          case TV_KEYS.stop:
          case 27:
          case 8:
            close()
            return
          case TV_KEYS.enter:
          case TV_KEYS.playPause:
            toggle()
            break
          case TV_KEYS.play:
            void element.play().catch(() => undefined)
            break
          case TV_KEYS.pause:
            element.pause()
            break
          case TV_KEYS.left:
            seek(-SEEK_STEP)
            break
          case TV_KEYS.right:
            seek(SEEK_STEP)
            break
          case TV_KEYS.rewind:
            seek(-FAST_SEEK_STEP)
            break
          case TV_KEYS.fastForward:
            seek(FAST_SEEK_STEP)
            break
        }
        refresh()
        controls.show(element)
      }
      window.addEventListener('keydown', onKey, true)
      window.addEventListener('keyup', onKey, true)
      const onTime = () => refresh()
      const onWaiting = () => {
        buffering = true
        refresh()
      }
      const onPlaying = () => {
        buffering = false
        refresh()
        controls.show(element)
      }
      const onPause = () => {
        refresh()
        controls.show(element)
      }
      element.addEventListener('timeupdate', onTime)
      element.addEventListener('durationchange', onTime)
      element.addEventListener('waiting', onWaiting)
      element.addEventListener('playing', onPlaying)
      element.addEventListener('pause', onPause)
      element.addEventListener('ended', close)
      // The WebGL canvas under the video is hidden while it plays: compositing a full-screen GL
      // layer beneath the video every frame starved the TV's decoder (audio stuttered).
      const canvases = Array.from(document.querySelectorAll('canvas'))
      canvases.forEach((canvas) => (canvas.style.visibility = 'hidden'))
      teardown = () => {
        window.removeEventListener('keydown', onKey, true)
        window.removeEventListener('keyup', onKey, true)
        controls.destroy()
        seekBadge.destroy()
        canvases.forEach((canvas) => (canvas.style.visibility = ''))
      }
      video = element
      document.body.appendChild(element)
      document.body.appendChild(controls.root)
      document.body.appendChild(seekBadge.root)
      refresh()

      const candidates = streams.filter((stream) => this.canPlay(stream))
      console.log(`PLAYER candidates ${candidates.map((c) => c.label).join(' | ')} UA ${navigator.userAgent}`)
      // Remote-logging builds sample playback every 2 s: media time vs wall time, dropped frames.
      if (import.meta.env.VITE_LOG_URL) {
        let lastT = 0
        let lastWall = performance.now()
        const probe = setInterval(() => {
          if (video !== element) return clearInterval(probe)
          const now = performance.now()
          const q = element.getVideoPlaybackQuality?.()
          const end = element.buffered.length ? element.buffered.end(element.buffered.length - 1) : 0
          console.log(`PROGRESS t=${element.currentTime.toFixed(2)} dt=${(element.currentTime - lastT).toFixed(2)} wall=${((now - lastWall) / 1000).toFixed(2)} paused=${element.paused} buf=${(end - element.currentTime).toFixed(1)} frames=${q?.totalVideoFrames ?? '?'} dropped=${q?.droppedVideoFrames ?? '?'} ${element.videoWidth}x${element.videoHeight}`)
          lastT = element.currentTime
          lastWall = now
        }, 2000)
      }
      for (const name of ['loadstart', 'loadedmetadata', 'canplay', 'playing', 'waiting', 'stalled', 'pause', 'error', 'emptied']) {
        element.addEventListener(name, () => console.log(`VIDEO ${name} t=${element.currentTime.toFixed(1)} rs=${element.readyState} ns=${element.networkState} err=${element.error?.code ?? ''}`))
      }
      // Try the candidates in order; a failure to start moves on to the next, a failure of the
      // last one closes the player.
      const attempt = async (index: number): Promise<void> => {
        const stream = candidates[index]
        if (!stream || video !== element) {
          if (!stream) console.warn('PLAYER no playable stream')
          close()
          return
        }
        const next = () => void attempt(index + 1)
        let started = false
        const onError = () => {
          console.warn('PLAYER element error', element.error?.code, element.error?.message)
          if (started) close()
          else next()
        }
        element.addEventListener('error', onError, { once: true })
        try {
          if (stream.drm) {
            await navigator.requestMediaKeySystemAccess('com.widevine.alpha', [
              { initDataTypes: ['cenc'], videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }], audioCapabilities: [{ contentType: 'audio/mp4; codecs="mp4a.40.2"' }] },
            ])
          }
          if (isDash(stream.url)) {
            const { default: shakaLib } = await import('shaka-player')
            if (video !== element) return
            shakaLib.polyfill.installAll()
            const player = new shakaLib.Player()
            shaka = player
            player.addEventListener('error', (event: Event) => {
              const detail = (event as unknown as { detail?: { code?: number; message?: string } }).detail
              console.warn('PLAYER shaka error', detail?.code, detail?.message)
              close()
            })
            await player.attach(element)
            if (stream.drm) player.configure({ drm: { servers: stream.drm } })
            await player.load(stream.url)
          } else if (isHls(stream.url)) {
            // Always hls.js (MSE) on the TV: Tizen's native HLS stayed on the lowest variant
            // (320x184, with choppy audio) and never switched up.
            const { default: Hls } = await import('hls.js')
            if (video !== element) return
            if (!Hls.isSupported()) throw new Error('hls.js not supported here')
            const instance = new Hls()
            hls = instance
            await new Promise<void>((resolve, reject) => {
              instance.on(Hls.Events.ERROR, (_event: unknown, data: { fatal?: boolean; details?: string }) => {
                if (data.fatal) {
                  const error = new Error(`hls.js fatal ${data.details}`)
                  if (started) {
                    console.warn('PLAYER', error.message)
                    close()
                  } else reject(error)
                }
              })
              instance.on(Hls.Events.MANIFEST_PARSED, () => resolve())
              instance.loadSource(stream.url)
              instance.attachMedia(element)
            })
          } else {
            element.src = stream.url
          }
          started = true
          console.log(`PLAYER playing ${stream.label}`)
          void element.play().catch(() => undefined)
        } catch (error) {
          const detail = error as { code?: number; message?: string }
          console.warn(`PLAYER ${stream.label} failed to start: ${detail?.code ?? ''} ${detail?.message ?? String(error)}`)
          element.removeEventListener('error', onError)
          void shaka?.destroy()
          shaka = undefined
          hls?.destroy()
          hls = undefined
          next()
        }
      }
      void attempt(0)
    },
    togglePause() {
      if (!video) return
      if (video.paused) void video.play().catch(() => undefined)
      else video.pause()
    },
    stop,
  }
}

// The tile preview: a <video> placed exactly over the expanded tile (the canvas cannot draw a
// video without copying every frame into a texture, too heavy for a TV). Quality is capped at
// 480p, so a 460x330 preview never pulls the 1080p variant. It is
// hidden until the first frame plays; the expanded tile is black until then.
function tizenPreview(): AppPreview {
  let video: HTMLVideoElement | undefined
  let frame: HTMLDivElement | undefined
  let hls: { destroy(): void } | undefined
  let generation = 0
  const stop = () => {
    generation++
    hls?.destroy()
    hls = undefined
    if (video) {
      console.log('PREVIEW stop')
      video.pause()
      video.removeAttribute('src')
      video.load()
      video = undefined
    }
    frame?.remove()
    frame = undefined
  }
  const place = (element: HTMLElement, rect: PreviewRect) => {
    const ratio = window.innerWidth / 1920
    element.style.left = `${rect.x * ratio}px`
    element.style.top = `${rect.y * ratio}px`
    element.style.width = `${rect.width * ratio}px`
    element.style.height = `${rect.height * ratio}px`
  }
  return {
    start(url, rect) {
      stop()
      const current = generation
      // The frame clips the video to the tile's rounded corners and carries the progress bar
      // along its bottom edge (where the preview is in the whole video, like YouTube's hover
      // previews). It stays invisible until the first frame plays: the tile underneath is black.
      const box = document.createElement('div')
      box.style.cssText =
        'position:fixed;z-index:5;border-radius:12px;overflow:hidden;background:#000;opacity:0;transition:opacity .3s;pointer-events:none'
      place(box, rect)
      box.innerHTML =
        '<div style="position:absolute;left:0;right:0;bottom:0;height:6px;background:rgba(255,255,255,.25)"><div data-r="fill" style="height:100%;width:0;background:#8b6cff"></div></div>'
      const fill = box.querySelector('[data-r="fill"]') as HTMLElement
      const element = document.createElement('video')
      element.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover'
      element.autoplay = true
      element.playsInline = true
      element.loop = true
      element.addEventListener('playing', () => {
        box.style.opacity = '1'
        console.log(`PREVIEW playing ${element.videoWidth}x${element.videoHeight} at ${rect.x},${rect.y} ${rect.width}x${rect.height} muted=${element.muted}`)
      })
      element.addEventListener('timeupdate', () => {
        if (Number.isFinite(element.duration) && element.duration > 0) fill.style.width = `${(element.currentTime / element.duration) * 100}%`
        if (import.meta.env.VITE_LOG_URL && Math.floor(element.currentTime) % 3 === 0) console.log(`PREVIEWBAR t=${element.currentTime.toFixed(1)} fill=${fill.style.width}`)
      })
      element.addEventListener('error', () => console.warn('PREVIEW error', element.error?.code))
      box.insertBefore(element, box.firstChild)
      video = element
      frame = box
      document.body.appendChild(box)
      void import('hls.js').then(({ default: Hls }) => {
        if (current !== generation) return
        if (!Hls.isSupported()) {
          element.src = url
          return
        }
        const instance = new Hls({ maxBufferLength: 10 })
        hls = instance
        // Up to 480p: sharp in a 460x330 tile, and never the 1080p variant for a preview.
        instance.on(Hls.Events.MANIFEST_PARSED, () => {
          const cap = instance.levels.reduce((best, level, index) => (level.height <= 480 && level.height > (instance.levels[best]?.height ?? 0) ? index : best), 0)
          instance.autoLevelCapping = cap
        })
        instance.loadSource(url)
        instance.attachMedia(element)
        console.log('PREVIEW start')
      })
    },
    stop,
  }
}

// The hero banner's background video. Unlike the tile preview it sits BEHIND the canvas
// (z-index 0; the canvas is z-index 1, see index.html), so the hero's gradients, title and
// buttons, drawn in WebGL, stay on top of it; the hero fades its artwork out to reveal it.
function tizenHeroPreview(): AppHeroPreview {
  let video: HTMLVideoElement | undefined
  let hls: { destroy(): void } | undefined
  let generation = 0
  const stop = () => {
    generation++
    hls?.destroy()
    hls = undefined
    if (video) {
      console.log('HERO video stop')
      video.pause()
      video.removeAttribute('src')
      video.load()
      video.remove()
      video = undefined
    }
  }
  return {
    start(url, onPlaying, onFailed) {
      stop()
      const current = generation
      const element = document.createElement('video')
      element.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:0;object-fit:cover;background:#0b0e17;pointer-events:none'
      element.autoplay = true
      element.playsInline = true
      let reported = false
      element.addEventListener('playing', () => {
        if (reported || current !== generation) return
        reported = true
        console.log(`HERO video playing ${element.videoWidth}x${element.videoHeight}`)
        onPlaying()
      })
      element.addEventListener('error', () => {
        console.warn('HERO video error', element.error?.code)
        if (current === generation) onFailed()
      })
      video = element
      document.body.insertBefore(element, document.body.firstChild)
      void import('hls.js').then(({ default: Hls }) => {
        if (current !== generation) return
        if (!Hls.isSupported()) {
          element.src = url
          return
        }
        const instance = new Hls({ maxBufferLength: 20 })
        hls = instance
        instance.on(Hls.Events.ERROR, (_event: unknown, data: { fatal?: boolean }) => {
          if (data.fatal && current === generation) onFailed()
        })
        instance.loadSource(url)
        instance.attachMedia(element)
      })
    },
    stop,
  }
}

export function tizenHost(): AppHost {
  const params = new URLSearchParams(window.location.search)
  registerKeys()
  return {
    platform: 'tizen',
    showFps: params.has('fps'),
    rendererOptions: {
      // The TV's web view is 1920x1080; the ratio also keeps a desktop browser usable for dev.
      deviceLogicalPixelRatio: Math.min(window.innerWidth / 1920, window.innerHeight / 1080),
      devicePhysicalPixelRatio: 1,
    },
    assetUrl: (path) => import.meta.env.BASE_URL + path,
    loadFonts: (_stage, fonts) => loadFonts(fonts.map((font) => ({ type: 'msdf', ...font }))),
    player: tizenPlayer(),
    preview: tizenPreview(),
    heroPreview: tizenHeroPreview(),
    exit() {
      const app = tizenApi()?.application
      if (app) app.getCurrentApplication().exit()
      else console.log('EXIT (no Tizen runtime: ignored in a desktop browser)')
    },
  }
}

export function resolveHost(): AppHost {
  return (globalThis.__VELOPE_HOST__ ??= tizenHost())
}
