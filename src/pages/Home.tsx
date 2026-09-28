import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show, type Component } from 'solid-js'
import type { ElementNode, KeyHandler } from '@solidtv/solid'
import { useNavigate } from '@solidjs/router'
import { setSelectedMovie } from '../state/selection'
import { createStore } from 'solid-js/store'
import GenreNav, { type NavGenre } from '../components/GenreNav'
import CarouselRow from '../components/CarouselRow'
import ErrorScreen from '../components/ErrorScreen'
import HeroBanner from '../components/HeroBanner'
import { CLEAR_STREAM, STREAMS } from '../state/playback'
import { resolveHost } from '../host'
import { getGenres, loadImageConfig, isAbortError } from '../services/tmdb'
import { buildRows, fetchRowItems, fetchRowPage, extendRowItems, MAX_DISCOVER_PAGE, type Row } from '../services/rows'
import { colors, easing, layout } from '../theme'
import { exposeDebug } from '../debug'
import { exitPromptOpen, setExitPromptOpen } from '../state/exit'
import { splash } from '../state/boot'

const NAV_GENRE_COUNT = 4
const ROW_PREFETCH_AHEAD = 3
const ROW_PREFETCH_BEHIND = 1
const EXTEND_WHEN_TILES_LEFT = 12
const { rowStep: ROW_STEP, visibleTiles: VISIBLE_TILES, focusSlot: FOCUS_SLOT } = layout

type Phase = 'loading' | 'ready' | 'error'
type Zone = 'nav' | 'hero' | 'grid'

// The single explicit focus model of the L3 build: which plane has focus, and one remembered
// column per row. Every visual derives from it; the key handlers (Gate 3) only mutate it.
interface HomeState {
  phase: Phase
  errorMessage: string
  zone: Zone
  navIndex: number
  activeGenreIndex: number
  genres: NavGenre[]
  rows: Row[]
  rowIndex: number
  cols: number[]
  /** Per row: the first slot on screen. Focus walks inside the screen; see stepColumn. */
  scrolls: number[]
  /** Hero banner: the item on show and which of its buttons has focus (0 Play, 1 watchlist). */
  heroIndex: number
  heroButton: number
}

const gridTransition = { y: { duration: 250, easing } } as const
const gridAreaTransition = { y: { duration: 250, easing }, height: { duration: 250, easing } } as const

let inflight = new AbortController()
const extending = new Set<string>()

// KeepAliveRoute passes isAlive: false while the details page is up, true again on return.
const Home: Component<{ isAlive?: () => boolean }> = (props) => {
  const navigate = useNavigate()
  let root: ElementNode | undefined
  const [state, setState] = createStore<HomeState>({
    phase: 'loading',
    errorMessage: '',
    zone: 'nav',
    navIndex: 0,
    activeGenreIndex: 0,
    genres: [],
    rows: [],
    rowIndex: 0,
    cols: [],
    scrolls: [],
    heroIndex: 0,
    heroButton: 0,
  })

  const activeGenreId = () => state.genres[state.activeGenreIndex]?.id ?? null

  // Only rows in or near the viewport exist; off-screen rows are destroyed with their textures
  const visibleRows = createMemo(() => {
    const from = Math.max(0, state.rowIndex - ROW_PREFETCH_BEHIND)
    return state.rows.slice(from, state.rowIndex + ROW_PREFETCH_AHEAD + 1)
  })

  async function boot(): Promise<void> {
    setState({ phase: 'loading' })
    inflight = new AbortController()
    try {
      const [genreList] = await Promise.all([getGenres(inflight.signal), loadImageConfig(inflight.signal)])
      setState('genres', [{ id: null, name: 'All' }, ...genreList.slice(0, NAV_GENRE_COUNT)])
      applyGenre()
      await loadRow(0)
      setState({ phase: 'ready', zone: 'hero' })
      loadRowsAround(0)
    } catch (error) {
      if (isAbortError(error)) return
      setState({ phase: 'error', errorMessage: error instanceof Error ? error.message : String(error) })
    }
  }

  function applyGenre(): void {
    inflight.abort()
    inflight = new AbortController()
    const rows = buildRows(activeGenreId())
    setState({ rows, cols: rows.map(() => 0), scrolls: rows.map(() => 0), rowIndex: 0, heroIndex: 0, heroButton: 0 })
  }

  function loadRowsAround(index: number): void {
    const first = Math.max(0, index - ROW_PREFETCH_BEHIND)
    const last = Math.min(state.rows.length - 1, index + ROW_PREFETCH_AHEAD)
    for (let rowNumber = first; rowNumber <= last; rowNumber++) void loadRow(rowNumber)
  }

  async function loadRow(index: number): Promise<void> {
    const row = state.rows[index]
    if (!row || row.status === 'loading' || row.status === 'ready') return
    const rowId = row.id
    patchRow(index, rowId, { status: 'loading' })
    try {
      const { items, nextPage } = await fetchRowItems(activeGenreId(), index, inflight.signal)
      // One page per row, then the row cycles (exhausted from birth; see rows.ts)
      patchRow(index, rowId, { status: 'ready', items, nextPage })
    } catch (error) {
      patchRow(index, rowId, { status: isAbortError(error) ? 'pending' : 'error' })
    }
  }

  // Every row mutation is guarded by row id, so a late response from an abandoned genre can
  // never write into the new one. Store updates keep the row's identity (fine-grained).
  function patchRow(index: number, id: string, patch: Partial<Row>): void {
    const current = state.rows[index]
    if (!current || current.id !== id) return
    setState('rows', index, patch)
  }

  // Focus walks first: moving right, focus crosses the screen until it reaches the middle slot
  // (FOCUS_SLOT), then stays there and the row slides under it, cycling forever once exhausted.
  // Moving left, focus walks back across the screen and the row only slides back once focus
  // reaches the left edge, down to the real first item. Rows shorter than the viewport clamp.
  function stepColumn(direction: number): void {
    const index = state.rowIndex
    const row = state.rows[index]
    if (!row || row.items.length === 0) return
    const col = state.cols[index] ?? 0
    const scroll = state.scrolls[index] ?? 0
    if (direction < 0) {
      const next = Math.max(0, col - 1)
      setState('cols', index, next)
      if (next < scroll) setState('scrolls', index, next)
      return
    }
    const count = row.items.length
    const cycling = row.exhausted && count > VISIBLE_TILES
    if (col + 1 < count || cycling) {
      const next = col + 1
      setState('cols', index, next)
      if (next - scroll > FOCUS_SLOT) {
        const maxScroll = cycling ? Infinity : Math.max(0, count - VISIBLE_TILES)
        setState('scrolls', index, Math.min(next - FOCUS_SLOT, maxScroll))
      }
    }
    if (!row.exhausted && count - col <= EXTEND_WHEN_TILES_LEFT) void extendRow(index)
  }

  async function extendRow(index: number): Promise<void> {
    const row = state.rows[index]
    if (!row || row.status !== 'ready' || row.exhausted || extending.has(row.id)) return
    if (row.nextPage > MAX_DISCOVER_PAGE) {
      patchRow(index, row.id, { exhausted: true })
      return
    }
    const rowId = row.id
    extending.add(rowId)
    try {
      const fresh = await fetchRowPage(activeGenreId(), index, row.nextPage, inflight.signal)
      const current = state.rows[index]
      if (!current || current.id !== rowId) return
      const items = extendRowItems(current.items, fresh, index)
      patchRow(index, rowId, { items, nextPage: current.nextPage + 1, exhausted: items.length === current.items.length })
    } catch {
      // Aborted or failed: leave the row as is; the next scroll step retries
    } finally {
      extending.delete(rowId)
    }
  }

  function activateGenre(): void {
    if (state.navIndex === state.activeGenreIndex) return
    setState('activeGenreIndex', state.navIndex)
    applyGenre()
    loadRowsAround(0)
  }

  createEffect(on(() => state.rowIndex, (index) => loadRowsAround(index), { defer: true }))

  // Back from details: the cached page is re-shown, not re-created, so autofocus does not run
  // again; focus is put back on the root explicitly, after the router has re-attached it.
  createEffect(
    on(
      () => props.isAlive?.() ?? true,
      (alive) => {
        if (alive) setTimeout(() => root?.setFocus(), 0)
      },
      { defer: true }
    )
  )

  onMount(() => void boot())
  onCleanup(() => inflight.abort())

  function openFocusedMovie(): void {
    const row = state.rows[state.rowIndex]
    if (!row) return
    if (row.status === 'error') {
      void loadRow(state.rowIndex)
      return
    }
    const item = row.items[(state.cols[state.rowIndex] ?? 0) % row.items.length]
    if (!item) return
    setSelectedMovie({ ...item })
    navigate('/details')
  }

  // All key handling lives here and only mutates the model. A handled press calls
  // preventDefault() and returns true (consumed: the tvOS host keeps it in the app); the
  // one press left unhandled is Back in the nav, the root of the app, so the Siri Remote's
  // Menu returns to the tvOS Home screen there, and nowhere else.
  const handled = (e: { preventDefault?: () => void }) => {
    e.preventDefault?.()
    return true
  }
  // Up/Down land on the tile directly above/below on screen: the target row keeps its own
  // scroll, and focus takes the same screen position the current row's focus had.
  function moveToRow(target: number): void {
    const from = state.rowIndex
    if (target === from) return
    const screenPos = (state.cols[from] ?? 0) - (state.scrolls[from] ?? 0)
    const targetScroll = state.scrolls[target] ?? 0
    const row = state.rows[target]
    const count = row?.items.length ?? 0
    const cycling = !!row?.exhausted && count > VISIBLE_TILES
    let col = targetScroll + screenPos
    if (count > 0 && !cycling) col = Math.min(col, count - 1)
    setState('cols', target, col)
    setState('rowIndex', target)
  }
  // Vertical order: nav, hero, rows. The hero is skipped when it has no items.
  const hasHero = () => heroItems().length > 0
  const onUp: KeyHandler = (e) => {
    if (state.phase !== 'ready' || state.zone === 'nav') return handled(e)
    if (state.zone === 'hero') setState('zone', 'nav')
    else if (state.rowIndex === 0) setState({ zone: hasHero() ? 'hero' : 'nav', heroButton: 0 })
    else moveToRow(state.rowIndex - 1)
    return handled(e)
  }
  const onDown: KeyHandler = (e) => {
    if (state.phase !== 'ready') return handled(e)
    if (state.zone === 'nav') setState({ zone: hasHero() ? 'hero' : 'grid', heroButton: 0 })
    else if (state.zone === 'hero') setState('zone', 'grid')
    else moveToRow(Math.min(state.rowIndex + 1, state.rows.length - 1))
    return handled(e)
  }
  // Hero, Apple style: Left/Right move between Play and the tick; Right from the tick goes to the
  // next item and Left from Play to the previous one, looping both ways.
  function stepHero(direction: number): void {
    const count = heroItems().length
    if (count === 0) return
    setState({ heroIndex: (state.heroIndex + direction + count) % count, heroButton: 0 })
  }
  const onLeft: KeyHandler = (e) => {
    if (state.phase !== 'ready') return handled(e)
    if (state.zone === 'nav') setState('navIndex', Math.max(0, state.navIndex - 1))
    else if (state.zone === 'hero') {
      if (state.heroButton === 1) setState('heroButton', 0)
      else stepHero(-1)
    } else stepColumn(-1)
    return handled(e)
  }
  const onRight: KeyHandler = (e) => {
    if (state.phase !== 'ready') return handled(e)
    if (state.zone === 'nav') setState('navIndex', Math.min(state.navIndex + 1, state.genres.length - 1))
    else if (state.zone === 'hero') {
      if (state.heroButton === 0) setState('heroButton', 1)
      else stepHero(1)
    } else stepColumn(1)
    return handled(e)
  }
  const onEnter: KeyHandler = (e) => {
    if (state.phase === 'error') {
      void boot()
      return handled(e)
    }
    if (state.phase !== 'ready') return handled(e)
    if (state.zone === 'nav') activateGenre()
    else if (state.zone === 'hero') activateHeroButton()
    else openFocusedMovie()
    return handled(e)
  }
  // Back: rows -> hero (back to the top), hero or nav -> the exit dialog.
  const onBack: KeyHandler = (e) => {
    if (state.phase === 'ready' && state.zone === 'grid') {
      setState({ zone: hasHero() ? 'hero' : 'nav', heroButton: 0 })
      return handled(e)
    }
    setExitPromptOpen(true)
    return handled(e)
  }

  // Hero banner ------------------------------------------------------------------------------
  const host = resolveHost()
  const heroItems = createMemo(() => {
    const row = state.rows[0]
    if (!row || row.status !== 'ready') return []
    return row.items.filter((item) => item.backdropPath).slice(0, layout.heroItemCount)
  })
  const [heroProgress, setHeroProgress] = createSignal(0)
  const [heroVideoShowing, setHeroVideoShowing] = createSignal(false)
  const [playerOpen, setPlayerOpen] = createSignal(false)
  const [favourites, setFavourites] = createSignal<ReadonlySet<number>>(new Set())
  const heroItem = () => heroItems()[state.heroIndex]

  function activateHeroButton(): void {
    const item = heroItem()
    if (!item) return
    if (state.heroButton === 1) {
      const next = new Set(favourites())
      if (next.has(item.id)) next.delete(item.id)
      else next.add(item.id)
      setFavourites(next)
      if (import.meta.env.VITE_LOG_URL) console.log(`HERO watchlist ${item.title} ${next.has(item.id) ? 'added' : 'removed'}`)
      return
    }
    if (!host.player) return
    setPlayerOpen(true)
    host.player.play(STREAMS, () => setPlayerOpen(false), item.title)
  }

  // The hero cycle, while the hero is on screen: after heroPreviewDelay its preview starts behind
  // the canvas; once it plays, the active page pill fills over heroPreviewLength, then the next
  // item comes in (looping) and the cycle restarts. If the video cannot play, the pill fills over
  // the still artwork instead. Leaving the hero (rows, details, player, exit dialog) stops it.
  // A memo, so moving between the nav and the hero (both "active") does not restart the preview.
  const heroActive = createMemo(
    () => (props.isAlive?.() ?? true) && !exitPromptOpen() && !playerOpen() && state.phase === 'ready' && state.zone !== 'grid' && heroItems().length > 0
  )
  createEffect(() => {
    const index = state.heroIndex
    const active = heroActive()
    setHeroProgress(0)
    setHeroVideoShowing(false)
    if (!active) return
    let startedAt = 0
    let ticker: ReturnType<typeof setInterval> | undefined
    const runProgress = () => {
      if (ticker) return
      startedAt = performance.now()
      ticker = setInterval(() => {
        const progress = Math.min(1, (performance.now() - startedAt) / layout.heroPreviewLength)
        setHeroProgress(progress)
        if (progress >= 1) stepHero(1)
      }, 100)
    }
    const heroPreview = host.heroPreview
    const delay = setTimeout(() => {
      if (!heroPreview) return runProgress()
      console.log(`HERO preview start index=${index}`)
      heroPreview.start(
        CLEAR_STREAM.url,
        () => {
          setHeroVideoShowing(true)
          runProgress()
        },
        () => runProgress()
      )
    }, layout.heroPreviewDelay)
    // A stream that never starts must not stall the carousel.
    const fallback = setTimeout(runProgress, layout.heroPreviewDelay + 8000)
    onCleanup(() => {
      clearTimeout(delay)
      clearTimeout(fallback)
      if (ticker) clearInterval(ticker)
      heroPreview?.stop()
    })
  })

  // Preview: once focus has rested on a tile for layout.previewDelay, that tile expands and plays
  // its preview. Any focus change, leaving the grid or opening a title cancels it at once.
  const [preview, setPreview] = createSignal<{ row: number; col: number } | null>(null)
  createEffect(() => {
    const alive = props.isAlive?.() ?? true
    const rowIndex = state.rowIndex
    const col = state.cols[rowIndex] ?? 0
    const ready = alive && !exitPromptOpen() && state.phase === 'ready' && state.zone === 'grid' && state.rows[rowIndex]?.status === 'ready'
    setPreview(null)
    if (!ready) return
    const timer = setTimeout(() => {
      console.log(`PREVIEW expand row=${rowIndex} col=${col}`)
      setPreview({ row: rowIndex, col })
    }, layout.previewDelay)
    onCleanup(() => clearTimeout(timer))
  })

  // The boot splash (DOM, see splash.ts) covers the app until there is something to show.
  createEffect(() => {
    if (state.phase === 'ready' || state.phase === 'error') splash?.ready()
  })

  exposeDebug('home', { state, setState })
  // Dev builds, and builds with remote logging (VITE_LOG_URL), log every focus-model change so
  // the TV's behaviour can be checked from the log.
  if (import.meta.env.DEV || import.meta.env.VITE_LOG_URL) {
    createEffect(() => {
      const row = state.rows[state.rowIndex]
      console.log(
        `FOCUS zone=${state.zone} hero=${state.heroIndex}/${state.heroButton} nav=${state.navIndex} row=${state.rowIndex} col=${state.cols[state.rowIndex] ?? 0} scroll=${state.scrolls[state.rowIndex] ?? 0} items=${row?.items.length ?? 0}${row?.exhausted ? ' exhausted' : ''} phase=${state.phase} title=${row?.items.length ? row.items[(state.cols[state.rowIndex] ?? 0) % row.items.length]?.title : ''} nodes=${globalThis.__velope?.countNodes() ?? -1}`
      )
    })
  }

  return (
    <view
      ref={root}
      autofocus
      width={layout.width}
      height={layout.height}
      onUp={onUp}
      onDown={onDown}
      onLeft={onLeft}
      onRight={onRight}
      onEnter={onEnter}
      onBack={onBack}
    >
      <HeroBanner
        items={heroItems()}
        index={state.heroIndex}
        focused={state.zone === 'hero'}
        button={state.heroButton}
        favourited={!!heroItem() && favourites().has(heroItem()!.id)}
        progress={heroProgress()}
        videoShowing={heroVideoShowing()}
        visible={state.zone !== 'grid' && hasHero()}
      />
      {/* The rows sit under the hero (first row peeking) until they take focus, then move up. */}
      <view
        y={state.zone === 'grid' || !hasHero() ? layout.navHeight : layout.heroGridTop}
        width={layout.width}
        height={layout.height - (state.zone === 'grid' || !hasHero() ? layout.navHeight : layout.heroGridTop)}
        clipping
        transition={gridAreaTransition}
      >
        {/* Zero size on purpose: a translated container must not carry its parent's bounds (see CarouselRow) */}
        <view width={0} height={0} y={-state.rowIndex * ROW_STEP} transition={gridTransition}>
          <For each={visibleRows()}>
            {(row) => (
              <CarouselRow
                row={row}
                y={row.index * ROW_STEP}
                focusedCol={state.cols[row.index] ?? 0}
                scrollCol={state.scrolls[row.index] ?? 0}
                rowFocused={state.zone === 'grid' && row.index === state.rowIndex}
                expandedCol={preview()?.row === row.index ? preview()!.col : null}
              />
            )}
          </For>
        </view>
      </view>
      <GenreNav genres={state.genres} focusedIndex={state.navIndex} activeIndex={state.activeGenreIndex} navFocused={state.zone === 'nav'} />
      <Show when={state.phase === 'error'}>
        <ErrorScreen message={state.errorMessage} />
      </Show>
    </view>
  )
}

export default Home
