import { useCallback, useEffect, useState } from 'react'
import type { Flashcard } from '../lib/api'
import { useSmoothWheelScroll } from '../hooks/useSmoothWheelScroll'
import { categoryStyle } from './ui'

/**
 * One card at a time from a 20-card deck that tracks weak spots.
 *
 * The server does the ranking — cards from chat sessions first, then
 * checkpoints this reader has gotten wrong, then key takeaways filling
 * whatever's left — so this only renders whichever `front`/`back` it's handed.
 *
 * Reviewing writes nothing at all: no score, no progress, no "seen" state. The
 * deck changes only when a lesson session or a chat session ends, which is why
 * there's nothing here to save and nothing to cache.
 *
 * The card is a fixed height rather than one that fits its text. A question is
 * a line long and its explanation is a paragraph, so a self-sizing card jumps
 * every time it's flipped and again at every card — the deck visibly twitching
 * under a reader who is only pressing one button. Fixed height, and the rare
 * card whose back overruns scrolls inside its own face.
 */

// Tall enough for the longest back the deck can hold — a 500-character chat
// card runs to about six lines here — without leaving a short question
// stranded in the middle of an empty rectangle.
const CARD_HEIGHT = 'h-[18rem]'

function faceLabel(card: Flashcard, flipped: boolean) {
  if (!flipped) return 'Question'
  return card.kind === 'takeaway' ? 'Takeaway' : 'Explanation'
}

export default function FlashcardDeck({ cards }: { cards: Flashcard[] }) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const faceScrollRef = useSmoothWheelScroll<HTMLDivElement>()

  // A newly finished lesson can reshuffle the ranking entirely — follow the
  // reshuffled deck from the top rather than leaving the reader on a card
  // that may no longer be at that index.
  useEffect(() => {
    setIndex(0)
    setFlipped(false)
  }, [cards])

  const go = useCallback(
    (delta: number) => {
      setFlipped(false)
      setIndex((i) => (i + delta + cards.length) % cards.length)
    },
    [cards.length],
  )

  // Arrow keys move, space flips — the same arrow-key convention the lesson
  // reader uses. Space is left to the browser when the card itself has focus,
  // since a focused button already flips on space and handling it here too
  // would flip it straight back.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return
      if (event.key === 'ArrowRight') go(1)
      if (event.key === 'ArrowLeft') go(-1)
      if (event.key === ' ' && target?.tagName !== 'BUTTON') {
        event.preventDefault()
        setFlipped((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  if (cards.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="max-w-sm text-center text-sm leading-relaxed text-ink-soft">
          Finish a lesson or a tutor session and cards to review show up here — more on anything you
          find hard.
        </p>
      </div>
    )
  }

  const card = cards[index]
  const weakSpot = card.kind === 'weak_spot'
  const fromChat = card.kind === 'chat_gap'
  // A chat card belongs to no lesson, so it carries the conversation's topic
  // where the others carry a category.
  const style = fromChat
    ? { label: 'From your tutor', chip: 'bg-sage-wash text-sage' }
    : categoryStyle(card.category)

  // The turned card is amber-washed, and the amber-washed categories (food,
  // daily life) have a chip the same colour — on the back, their chip simply
  // vanished into the card. Keep the category's ink, drop its fill for one the
  // back can't match. Filtering the class string rather than adding a second
  // palette keeps the two definitions from drifting apart.
  const chipClass = flipped
    ? `bg-card ${style.chip
        .split(' ')
        .filter((c) => c.startsWith('text-'))
        .join(' ')}`
    : style.chip

  return (
    <div className="flex w-full flex-col">
      {/* The whole face is the control: one click flips it, which is the only
          interaction a card has. */}
      <button
        onClick={() => setFlipped((v) => !v)}
        aria-label={`${faceLabel(card, flipped)}. Click to turn the card over.`}
        className={`flex ${CARD_HEIGHT} w-full cursor-pointer flex-col rounded-card border px-8 py-7 text-left shadow-[0_1px_3px_rgba(43,33,24,0.04)] transition-colors ${
          flipped ? 'border-amber/50 bg-amber-wash' : 'border-line bg-card hover:border-amber/40'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${chipClass}`}>
              {style.label}
            </span>
            {/* Outlined rather than filled: the category chip beside it is
                already a filled pill, and in a berry category the two were the
                same shape in the same colour, reading as one odd double label. */}
            {weakSpot && (
              <span className="flex items-center gap-1.5 rounded-full border border-berry/35 px-2.5 py-1 text-[11px] font-semibold text-berry">
                <span className="h-1.5 w-1.5 rounded-full bg-berry" aria-hidden />
                Weak spot
              </span>
            )}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft/70">
            {faceLabel(card, flipped)}
          </span>
        </div>

        {/* Keyed on the face so each turn fades in rather than swapping — the
            card is a fixed size, so without it nothing moves and the change is
            easy to miss. */}
        <div
          key={`${index}-${flipped}`}
          ref={faceScrollRef}
          className="rise scroll-soft flex flex-1 items-center overflow-y-auto py-5"
        >
          {/* A question is short and wants to read large; an explanation is a
              paragraph and wants to read comfortably. */}
          <p
            className={flipped ? 'text-[15px] leading-relaxed' : 'text-xl font-medium leading-snug'}
          >
            {flipped ? card.back : card.front}
          </p>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 text-xs text-ink-soft/70">
          <span className="truncate first-letter:uppercase">{card.lesson_title}</span>
          {!flipped && <span className="shrink-0 font-semibold">Click to reveal</span>}
        </div>
      </button>

      {/* Position, shown once: a bar for where you are in the deck and the
          count beside the controls that move it. */}
      <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-cream-deep">
        <div
          className="h-full rounded-full bg-amber/70 transition-all duration-300"
          style={{ width: `${((index + 1) / cards.length) * 100}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={() => go(-1)}
          disabled={cards.length < 2}
          className="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-soft transition hover:bg-cream-deep hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Prev
        </button>
        <span className="text-xs font-semibold tabular-nums text-ink-soft/70">
          {index + 1} of {cards.length}
        </span>
        <button
          onClick={() => go(1)}
          disabled={cards.length < 2}
          className="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-soft transition hover:bg-cream-deep hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
