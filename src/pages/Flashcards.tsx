import { useEffect, useState } from 'react'
import { loadFlashcards, useAppDispatch, useAppSelector } from '../store'
import { ErrorBanner, Spinner } from '../components/ui'
import FlashcardDeck from '../components/FlashcardDeck'

/**
 * The review deck, on its own page.
 *
 * Read-only in the strictest sense: this page issues exactly one request, a GET,
 * and nothing a reader does here writes anything at all — no score, no
 * progress, no "seen" state. The deck changes only when a lesson session or a
 * tutor session ends, which is why there's nothing to save on the way out and
 * nothing to warn anyone about on the way in.
 *
 * It reloads on mount rather than trusting what's in the store, because the two
 * things that change it both happen elsewhere.
 *
 * The page is one narrow column, heading and card sharing the same edges. The
 * page container is wide enough for a lesson grid; a card is not, and a
 * full-width heading over a half-width card leaves the card looking adrift.
 *
 * It scrolls normally rather than filling the window like the other sections.
 * The card is a fixed size, so a full-height panel has nothing to give the
 * extra space to — it centres the card and leaves a hole between the heading
 * and the thing the heading is about.
 */
export default function Flashcards() {
  const dispatch = useAppDispatch()
  const { flashcards, error } = useAppSelector((s) => s.app)
  // Tracked here rather than inferred from an empty deck: a reader can
  // legitimately have no cards (nothing published yet), and treating that as
  // "still loading" would spin forever.
  const [loading, setLoading] = useState(flashcards.length === 0)

  useEffect(() => {
    dispatch(loadFlashcards()).finally(() => setLoading(false))
  }, [dispatch])

  return (
    <div className="rise mx-auto flex w-full max-w-2xl flex-col">
      <div className="mb-7 shrink-0">
        <h1 className="text-3xl font-bold tracking-tight">Flashcards</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
          Weighted towards whatever you've found hardest. Nothing here is scored or saved — flip
          through as often as you like.
        </p>
      </div>

      {error && (
        <div className="mb-6 shrink-0">
          <ErrorBanner message={error} onRetry={() => dispatch(loadFlashcards())} />
        </div>
      )}

      {loading ? <Spinner label="Loading your deck…" /> : <FlashcardDeck cards={flashcards} />}
    </div>
  )
}
