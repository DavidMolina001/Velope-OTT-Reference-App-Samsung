import { createSignal } from 'solid-js'

// Whether the "Exit Reference App?" dialog is up. Opened by the remote's Exit key (anywhere, even
// during playback) or by Back at the root of the app; see ExitDialog.
export const [exitPromptOpen, setExitPromptOpen] = createSignal(false)
