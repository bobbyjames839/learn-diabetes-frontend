import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'

/**
 * The tip that pops up alongside the section a reader is on.
 *
 * One short, useful thing about the idea on screen — written by the model, and
 * deliberately not a piece of feedback. It never mentions how the reader has
 * been doing, and it knows nothing about the session in progress — it is shaped
 * only by what this reader answered in earlier sessions, which the server reads
 * off their record. See `app/coach.py`.
 *
 * It behaves like a notification rather than a panel: it slides in over the
 * page and stays until the reader dismisses it or moves to the next step.
 * Nothing about the lesson depends on it, so it never occupies layout — a tip
 * that pushed the text around as it arrived would be worse than no tip.
 *
 * Three things keep it from being noise:
 *
 * Silence is normal. The model returns null when a screen has nothing worth
 * adding, so plenty of screens get nothing.
 *
 * It says nothing during a checkpoint. Sending the section text and asking for
 * a helpful tip while the reader answers a question about that very section is
 * a good way to hand them the answer, which is the one thing the paced reader
 * exists to prevent.
 *
 * Each screen is asked once. Replies are cached per step, so walking back
 * through the lesson replays the tip rather than paying for it again.
 */

export type StepRef =
  | { kind: 'read'; sectionIndex: number }
  | { kind: 'check' }
  | { kind: 'recap' }

const LEAVE_MS = 300

export default function Coach({ slug, step }: { slug: string; step: StepRef }) {
  const [message, setMessage] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)

  const cache = useRef<Map<string, string | null>>(new Map())

  const kind = step.kind
  const sectionIndex = step.kind === 'read' ? step.sectionIndex : -1
  const stepKey = `${kind}:${sectionIndex}`

  const dismiss = useCallback(() => {
    setLeaving(true)
    // Let the exit animation finish before the node goes.
    setTimeout(() => {
      setMessage(null)
      setLeaving(false)
    }, LEAVE_MS)
  }, [])

  useEffect(() => {
    // Nothing during a checkpoint, and the recap has no section to talk about.
    if (kind !== 'read') {
      setMessage(null)
      setLeaving(false)
      return
    }

    let cancelled = false
    setLeaving(false)

    const show = (text: string | null) => {
      // A reader who has already moved on shouldn't get a tip about the screen
      // behind them.
      if (cancelled) return
      setMessage(text)
    }

    if (cache.current.has(stepKey)) {
      show(cache.current.get(stepKey) ?? null)
    } else {
      setMessage(null)
      // What it has already said this lesson, so it doesn't say it again. The
      // cache only holds screens already fetched, so this is exactly the tips
      // behind the reader.
      const alreadyShown = [...cache.current.values()].filter(
        (t): t is string => t !== null,
      )
      api
        .coach(slug, sectionIndex, alreadyShown)
        .then(({ message: text }) => {
          cache.current.set(stepKey, text)
          show(text)
        })
        .catch(() => {
          cache.current.set(stepKey, null)
        })
    }

    return () => {
      cancelled = true
    }
  }, [slug, stepKey, kind, sectionIndex])

  if (kind !== 'read' || !message) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed right-6 top-20 z-30 w-[min(21rem,calc(100vw-3rem))] ${
        leaving ? 'coach-toast-leaving' : 'coach-toast'
      }`}
    >
      <div className="flex gap-3 rounded-card border border-amber/40 bg-card px-4 py-3.5 shadow-[0_10px_30px_rgba(43,33,24,0.13)]">
        <svg viewBox="0 0 40 40" className="mt-0.5 h-5 w-5 shrink-0" aria-hidden>
          <circle cx="20" cy="20" r="18" className="fill-amber/20 stroke-amber/60" strokeWidth="2" />
          <circle cx="14.5" cy="17.5" r="2.4" className="fill-amber-deep" />
          <circle cx="25.5" cy="17.5" r="2.4" className="fill-amber-deep" />
          <path
            d="M13.5 25.5c1.8 2.2 4 3.3 6.5 3.3s4.7-1.1 6.5-3.3"
            className="stroke-amber-deep"
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
          />
        </svg>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-deep">Tip</p>
          <p className="mt-1 text-sm leading-relaxed text-ink">{message}</p>
        </div>

        <button
          onClick={dismiss}
          aria-label="Dismiss tip"
          className="-mr-1 -mt-1 h-6 w-6 shrink-0 cursor-pointer rounded-full text-sm text-ink-soft/50 transition hover:bg-line/40 hover:text-ink"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
