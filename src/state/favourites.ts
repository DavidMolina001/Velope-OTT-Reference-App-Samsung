// The favourites list: added with the hero's + button or the details page's button, shown by the
// menu's Favourites entry. Kept in localStorage so it survives closing the app; the stored copy
// is the movie data itself, so the Favourites row needs no network call.
import { createSignal } from 'solid-js'
import type { Movie } from '../services/tmdb'

const STORAGE_KEY = 'velope.favourites'

function load(): Movie[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const list = raw ? (JSON.parse(raw) as Movie[]) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

const [favourites, setFavourites] = createSignal<Movie[]>(load())

export { favourites }

export function isFavourite(id: number): boolean {
  return favourites().some((movie) => movie.id === id)
}

/** Adds or removes a title (newest first). Returns whether it is now a favourite. */
export function toggleFavourite(movie: Movie): boolean {
  const adding = !isFavourite(movie.id)
  const { id, title, year, overview, posterPath, backdropPath, rating } = movie
  const next = adding ? [{ id, title, year, overview, posterPath, backdropPath, rating }, ...favourites()] : favourites().filter((m) => m.id !== movie.id)
  setFavourites(next)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Storage unavailable: the list still works for this session.
  }
  if (import.meta.env.VITE_LOG_URL) console.log(`FAVOURITES ${adding ? 'added' : 'removed'} ${title} (${next.length})`)
  return adding
}
