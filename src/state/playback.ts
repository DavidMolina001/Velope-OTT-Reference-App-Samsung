// What "Play now" (and every preview) plays.
//
// The player (host.ts) tries the streams of STREAMS in order and plays the first one the TV can
// start: DASH with Widevine goes through Shaka Player and EME, HLS through hls.js.

export interface Stream {
  url: string
  /** EME key system id -> licence server URL, e.g. 'com.widevine.alpha'. Absent for clear content. */
  drm?: Record<string, string>
  label: string
}

/**
 * Not played at the moment: castLabs' DRMtoday staging licence server refuses this TV's Widevine
 * requests (Shaka error 6007, LICENSE_REQUEST_FAILED). Kept so that DRM playback can be switched
 * on again by adding it to STREAMS once a licence server accepts the TV; the player's Widevine
 * path (EME key system check, Shaka DRM config) is in place.
 */
export const WIDEVINE_STREAM: Stream = {
  url: 'https://d24rwxnt7vw9qb.cloudfront.net/out/v1/feb9354da126479386ae8d47ba103cf8/index.mpd',
  drm: { 'com.widevine.alpha': 'https://lic.staging.drmtoday.com/license-proxy-widevine/cenc/?specConform=true' },
  label: 'DASH + Widevine (DRMtoday demo)',
}

/** Clear HLS: Big Buck Bunny (Blender Foundation, CC BY 3.0) from Mux's public test streams. */
export const CLEAR_STREAM: Stream = {
  url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  label: 'HLS (Big Buck Bunny)',
}

/** What Play now plays on the TV, in order of preference. */
export const STREAMS: Stream[] = [CLEAR_STREAM]

export function isDash(url: string): boolean {
  return /\.mpd(\?|$)/i.test(url)
}

export function isHls(url: string): boolean {
  return /\.m3u8(\?|$)/i.test(url)
}
