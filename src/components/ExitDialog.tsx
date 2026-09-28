import { createEffect, createSignal, on, Show, type Component } from 'solid-js'
import { activeElement, type ElementNode, type KeyHandler } from '@solidtv/solid'
import ActionButton from './ActionButton'
import { exitPromptOpen, setExitPromptOpen } from '../state/exit'
import { resolveHost } from '../host'
import { colors, layout } from '../theme'

const PANEL_WIDTH = 760
const PANEL_HEIGHT = 340

// A modal Yes/No over the whole app. It takes focus while open (so the page underneath never
// moves) and hands it back to whatever had it when it closes. Focus starts on No, so an
// accidental Exit press never closes the app on its own. Yes closes the app; it is relaunched
// from the TV's Apps list.
const ExitDialog: Component = () => {
  let panel: ElementNode | undefined
  let previous: ElementNode | undefined
  const [choice, setChoice] = createSignal<'yes' | 'no'>('no')

  if (import.meta.env.DEV || import.meta.env.VITE_LOG_URL) {
    createEffect(() => console.log(`EXIT dialog open=${exitPromptOpen()} choice=${choice()}`))
  }

  // Keyed on the open state only: activeElement is read untracked, otherwise the dialog taking
  // focus would re-run this and overwrite `previous` with the dialog itself.
  createEffect(
    on(exitPromptOpen, (open) => {
      if (open) {
        previous = activeElement()
        setChoice('no')
        queueMicrotask(() => panel?.setFocus())
      } else if (previous) {
        const restore = previous
        previous = undefined
        queueMicrotask(() => restore.setFocus())
      }
    }, { defer: true })
  )

  const handled = (e: { preventDefault?: () => void }) => {
    e.preventDefault?.()
    return true
  }
  const onLeft: KeyHandler = (e) => {
    setChoice('yes')
    return handled(e)
  }
  const onRight: KeyHandler = (e) => {
    setChoice('no')
    return handled(e)
  }
  const onEnter: KeyHandler = (e) => {
    if (choice() === 'yes') {
      console.log('EXIT confirmed')
      resolveHost().exit?.()
    } else setExitPromptOpen(false)
    return handled(e)
  }
  const onBack: KeyHandler = (e) => {
    setExitPromptOpen(false)
    return handled(e)
  }
  const swallow: KeyHandler = (e) => handled(e)

  return (
    <Show when={exitPromptOpen()}>
      <view width={layout.width} height={layout.height} color={0x000000cc} zIndex={50}>
        <view
          ref={panel}
          x={(layout.width - PANEL_WIDTH) / 2}
          y={(layout.height - PANEL_HEIGHT) / 2}
          width={PANEL_WIDTH}
          height={PANEL_HEIGHT}
          borderRadius={24}
          color={colors.surface}
          onLeft={onLeft}
          onRight={onRight}
          onEnter={onEnter}
          onBack={onBack}
          onUp={swallow}
          onDown={swallow}
        >
          <text x={PANEL_WIDTH / 2} y={70} mountX={0.5} fontFamily="raleway" fontSize={46} color={colors.textPrimary}>
            Exit Velope TV?
          </text>
          <text x={PANEL_WIDTH / 2} y={140} mountX={0.5} fontSize={28} color={colors.textSecondary}>
            You can open it again from Apps.
          </text>
          <ActionButton x={130} y={210} width={230} label="Yes" focused={choice() === 'yes'} pressed={false} />
          <ActionButton x={400} y={210} width={230} label="No" focused={choice() === 'no'} pressed={false} />
        </view>
      </view>
    </Show>
  )
}

export default ExitDialog
