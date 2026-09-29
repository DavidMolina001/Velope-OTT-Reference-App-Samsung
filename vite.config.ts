import { defineConfig, loadEnv } from 'vite'
import solidPlugin from 'vite-plugin-solid'

// Samsung TV build: `pnpm build` makes dist/, `pnpm tizen` packages, installs and launches it.
export default defineConfig(({ mode }) => {
  // The key may be set as VITE_TMDB_API_KEY (.env, as documented) or as plain TMDB_API_KEY.
  // Either name works; the value ends up in the app bundle by design, since the app calls TMDB
  // directly from the TV.
  const env = loadEnv(mode, process.cwd(), '')
  const tmdbKey = env.VITE_TMDB_API_KEY || env.TMDB_API_KEY || ''
  const tmdbBase = env.VITE_TMDB_BASE_URL || env.TMDB_BASE_URL || ''
  return {
  // Relative asset URLs: the packaged app loads from the TV's filesystem, not a web root.
  base: './',
  define: {
    'import.meta.env.VITE_TMDB_API_KEY': JSON.stringify(tmdbKey),
    'import.meta.env.VITE_TMDB_BASE_URL': tmdbBase ? JSON.stringify(tmdbBase) : 'undefined',
    // The renderer's build flags: make each explicit so the bundler can fold the guarded
    // branches away.
    __DEV__: mode !== 'production',
    __enableInspector__: mode !== 'production',
    __emitBoundsEvents__: false,
    __enableCompressedTextures__: false,
    // Text batching draws every text node after the quads of the frame, so text under an
    // opaque overlay (splash, error screen) showed through it. Off keeps tree order.
    __renderTextBatching__: false,
  },
  plugins: [
    solidPlugin({
      solid: {
        moduleName: '@solidtv/solid',
        generate: 'universal',
      },
    }),
  ],
  resolve: {
    dedupe: ['solid-js', '@solidtv/solid', '@solidtv/renderer'],
  },
  optimizeDeps: {
    exclude: ['@solidtv/solid', '@solidtv/renderer'],
  },
  server: {
    port: 5173,
  },
  }
})
