import { createEffect, createMemo, For, onCleanup, Show, type Component } from 'solid-js'
import type { ElementNode } from '@solidtv/solid'
import MovieTile from './MovieTile'
import { colors, easing, layout } from '../theme'
import type { Row, RowItem } from '../services/rows'
import { CLEAR_STREAM } from '../state/playback'
import { resolveHost } from '../host'

interface Props {
  row: Row
  y: number
  focusedCol: number
  /** First slot on screen (Home owns it: focus walks first, then the row slides). */
  scrollCol: number
  rowFocused: boolean
  /** The slot whose tile is expanded for its preview, if any (focused row only). */
  expandedCol?: number | null
}

const { tileStep: TILE_STEP, visibleTiles: VISIBLE_TILES, recycleBuffer: RECYCLE_BUFFER, focusSlot: FOCUS_SLOT } = layout
/** How much wider an expanded tile is; the neighbours move apart by exactly this much. */
const EXPANSION = layout.expandedTileWidth - layout.tileWidth
const ROW_X = 90
const TILES_Y = 64
/** Lets the tile finish widening before the video appears over it. */
const PREVIEW_AFTER_EXPAND = 260
const SKELETON_SLOTS = [0, 1, 2, 3, 4, 5, 6]
const scrollTransition = { x: { duration: 200, easing } } as const
const ringTransition = { alpha: { duration: 150 } } as const

// Only tiles in or near the viewport exist; the rest are destroyed and their textures released.
// Slots are virtual: while more pages exist the row simply grows; once exhausted (and longer
// than the viewport) it cycles through the items by modulo. Short rows clamp.
const CarouselRow: Component<Props> = (props) => {
  let scroller: ElementNode | undefined
  let currentX = 0
  // One stable object per slot, so <For> keeps a tile bound to its slot while the window slides
  // (a fresh object per recompute would recreate every tile on every step).
  const slotItems = new Map<number, RowItem>()

  const window = createMemo(() => {
    const items = props.row.items
    const count = items.length
    if (count === 0) {
      slotItems.clear()
      return { items: [] as RowItem[], scrollCol: 0 }
    }
    const cycling = props.row.exhausted && count > VISIBLE_TILES
    const scrollCol = cycling ? props.scrollCol : Math.min(props.scrollCol, Math.max(0, count - VISIBLE_TILES))
    const from = Math.max(0, scrollCol - RECYCLE_BUFFER)
    const to = cycling ? scrollCol + VISIBLE_TILES + RECYCLE_BUFFER : Math.min(scrollCol + VISIBLE_TILES + RECYCLE_BUFFER, count)
    for (const slot of [...slotItems.keys()]) if (slot < from || slot >= to) slotItems.delete(slot)
    const windowItems: RowItem[] = []
    for (let slot = from; slot < to; slot++) {
      let entry = slotItems.get(slot)
      if (!entry) {
        const source = items[slot % count]!
        entry = { ...source, key: String(slot), index: slot }
        slotItems.set(slot, entry)
      }
      windowItems.push(entry)
    }
    return { items: windowItems, scrollCol }
  })

  // Where a slot's tile sits. An expanded tile in the middle slot grows to both sides (the tiles
  // on its left move left, those on its right move right, half the expansion each); anywhere
  // else it grows to the right and only the tiles after it move.
  const tileX = (slot: number): number => {
    const base = slot * TILE_STEP
    const expanded = props.expandedCol
    if (expanded == null) return base
    const centred = expanded - window().scrollCol === FOCUS_SLOT
    if (centred) return slot <= expanded ? base - EXPANSION / 2 : base + EXPANSION / 2
    return slot > expanded ? base + EXPANSION : base
  }

  // The preview video plays over the expanded tile, positioned in screen coordinates: the
  // focused row is always at the top of the grid (Home translates the grid by the row index).
  const host = resolveHost()
  createEffect(() => {
    const expanded = props.expandedCol
    const preview = host.preview
    if (expanded == null || !preview) return
    const rect = {
      x: ROW_X + tileX(expanded) - window().scrollCol * TILE_STEP,
      y: layout.navHeight + TILES_Y,
      width: layout.expandedTileWidth,
      height: layout.tileHeight,
    }
    const timer = setTimeout(() => preview.start(CLEAR_STREAM.url, rect), PREVIEW_AFTER_EXPAND)
    onCleanup(() => {
      clearTimeout(timer)
      preview.stop()
    })
  })

  // Jumps past the recycle buffer (row re-creation, genre switch) snap instead of animating over
  // destroyed tiles; single steps keep the 200 ms glide.
  createEffect(() => {
    const targetX = -window().scrollCol * TILE_STEP
    if (!scroller || targetX === currentX) return
    if (Math.abs(targetX - currentX) > RECYCLE_BUFFER * TILE_STEP) scroller.lng.x = targetX
    else scroller.x = targetX
    currentX = targetX
  })

  // The scroller and the wrapper are pure translations with an explicit ZERO size. A <view>
  // without a size inherits its parent's, and a 1830-wide node at x = -2400 is entirely
  // off-screen: the renderer then marks it OutOfBounds and defers updating its children, so a
  // scrolled row (or a scrolled grid) goes blank. A zero-size node takes its parent's render
  // state instead, which is how Blits' size-less elements behave.
  return (
    <view y={props.y} width={layout.width} height={440}>
      <text x={90} fontFamily="raleway" fontSize={34} color={colors.textRow}>
        {props.row.title}
      </text>
      <view x={ROW_X} y={TILES_Y} width={0} height={0}>
        <Show when={props.row.status === 'ready'}>
          <view ref={scroller} width={0} height={0} transition={scrollTransition}>
            <For each={window().items}>
              {(item) => (
                <MovieTile
                  item={item}
                  x={tileX(item.index)}
                  focused={props.rowFocused && item.index === props.focusedCol}
                  expanded={item.index === props.expandedCol}
                />
              )}
            </For>
          </view>
        </Show>
        <Show when={props.row.status === 'pending' || props.row.status === 'loading'}>
          <view width={0} height={0}>
            <view
              x={-6}
              y={-6}
              width={232}
              height={342}
              borderRadius={16}
              color={colors.focusRing}
              alpha={props.rowFocused ? 1 : 0}
              transition={ringTransition}
            />
            <For each={SKELETON_SLOTS}>
              {(slot) => <view x={slot * TILE_STEP} width={layout.tileWidth} height={layout.tileHeight} borderRadius={12} color={colors.surface} alpha={0.55} />}
            </For>
          </view>
        </Show>
        <Show when={props.row.status === 'error'}>
          <view y={120} width={0} height={0}>
            <text fontSize={32} color={colors.textPrimary}>
              This row failed to load.
            </text>
            <text y={50} fontSize={26} color={props.rowFocused ? colors.accent : colors.textMuted}>
              Press Enter to retry
            </text>
          </view>
        </Show>
      </view>
    </view>
  )
}

export default CarouselRow
