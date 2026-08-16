import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '../lib/api'
import type { AnswerResult, Question } from '../lib/api'
import { Button } from './ui'

/**
 * The teacher stopping to ask.
 *
 * The reader answers with the section off the screen, so this is a test of
 * what they understood rather than of what they can find. Getting it wrong is
 * part of the exchange, not the end of it: the first wrong answer is met with
 * coaching aimed at that exact misconception, the text is offered back to them,
 * and they choose again from what's left.
 *
 * The answer is never revealed while an attempt remains — the server withholds
 * it, so there is nothing in the payload to read ahead to either.
 */
export default function Checkpoint({
  question,
  sectionMarkdown,
  position,
  total,
  onAttempt,
  onSettled,
}: {
  question: Question
  sectionMarkdown: string
  position: number
  total: number
  /** Fires on every judged attempt, settled or not — the record kept until completion. */
  onAttempt: (chosenIndex: number) => void
  onSettled: (result: AnswerResult) => void
}) {
  const [result, setResult] = useState<AnswerResult | null>(question.answered)
  const [tried, setTried] = useState<number[]>(question.tried_indices)
  const [retrying, setRetrying] = useState(false)
  const [pending, setPending] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const settled = !!result?.settled
  // A wrong answer that still has a retry behind it: coaching first, then the
  // reader picks again.
  const coaching = result && !result.correct && !settled ? result.coaching : null
  const choosable = settled || pending !== null ? false : !coaching || retrying

  async function choose(index: number) {
    if (!choosable || tried.includes(index)) return
    setPending(index)
    setError(null)
    try {
      const answered = await api.answer(question.id, index, tried)
      setResult(answered)
      setRetrying(false)
      onAttempt(index)
      if (!answered.correct) setTried((prev) => [...prev, index])
      if (answered.settled) onSettled(answered)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your answer.')
    } finally {
      setPending(null)
    }
  }

  const tone = !result
    ? 'border-line bg-card'
    : settled
      ? result.correct
        ? 'border-sage/40 bg-sage-wash/40'
        : 'border-berry/30 bg-berry-wash/30'
      : 'border-amber/50 bg-amber-wash/50'

  return (
    <section className={`rounded-card border px-7 py-6 transition-colors ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">
          Checkpoint {position} of {total}
        </p>
        {settled && (
          <span className={`text-xs font-bold ${result!.correct ? 'text-sage' : 'text-berry'}`}>
            {result!.correct ? (result!.attempt > 1 ? '✓ Got there' : '✓ Correct') : 'Not this time'}
          </span>
        )}
        {coaching && <span className="text-xs font-bold text-amber-deep">One more go</span>}
      </div>

      <p className="mt-3 whitespace-pre-line text-base font-semibold leading-relaxed">
        {question.prompt}
      </p>

      <ul className="mt-5 space-y-2">
        {question.options.map((option) => {
          const isTried = tried.includes(option.index)
          const isAnswer = settled && result!.correct_index === option.index

          let style = 'border-line bg-card hover:border-amber/60 hover:bg-amber-wash/40'
          if (isAnswer) style = 'border-sage/60 bg-sage-wash'
          else if (isTried) style = 'border-berry/30 bg-berry-wash/40 text-ink-soft line-through'
          else if (settled) style = 'border-line bg-card/40 text-ink-soft'
          else if (!choosable) style = 'border-line bg-card/60 text-ink-soft'

          return (
            <li key={option.index}>
              <button
                onClick={() => choose(option.index)}
                disabled={!choosable || isTried}
                className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm leading-relaxed transition ${style} ${
                  choosable && !isTried ? 'cursor-pointer' : 'cursor-default'
                } ${pending === option.index ? 'opacity-60' : ''}`}
              >
                <span className="mt-px w-4 shrink-0 text-center font-bold">
                  {isAnswer ? '✓' : isTried ? '✗' : ''}
                </span>
                <span>{option.text}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {/* The coaching answers the wrong model they showed, without pointing at
          the right option — they still have to work the second attempt out. */}
      {coaching && (
        <div className="mt-5 border-t border-amber/30 pt-4">
          <p className="text-sm font-semibold leading-relaxed">{coaching}</p>

          <details className="group mt-3">
            <summary className="cursor-pointer list-none text-xs font-semibold text-ink-soft hover:text-ink">
              <span className="group-open:hidden">↓ Read that part again</span>
              <span className="hidden group-open:inline">↑ Hide it</span>
            </summary>
            <div className="lesson-body mt-3 rounded-xl border border-line bg-card/70 px-5 py-4 text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{sectionMarkdown}</ReactMarkdown>
            </div>
          </details>

          {!retrying && (
            <Button className="mt-4" size="sm" onClick={() => setRetrying(true)}>
              Try again
            </Button>
          )}
          {retrying && (
            <p className="mt-4 text-xs font-semibold text-amber-deep">
              Pick again — the one you tried is out.
            </p>
          )}
        </div>
      )}

      {settled && result!.explanation && (
        <p className="mt-5 border-t border-line pt-4 text-sm leading-relaxed text-ink-soft">
          {result!.explanation}
        </p>
      )}

      {error && <p className="mt-3 text-sm font-semibold text-berry">{error}</p>}
    </section>
  )
}
