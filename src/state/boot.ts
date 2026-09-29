import { createSignal } from 'solid-js'
import type { Splash } from '../splash'

// The splash shown at boot (index.tsx); Home tells it when the first rows are on screen.
export let splash: Splash | undefined
export function setSplash(value: Splash): void {
  splash = value
}

/** True once the boot splash has faded out (the hero waits for it before playing sound). */
export const [splashHidden, setSplashHidden] = createSignal(false)
