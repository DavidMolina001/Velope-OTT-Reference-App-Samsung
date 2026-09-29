import type { Component } from 'solid-js'

interface Props {
  /** Centre of the tick, in the parent's coordinates. */
  x: number
  y: number
  size: number
  color: number
}

// A check mark drawn from two rotated bars: the app's MSDF fonts carry no ✓ glyph.
const Tick: Component<Props> = (props) => {
  const bar = () => Math.max(4, Math.round(props.size * 0.14))
  return (
    <view x={props.x - props.size / 2} y={props.y - props.size / 2} width={props.size} height={props.size}>
      <view
        x={props.size * 0.1}
        y={props.size * 0.52}
        width={props.size * 0.38}
        height={bar()}
        borderRadius={bar() / 2}
        color={props.color}
        rotation={Math.PI / 4}
        pivotX={1}
        pivotY={0.5}
      />
      <view
        x={props.size * 0.34}
        y={props.size * 0.62}
        width={props.size * 0.7}
        height={bar()}
        borderRadius={bar() / 2}
        color={props.color}
        rotation={-Math.PI / 4}
        pivotX={0}
        pivotY={0.5}
      />
    </view>
  )
}

export default Tick
