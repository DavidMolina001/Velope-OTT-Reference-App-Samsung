import { For, Show, type Component } from 'solid-js'
import { backdropUrl } from '../services/tmdb'
import type { RowItem } from '../services/rows'
import Tick from './Tick'
import { colors, easing, layout } from '../theme'

interface Props {
  items: RowItem[]
  index: number
  /** The hero has focus (its buttons show their focused state). */
  focused: boolean
  /** Which button has focus: 0 = Play, 1 = the watchlist tick. */
  button: number
  favourited: boolean
  /** How far through the current item's preview (0..1): fills the active page pill. */
  progress: number
  /** The preview video is playing behind the canvas: the artwork fades out to reveal it. */
  videoShowing: boolean
  /** False while the rows have focus: the hero slides up and fades away. */
  visible: boolean
}

const TEXT_X = 120
const DOT = 12
const DOT_GAP = 12
const PILL = 48
const DOTS_RIGHT = 120
const DOTS_Y = 700
const artTransition = { alpha: { duration: 500 } } as const
const pageTransition = { y: { duration: 250, easing }, alpha: { duration: 250 } } as const
const dotTransition = { width: { duration: 250, easing }, x: { duration: 250, easing } } as const
const buttonTransition = { scale: { duration: 120 } } as const
const textTransition = { alpha: { duration: 300 } } as const
// Gradient colours are 0xRRGGBBAA: the app background, fading to transparent.
const BG_OPAQUE = 0x0b0e17ff
const BG_CLEAR = 0x0b0e1700

// The hero banner, after the Apple TV app's: full-bleed artwork per item, a title block with Play
// and watchlist buttons, and page dots bottom right. The active dot stretches into a pill that
// fills as the item's preview plays; when it is full the next item slides in (Home drives the
// cycle and the preview; this component only draws the state it is given). The preview video
// itself is DOM behind the canvas: while it plays the artwork fades out and the gradients, text
// and buttons stay on top of it.
const HeroBanner: Component<Props> = (props) => {
  const current = () => props.items[props.index]
  const meta = () => {
    const item = current()
    if (!item) return ''
    // The MSDF fonts carry no ★ · ▶ glyphs, so the metadata line is plain text.
    return item.rating > 0 ? `${item.year}      ${item.rating.toFixed(1)} / 10` : item.year
  }
  // Dot positions from the right edge: the active item is a pill, the rest are dots.
  const dotsWidth = () => props.items.length * DOT + (props.items.length - 1) * DOT_GAP + (PILL - DOT)
  const dotX = (i: number) => i * (DOT + DOT_GAP) + (i > props.index ? PILL - DOT : 0)

  return (
    <view width={layout.width} height={layout.height} y={props.visible ? 0 : -(layout.heroGridTop - layout.navHeight)} alpha={props.visible ? 1 : 0} transition={pageTransition}>
      {/* Artwork: only the current item and its neighbours load their texture. Wrapped in its own
          layer: items created later (the list arrives after mount) would otherwise be appended
          after, i.e. drawn on top of, the gradients below. */}
      <view width={layout.width} height={layout.height}>
      <For each={props.items}>
        {(item, i) => {
          const near = () => Math.abs(i() - props.index) <= 1 || (props.index === props.items.length - 1 && i() === 0)
          return (
            <view
              width={layout.width}
              height={layout.height}
              color={0xffffffff}
              src={near() ? backdropUrl(item.backdropPath, layout.width) : undefined}
              alpha={i() === props.index && !props.videoShowing ? 1 : 0}
              transition={artTransition}
            />
          )
        }}
      </For>
      </view>
      {/* Legibility: dark from the left behind the text, and a fade into the rows at the bottom. */}
      {/* The shader's angle 0 runs top to bottom and 3π/2 left to right (colors[0] first). */}
      <view width={1400} height={layout.height} linearGradient={{ colors: [BG_OPAQUE, BG_CLEAR], angle: (3 * Math.PI) / 2, stops: [0.1, 1] }} alpha={0.92} />
      <view y={480} width={layout.width} height={600} linearGradient={{ colors: [BG_CLEAR, BG_OPAQUE], angle: 0, stops: [0, 0.6] }} />
      <view width={layout.width} height={260} linearGradient={{ colors: [BG_OPAQUE, BG_CLEAR], angle: 0, stops: [0, 1] }} alpha={0.7} />

      <Show when={current()}>
        {(item) => (
          <view x={TEXT_X} y={250} width={0} height={0}>
            <text fontFamily="raleway" fontSize={76} width={1000} contain="width" maxLines={2} lineHeight={86} color={colors.textPrimary} transition={textTransition}>
              {item().title}
            </text>
            <text y={200} fontSize={30} color={colors.accent}>
              {meta()}
            </text>
            <text y={260} fontSize={28} width={900} contain="width" maxLines={3} lineHeight={42} color={colors.textSecondary}>
              {item().overview || 'No description available.'}
            </text>
            <view y={420} width={0} height={0}>
              <view
                width={260}
                height={80}
                borderRadius={40}
                color={props.focused && props.button === 0 ? 0xffffffff : 0xffffff33}
                scale={props.focused && props.button === 0 ? 1.06 : 1}
                transition={buttonTransition}
              >
                <text x={130} y={40} mount={0.5} fontSize={32} color={props.focused && props.button === 0 ? 0x0b0e17ff : colors.textPrimary}>
                  Play
                </text>
              </view>
              <view
                x={290}
                width={80}
                height={80}
                borderRadius={40}
                color={props.focused && props.button === 1 ? 0xffffffff : 0xffffff33}
                scale={props.focused && props.button === 1 ? 1.08 : 1}
                transition={buttonTransition}
              >
                <Show
                  when={props.favourited}
                  fallback={
                    <text x={40} y={40} mount={0.5} fontSize={44} color={props.focused && props.button === 1 ? 0x0b0e17ff : colors.textPrimary}>
                      +
                    </text>
                  }
                >
                  <Tick x={40} y={41} size={42} color={props.focused && props.button === 1 ? 0x0b0e17ff : colors.textPrimary} />
                </Show>
              </view>
            </view>
          </view>
        )}
      </Show>

      {/* Page dots: the active one is a pill filling with the preview's progress. */}
      <view x={layout.width - DOTS_RIGHT - dotsWidth()} y={DOTS_Y} width={0} height={0}>
        <For each={props.items}>
          {(_item, i) => {
            const active = () => i() === props.index
            return (
              <view x={dotX(i())} width={active() ? PILL : DOT} height={DOT} borderRadius={DOT / 2} color={active() ? 0xffffff55 : 0xffffff66} transition={dotTransition}>
                <Show when={active()}>
                  <view width={Math.max(DOT, PILL * props.progress)} height={DOT} borderRadius={DOT / 2} color={0xffffffff} />
                </Show>
              </view>
            )
          }}
        </For>
      </view>
    </view>
  )
}

export default HeroBanner
