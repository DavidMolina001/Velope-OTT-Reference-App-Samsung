// The app's palette and geometry (colours as 0xRRGGBBAA).
export const colors = {
  background: 0x0b0e17ff,
  accent: 0x8b6cffff,
  textPrimary: 0xf2f5ffff,
  textSecondary: 0xc7cee0ff,
  textMuted: 0x8a93adff,
  textRow: 0xe8ecf7ff,
  surface: 0x1c2233ff,
  surfaceButton: 0x232b45ff,
  navPill: 0x2a3350ff,
  monogram: 0x39415cff,
  focusRing: 0xf5f7ffff,
} as const

export const layout = {
  width: 1920,
  height: 1080,
  navHeight: 176,
  rowStep: 470,
  tileStep: 240,
  tileWidth: 220,
  tileHeight: 330,
  visibleTiles: 7,
  /** The middle of the 7 visible tiles: where focus stops walking and the row starts sliding. */
  focusSlot: 3,
  recycleBuffer: 2,
  /** A tile expanded for its preview: about twice as wide (two tiles plus the gap between). */
  expandedTileWidth: 460,
  /** How long focus rests on a tile before it expands and plays its preview. */
  previewDelay: 3000,
  /** OK on a tile grows its preview into the full player only once it has played this long. */
  previewCommitAfter: 7000,
  /** Where the rows start while the hero banner is on screen (the first row peeks below it). */
  heroGridTop: 800,
  /** Hero: rest before its preview starts, and how long each preview plays before advancing. */
  heroPreviewDelay: 1000,
  heroPreviewLength: 15000,
  /** After its preview, the hero only moves on once the remote has been idle this long. */
  heroIdleBeforeAdvance: 7000,
  /** Hero items: the first titles with wide artwork from the current genre's first row. */
  heroItemCount: 6,
  /** Hero artwork size requested from TMDB: w1280 upscaled is indistinguishable behind the
   *  gradients on a TV, and a quarter of the texture memory of the original (up to 4K). */
  heroArtWidth: 1280,
  /** With no key press for this long the app goes dormant: previews stop, artwork stays. */
  dormantAfter: 10 * 60 * 1000,
} as const

export const easing = 'cubic-bezier(0.25,0.1,0.25,1)'
