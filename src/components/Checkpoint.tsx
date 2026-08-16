import { useState } from 'react'
import { api } from '../lib/api'
import type { AnswerResult, Question } from '../lib/api'

/**
 * A checkpoint between two sections of a lesson.
 *
 * Reading is the point, so this never blocks: the reader can scroll straight
 * past. Answering is a beat in the lesson, not a gate on it.
 *
 * One answer per question, deliberately. The first instinct is the honest
 * signal — letting a reader cycle options until the tick appears would tell us
 * only that they can spot a green highlight.
 */
export default function Checkpoint({
  question,
  position,
  total,
  onAnswered,
}: {
  question: Question
  position: number
  total: number
  onAnswered: (result: AnswerResult) => void
}) {
  const [result, setResult] = useState<AnswerResult | null>(question.answered)
  const [pending, setPending] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function choose(index: number) {
    if (result || pending !== null) return
    setPending(index)
    setError(null)
    try {
      const answered = await api.answer(question.id, index)
      setResult(answered)
      onAnswered(answered)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your answer.')
    } finally {
      setPending(null)
    }
  }

  return (
    <aside
      className={`my-10 rounded-card border px-6 py-5 transition-colors ${
        result
          ? result.correct
            ? 'border-sage/30 bg-sage-wash/50'
            : 'border-amber/40 bg-amber-wash/60'
          : 'border-line bg-cream-deep/60'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">
          Checkpoint {position} of {total}
        </p>
        {result && (
          <span
            className={`text-xs font-bold ${result.correct ? 'text-sage' : 'text-amber-deep'}`}
          >
            {result.correct ? '✓ Correct' : 'Not quite'}
          </span>
        )}
      </div>

      <p className="mt-2.5 text-[15px] font-semibold leading-snug">{question.prompt}</p>

      <ul className="mt-4 space-y-2">
        {question.options.map((option) => {
          const isChosen = result?.chosen_index === option.index
          const isAnswer = result?.correct_index === option.index

          // Once answered, the right option is always marked — a reader who got
          // it wrong needs to see what was right, not just that they missed.
          let tone = 'border-line bg-card hover:border-amber/50 hover:bg-amber-wash/40'
          if (result) {
            if (isAnswer) tone = 'border-sage/50 bg-sage-wash text-ink'
            else if (isChosen) tone = 'border-berry/40 bg-berry-wash text-ink'
            else tone = 'border-line bg-card/50 text-ink-soft'
          }

          return (
            <li key={option.index}>
              <button
                onClick={() => choose(option.index)}
                disabled={!!result || pending !== null}
                className={`flex w-full items-start gap-3 rounded-xl border px-4 py-2.5 text-left text-sm leading-relaxed transition ${tone} ${
                  result ? 'cursor-default' : 'cursor-pointer'
                } ${pending === option.index ? 'opacity-60' : ''}`}
              >
                <span className="mt-px w-4 shrink-0 text-center font-bold">
                  {result ? (isAnswer ? '✓' : isChosen ? '✗' : '') : ''}
                </span>
                <span>{option.text}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {result && (
        <p className="mt-4 border-t border-line pt-3.5 text-sm leading-relaxed text-ink-soft">
          {result.explanation}
        </p>
      )}

      {error && <p className="mt-3 text-sm font-semibold text-berry">{error}</p>}
    </aside>
  )
}
