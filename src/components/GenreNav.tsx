import { For, type Component } from 'solid-js'
import { colors, layout } from '../theme'

export interface NavGenre {
  /** A TMDB genre id, null for All, or 'favourites' for the saved list. */
  id: number | null | 'favourites'
  name: string
}

interface Props {
  genres: NavGenre[]
  focusedIndex: number
  activeIndex: number
  navFocused: boolean
}

// Six entries (All, four genres, Favourites) fit between the logo and the right edge.
const ITEM_STEP = 240
const ITEM_WIDTH = 220

const pillTransition = { x: { duration: 150 }, alpha: { duration: 150 } } as const

const GenreNav: Component<Props> = (props) => (
  <view width={layout.width} height={150}>
    <text x={90} y={46} fontFamily="raleway" fontSize={44} color={colors.accent}>
      VELOPE
    </text>
    <view x={420} y={40}>
      <view
        width={ITEM_WIDTH}
        height={64}
        borderRadius={32}
        color={colors.navPill}
        x={props.focusedIndex * ITEM_STEP}
        alpha={props.navFocused ? 1 : 0}
        transition={pillTransition}
      />
      <For each={props.genres}>
        {(genre, index) => (
          <text
            x={index() * ITEM_STEP}
            y={15}
            width={ITEM_WIDTH}
            contain="width"
            textAlign="center"
            fontSize={30}
            color={index() === props.activeIndex ? colors.accent : colors.textPrimary}
          >
            {genre.name}
          </text>
        )}
      </For>
    </view>
  </view>
)

export default GenreNav
