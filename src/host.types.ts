// The runtime seam's types, in a file with no runtime imports so the tvOS boot file can
// import them without pulling Vite's ambient types into the NativeScript typecheck.
import type { RendererMain, RendererMainSettings, Stage } from '@solidtv/renderer'
import type { KeyEventTarget } from '@solidtv/solid'
import type { Stream } from './state/playback'

export interface SdfFont {
  fontFamily: string
  atlasUrl: string
  atlasDataUrl: string
  metrics?: { ascender: number; descender: number; lineGap: number; unitsPerEm: number }
}

/** A rectangle in app coordinates (the 1920x1080 scene). */
export interface PreviewRect {
  x: number
  y: number
  width: number
  height: number
}

/** A small inline video over the scene: the tile preview. */
export interface AppPreview {
  /** Plays `url` inside `rect`, with sound. Replaces any preview already playing. */
  start(url: string, rect: PreviewRect): void
  /** Stops and removes the preview. Safe to call when nothing plays. */
  stop(): void
}

/** The hero banner's background video: full screen, BEHIND the canvas (see index.html). */
export interface AppHeroPreview {
  /** Plays `url` with sound; `onPlaying` fires once, when the first frame is on screen. */
  start(url: string, onPlaying: () => void, onFailed: () => void): void
  /** Stops and removes it. Safe to call when nothing plays. */
  stop(): void
}

/** Full-screen playback of one stream, native to each runtime. */
export interface AppPlayer {
  /** Whether this runtime can play the stream's container and DRM (decided before trying). */
  canPlay(stream: Stream): boolean
  /**
   * Plays the first stream of `streams` this runtime can play, full screen, falling back to the
   * next when a stream fails to start (e.g. no CDM for its DRM). `onClosed` fires when playback
   * ends, every candidate failed, or the user leaves it.
   */
  play(streams: Stream[], onClosed: () => void, title?: string): void
  /** Pause/resume. */
  togglePause(): void
  /** Tears the player down. Safe to call when nothing plays. */
  stop(): void
}

export interface AppHost {
  /** Always 'tizen' in this Samsung build. */
  platform: 'tizen'
  /** Show the FPS counter (web: ?fps=1, as in the L3 build). */
  showFps?: boolean
  /** Renderer settings the host requires (canvas, pixel ratios, platform). Merged under the app's own. */
  rendererOptions: Partial<RendererMainSettings>
  /** Where the renderer appends its canvas; undefined means document.body. */
  target?: HTMLElement
  /** Where the focus manager listens for keydown/keyup; undefined means `document`. */
  keyTarget?: KeyEventTarget
  /** Resolves an asset path relative to public/ (or the bundle) to a URL the renderer can fetch. */
  assetUrl(path: string): string
  /** Registers the MSDF fonts. Resolves once text nodes may be created. */
  loadFonts(stage: Stage, fonts: SdfFont[]): Promise<void>
  /** Called once the renderer exists. */
  onRenderer?(renderer: RendererMain): void
  /** The runtime's video player, when it has one. */
  player?: AppPlayer
  /** The tile preview player, when the runtime has one. */
  preview?: AppPreview
  /** The hero banner's background video, when the runtime has one. */
  heroPreview?: AppHeroPreview
  /** Closes the app (Back at the root of the app on the TV). */
  exit?(): void
}

declare global {
  // eslint-disable-next-line no-var
  var __VELOPE_HOST__: AppHost | undefined
}

