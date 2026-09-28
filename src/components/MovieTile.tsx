import { createSignal, type Component } from 'solid-js'
import { colors, easing, layout } from '../theme'
import { backdropUrl, posterUrl } from '../services/tmdb'
import type { RowItem } from '../services/rows'

interface Props {
  item: RowItem
  x: number
  focused: boolean
  /** Widened for its preview: shows the wide backdrop (the video plays over it, see host.ts). */
  expanded?: boolean
}

// Transition settings are read once at creation, so they live outside the component.
const scaleTransition = { scale: { duration: 150 } } as const
const ringTransition = { alpha: { duration: 150 }, width: { duration: 250, easing } } as const
const placeholderTransition = { alpha: { duration: 200 } } as const
const sizeTransition = { width: { duration: 250, easing } } as const
const slideTransition = { x: { duration: 250, easing } } as const
const artTransition = { alpha: { duration: 250 } } as const
const coverTexture = { resizeMode: { type: 'cover' } } as const

// A tile knows how to look focused; it never decides whether it is. The poster node is always
// renderable (the renderer only loads textures for renderable nodes); the placeholder sits on
// top and fades out once the poster has loaded. Expanded, the tile widens to about twice its
// width and cross-fades from the portrait poster to the wide backdrop, which is only fetched
// once the tile expands.
const MovieTile: Component<Props> = (props) => {
  const [posterLoaded, setPosterLoaded] = createSignal(false)
  const [backdropLoaded, setBackdropLoaded] = createSignal(false)
  const posterSrc = () => posterUrl(props.item.posterPath, layout.tileWidth)
  const backdropSrc = () => (props.expanded ? backdropUrl(props.item.backdropPath, layout.expandedTileWidth) : undefined)
  const showBackdrop = () => !!props.expanded && !!props.item.backdropPath && backdropLoaded()
  const width = () => (props.expanded ? layout.expandedTileWidth : layout.tileWidth)
  const monogram = () => props.item.title.charAt(0).toUpperCase()
  return (
    <view x={props.x} width={width()} height={410} transition={slideTransition}>
      <view width={width()} height={layout.tileHeight} scale={props.focused && !props.expanded ? 1.06 : 1} transition={{ ...scaleTransition, ...sizeTransition }}>
        <view
          x={-6}
          y={-6}
          width={width() + 12}
          height={342}
          borderRadius={16}
          color={colors.focusRing}
          alpha={props.focused ? 1 : 0}
          transition={ringTransition}
        />
        <view width={width()} height={layout.tileHeight} borderRadius={12} color={colors.surface} transition={sizeTransition} />
        <view
          width={layout.tileWidth}
          height={layout.tileHeight}
          borderRadius={12}
          color={0xffffffff}
          src={posterSrc()}
          alpha={showBackdrop() ? 0 : 1}
          transition={artTransition}
          onEvent={{
            loaded: () => setPosterLoaded(true),
            failed: (_node: unknown, info: unknown) => import.meta.env.DEV && console.warn(`POSTER failed ${posterSrc()} ${JSON.stringify(info)}`),
          }}
        />
        <view
          width={layout.tileWidth}
          height={layout.tileHeight}
          borderRadius={12}
          color={colors.surface}
          alpha={posterLoaded() || showBackdrop() ? 0 : 1}
          transition={placeholderTransition}
        >
          <text x={110} y={165} mount={0.5} fontSize={96} color={colors.monogram}>
            {monogram()}
          </text>
        </view>
        <view
          width={width()}
          height={layout.tileHeight}
          borderRadius={12}
          color={0xffffffff}
          src={backdropSrc()}
          textureOptions={coverTexture}
          alpha={showBackdrop() ? 1 : 0}
          transition={{ ...artTransition, ...sizeTransition }}
          onEvent={{ loaded: () => setBackdropLoaded(true) }}
        />
      </view>
      <text y={344} fontSize={26} width={width()} contain="width" maxLines={1} color={colors.textPrimary}>
        {props.item.title}
      </text>
      <text y={378} fontSize={22} color={colors.textMuted}>
        {props.item.year}
      </text>
    </view>
  )
}

export default MovieTile
