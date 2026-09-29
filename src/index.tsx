import { Config, createRenderer, registerDefaultShaders } from '@solidtv/solid'
import { FPSCounter, setupFPS, useFocusManager } from '@solidtv/solid/primitives'
import { SdfTextRenderer, WebGlCoreRenderer } from '@solidtv/renderer/webgl'
import type { RendererMain } from '@solidtv/renderer'
import { resolveHost } from './host'
import { appFonts } from './fonts'
import { describeRuntime } from './services/tmdb'
import { colors, layout } from './theme'
import App from './App'
import { installDebug } from './debug'
import { showSplash } from './splash'
import { setSplash, setSplashHidden } from './state/boot'

// The TV has no console we can read: with VITE_LOG_URL set at build time (e.g. in .env.local),
// console.log/warn/error are also POSTed there, one line per call.
const logUrl = import.meta.env.VITE_LOG_URL
if (logUrl) {
  for (const level of ['log', 'warn', 'error'] as const) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      original(...args)
      const line = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')
      try {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', logUrl)
        xhr.send(`${level.toUpperCase()} ${line}`)
      } catch {
        // logging must never break the app
      }
    }
  }
  window.addEventListener('keydown', (e) => console.log(`KEY ${e.keyCode} ${e.key}`), true)
  window.addEventListener('error', (e) => console.error('UNCAUGHT', e.message, e.filename, e.lineno))
  window.addEventListener('unhandledrejection', (e) => console.error('UNHANDLED', String(e.reason)))
}

// First thing on screen, before the renderer and fonts load.
setSplash(showSplash(() => setSplashHidden(true)))

const host = resolveHost()
console.log(`RUNTIME ${host.platform} ${describeRuntime()}`)

Config.fontSettings.fontFamily = 'lato'
Config.fontSettings.fontSize = 32
Config.fontSettings.color = colors.textPrimary
// Coalesce held-key repeats so navigation never floods the render loop.
Config.throttleInput = 100
Config.rendererOptions = {
  appWidth: layout.width,
  appHeight: layout.height,
  // Transparent: the body's CSS background shows through, and so does the hero video behind it.
  clearColor: 0x00000000,
  numImageWorkers: 0,
  // Frame telemetry only when the counter is shown (?fps=1 in the URL, e.g. in a desktop browser)
  fpsUpdateInterval: host.showFps ? 300 : 0,
  fontEngines: [SdfTextRenderer],
  renderEngine: WebGlCoreRenderer,
  // Hard ceiling for texture memory (160 MB, target 80%); the renderer evicts
  // least-recently-used off-screen textures on top of that.
  textureMemory: { criticalThreshold: 160e6, targetThresholdLevel: 0.8 },
  ...host.rendererOptions,
}

// createRenderer's return type covers the DOM renderer too; this app is WebGL-only.
const created = createRenderer(Config.rendererOptions)
const renderer = created.renderer as RendererMain
const render = created.render
registerDefaultShaders(renderer.stage.shManager)
installDebug(renderer)
// Metrics probe, remote-logging builds only: every 5 s, JS heap, DOM/video/canvas counts, the
// renderer's node count, frames per second and main-thread long tasks (> 50 ms), so a slowdown on
// the TV can be told apart as a leak, a render-loop stall or a decoder problem.
if (logUrl) {
  type Tree = { children?: readonly unknown[] } | undefined
  const countNodes = (node: Tree): number => (node ? 1 + (node.children ?? []).reduce<number>((n, c) => n + countNodes(c as Tree), 0) : 0)
  let frames = 0
  let longTasks = 0
  let longest = 0
  const tick = () => {
    frames++
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration <= 50) continue
        longTasks++
        longest = Math.max(longest, entry.duration)
      }
    }).observe({ type: 'longtask', buffered: false })
  } catch {
    // no longtask support on this runtime
  }
  const started = performance.now()
  setInterval(() => {
    const mem = (performance as { memory?: { usedJSHeapSize: number } }).memory
    const heap = mem ? (mem.usedJSHeapSize / 1e6).toFixed(1) : '-1'
    console.log(
      `METRICS up=${Math.round((performance.now() - started) / 1000)} heapMB=${heap} domNodes=${document.getElementsByTagName('*').length} videos=${document.querySelectorAll('video').length} canvases=${document.querySelectorAll('canvas').length} lightningNodes=${countNodes(renderer.root as unknown as Tree)} fps=${(frames / 5).toFixed(1)} longTasks=${longTasks} longestMs=${Math.round(longest)}`
    )
    frames = longTasks = longest = 0
  }, 5000)
}
if (host.showFps) setupFPS({ renderer })

host.loadFonts(renderer.stage, appFonts(host)).then(() => {
  render(() => {
    useFocusManager({
      Left: ['ArrowLeft', 37],
      Right: ['ArrowRight', 39],
      Up: ['ArrowUp', 38],
      Down: ['ArrowDown', 40],
      Enter: ['Enter', 13],
      // 10009 is the Samsung remote's Back key
      Back: ['Backspace', 'Escape', 8, 27, 10009],
    })
    return (
      <>
        <App />
        {host.showFps && <FPSCounter mountX={1} x={1910} y={10} />}
      </>
    )
  })
  console.log(`APP rendered on ${host.platform}`)
})
