import { useState } from 'react'
import type {
  OnboardingAnswers,
  OnboardingContentPreference,
  OnboardingExperience,
  OnboardingFocus,
  OnboardingGoal,
  OnboardingLearningStyle,
} from '../lib/api'
import { Button, ErrorDialog } from './ui'

/**
 * The one time a reader is asked about themselves rather than about glucose.
 *
 * Shown once, before anything else, and can't be skipped or backed out of via
 * the site chrome — there is no site chrome yet, this runs before the app
 * does. Answering writes `onboarding_completed_at` on the profile, which is
 * the only thing this component checks to decide it's done its job.
 */

type Field = keyof OnboardingAnswers

interface Step {
  field: Field
  prompt: string
  options: { value: string; label: string }[]
}

const STEPS: Step[] = [
  {
    field: 'goal',
    prompt: 'What brought you here?',
    options: [
      { value: 'newly_diagnosed' satisfies OnboardingGoal, label: 'I was just diagnosed' },
      {
        value: 'managing_long_term' satisfies OnboardingGoal,
        label: "I've had it a while and want to understand it better",
      },
      { value: 'caregiver' satisfies OnboardingGoal, label: 'I care for someone with type 1' },
      { value: 'curious' satisfies OnboardingGoal, label: "I'm studying, or just curious" },
    ],
  },
  {
    field: 'experience',
    prompt: 'How would you describe where you’re starting from?',
    options: [
      { value: 'new' satisfies OnboardingExperience, label: 'New to all of this' },
      { value: 'basics' satisfies OnboardingExperience, label: 'Comfortable with the basics' },
      { value: 'experienced' satisfies OnboardingExperience, label: 'Pretty experienced already' },
    ],
  },
  {
    field: 'learning_style',
    prompt: 'How do you like to learn?',
    options: [
      {
        value: 'quick_bites' satisfies OnboardingLearningStyle,
        label: 'Quick bites, a little most days',
      },
      {
        value: 'deep_dives' satisfies OnboardingLearningStyle,
        label: 'Longer sessions when I have time',
      },
      { value: 'mixed' satisfies OnboardingLearningStyle, label: 'Whatever fits that day' },
    ],
  },
  {
    field: 'content_preference',
    prompt: 'When something new is explained, what do you want first?',
    options: [
      {
        value: 'why_first' satisfies OnboardingContentPreference,
        label: 'Why it happens, then the details',
      },
      {
        value: 'examples_first' satisfies OnboardingContentPreference,
        label: 'A concrete example, then the why',
      },
    ],
  },
  {
    field: 'focus',
    prompt: 'Anything you especially want to understand?',
    options: [
      { value: 'carb_counting' satisfies OnboardingFocus, label: 'Carb counting' },
      { value: 'insulin_action' satisfies OnboardingFocus, label: 'How insulin actually works' },
      { value: 'exercise' satisfies OnboardingFocus, label: 'Exercise and glucose' },
      { value: 'highs_lows' satisfies OnboardingFocus, label: 'Highs, lows, and sick days' },
      { value: 'not_sure' satisfies OnboardingFocus, label: 'Not sure yet' },
    ],
  },
]

export default function Onboarding({
  name,
  submitting,
  error,
  onSubmit,
  onDismissError,
}: {
  /** First name (or email handle) for the greeting — falls back to a plain "you" if blank. */
  name: string
  submitting: boolean
  error: string | null
  onSubmit: (answers: OnboardingAnswers) => void
  /** Clears the error so the popup can be dismissed without resubmitting. */
  onDismissError: () => void
}) {
  // -1 is the welcome screen; 0..STEPS.length-1 are the questions.
  const [index, setIndex] = useState(-1)
  const [answers, setAnswers] = useState<Partial<OnboardingAnswers>>({})

  const welcome = index === -1
  const step = welcome ? null : STEPS[index]
  const chosen = step ? answers[step.field] : undefined
  const last = index === STEPS.length - 1

  function choose(value: string) {
    if (!step) return
    setAnswers((prev) => ({ ...prev, [step.field]: value }))
  }

  function next() {
    if (welcome) {
      setIndex(0)
      return
    }
    if (!chosen) return
    if (last) onSubmit(answers as OnboardingAnswers)
    else setIndex((i) => i + 1)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-6 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-card border border-line bg-card p-8 shadow-xl">
        {welcome ? (
          <>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber text-lg font-bold text-white">
              L
            </span>
            <h1 className="mt-5 text-2xl font-bold leading-snug tracking-tight">
              Welcome{name ? `, ${name}` : ''} 👋
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Glad you're here. Before your first lesson, five quick questions — why you're
              learning this, and how you like to learn — so the lessons ahead fit you rather than
              a generic reader. Takes about a minute.
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              {STEPS.map((s, i) => (
                <span
                  key={s.field}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i < index ? 'bg-amber/60' : i === index ? 'bg-amber' : 'bg-line'
                  }`}
                />
              ))}
            </div>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">
              Before you start · {index + 1} of {STEPS.length}
            </p>

            <h1 className="mt-2 text-xl font-bold leading-snug tracking-tight">{step!.prompt}</h1>
            <p className="mt-1 text-sm text-ink-soft">
              Helps us shape how lessons show up for you — nothing here changes what the app
              teaches.
            </p>
          </>
        )}

        {step && (
          <ul className="mt-6 space-y-2">
            {step.options.map((option) => {
              const active = chosen === option.value
              return (
                <li key={option.value}>
                  <button
                    onClick={() => choose(option.value)}
                    className={`w-full cursor-pointer rounded-xl border px-4 py-3 text-left text-sm font-medium leading-relaxed transition ${
                      active
                        ? 'border-amber/70 bg-amber-wash text-ink'
                        : 'border-line bg-card hover:border-amber/40 hover:bg-amber-wash/40'
                    }`}
                  >
                    {option.label}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <div className={`mt-7 flex items-center gap-4 ${welcome ? 'justify-end' : 'justify-between'}`}>
          {!welcome && (
            <Button
              variant="quiet"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0 || submitting}
              className="w-24"
            >
              ← Back
            </Button>
          )}
          <Button onClick={next} disabled={!welcome && !chosen} className="min-w-32 whitespace-nowrap">
            {welcome ? "Let's go →" : submitting ? 'Saving…' : last ? 'Start learning' : 'Continue →'}
          </Button>
        </div>
      </div>

      {error && (
        <ErrorDialog
          message={error}
          retrying={submitting}
          onRetry={() => onSubmit(answers as OnboardingAnswers)}
          onBack={onDismissError}
          backLabel="Edit answers"
        />
      )}
    </div>
  )
}
