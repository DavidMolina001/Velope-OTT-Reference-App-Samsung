// The title the details page shows, handed over by Home before it navigates. A module-level
// signal rather than router state: the details page is disposable and nothing else reads it.
import { createSignal } from 'solid-js'
import type { RowItem } from '../services/rows'

const [selectedMovie, setSelectedMovie] = createSignal<RowItem | undefined>(undefined)

export { selectedMovie, setSelectedMovie }
