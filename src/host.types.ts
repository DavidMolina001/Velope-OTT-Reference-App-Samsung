// The host interface: what the pages and components need from the TV (player, previews, fonts,
// exit), implemented for Samsung Tizen in host.ts. Types only, no runtime code.
import type { RendererMainSettings, Stage } from '@solidtv/renderer'
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
  /** Whether the preview's picture is on screen. */
  isShowing(): boolean
  /** How long the preview's picture has been on screen, in ms (0 when not showing). */
  shownFor(): number
  /**
   * Grows the playing preview from its tile to full screen and gives it up: it resolves once the
   * animation ends, with the video for the full player to continue. Undefined when not showing.
   */
  expandToFull(): Promise<HandedOverVideo> | undefined
}

/** A preview's playing video, handed to the full player so playback carries on uninterrupted. */
export interface HandedOverVideo {
  video: HTMLVideoElement
  /** Frees the streaming engine behind it; the player calls this when it closes. */
  release(): void
}

/** The hero banner's background video: full screen, BEHIND the canvas (see index.html). */
export interface AppHeroPreview {
  /** Plays `url` with sound; `onPlaying` fires once, when the first frame is on screen. */
  start(url: string, onPlaying: () => void, onFailed: () => void): void
  /** Stops and removes it. Safe to call when nothing plays. */
  stop(): void
  /**
   * Gives up the playing preview so the full player can continue it seamlessly, or returns
   * undefined when there is nothing to continue: not playing yet, or it did not start at the
   * beginning of the asset (then the full player starts the asset from the start instead).
   */
  handOver(): HandedOverVideo | undefined
}

/** Full-screen playback of one stream. */
export interface AppPlayer {
  /** Whether the TV can play the stream's container and DRM (decided before trying). */
  canPlay(stream: Stream): boolean
  /**
   * Plays the first stream of `streams` the TV can play, full screen, falling back to the
   * next when a stream fails to start (e.g. no CDM for its DRM). `onClosed` fires when playback
   * ends, every candidate failed, or the user leaves it.
   */
  play(streams: Stream[], onClosed: () => void, title?: string, continueFrom?: HandedOverVideo): void
  /** Pause/resume. */
  togglePause(): void
  /** Tears the player down. Safe to call when nothing plays. */
  stop(): void
}

export interface AppHost {
  /** The platform the host runs on; this app only has the Tizen host. */
  platform: 'tizen'
  /** Show the FPS counter (?fps=1 in the URL). */
  showFps?: boolean
  /** Renderer settings the host requires (pixel ratios). Merged under the app's own. */
  rendererOptions: Partial<RendererMainSettings>
  /** Resolves an asset path relative to public/ to a URL the renderer can fetch. */
  assetUrl(path: string): string
  /** Registers the MSDF fonts. Resolves once text nodes may be created. */
  loadFonts(stage: Stage, fonts: SdfFont[]): Promise<void>
  /** The full-screen video player. */
  player?: AppPlayer
  /** The tile preview player. */
  preview?: AppPreview
  /** The hero banner's background video. */
  heroPreview?: AppHeroPreview
  /** Closes the app (Back at the root of the app on the TV). */
  exit?(): void
}

declare global {
  // eslint-disable-next-line no-var
  var __VELOPE_HOST__: AppHost | undefined
}

