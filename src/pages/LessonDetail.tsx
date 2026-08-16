import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '../lib/api'
import type {
  AnswerAttempt,
  AnswerResult,
  LessonDetail as Lesson,
  LessonSection,
  Question,
} from '../lib/api'
import { setLessonCompleted, useAppDispatch } from '../store'
import Checkpoint from '../components/Checkpoint'
import Coach from '../components/Coach'
import { Button, Card, ErrorBanner, Spinner, categoryStyle } from '../components/ui'

/**
 * A lesson, taken one step at a time.
 *
 * The whole body used to render at once with the checkpoints threaded through
 * it, which made every question open-book: the paragraph that answered it was
 * three inches up the page. So the lesson is now paced. You read a section,
 * and when you move on, that section leaves the screen and the teacher asks
 * about it. What you answer is what you understood.
 *
 * Once the lesson is complete the whole text is available again in one piece —
 * gated while you're learning it, yours to refer back to afterwards.
 */

type Step =
  | { id: string; kind: 'read'; section: LessonSection }
  | { id: string; kind: 'check'; section: LessonSection; question: Question }
  | { id: 'recap'; kind: 'recap' }

export default function LessonDetail() {
  const { slug } = useParams<{ slug: string }>()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  // True while `GET /lessons/:slug/questions` is in flight. On a lesson opened
  // for the first time ever, that request is the one generating the
  // checkpoints — a few seconds, not instant — and without this the reader
  // could read straight past a section before its question exists, with
  // nothing on screen saying one was still being written.
  const [questionsLoading, setQuestionsLoading] = useState(true)
  const [settled, setSettled] = useState<Record<string, AnswerResult>>({})
  // Every checkpoint attempt made this session, in order. Held here rather than
  // saved as it happens — it only becomes a record when Mark complete is pressed.
  const [answers, setAnswers] = useState<AnswerAttempt[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Steps are addressed by id, not index: the questions arrive in a second
  // request, and a reader mid-lesson shouldn't be thrown to a different step
  // when they land.
  const [stepId, setStepId] = useState<string>('')
  const [seen, setSeen] = useState<Set<string>>(new Set())
  // Continue is withheld for a beat on arrival — long enough that it isn't
  // just the next click in a chain, short enough not to be a nag.
  const [settleWait, setSettleWait] = useState(true)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setLesson(null)
    setQuestions([])
    setQuestionsLoading(true)
    setSettled({})
    setAnswers([])
    setError(null)
    setStepId('')
    setSeen(new Set())

    api
      .lesson(slug)
      .then((data) => !cancelled && setLesson(data))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Could not load.'))

    // Separate request on purpose: generating a lesson's checkpoints the first
    // time takes a few seconds, and the reader should be reading by then.
    // A lesson with no checkpoints is a lesson, just without them.
    api
      .questions(slug)
      .then((data) => {
        if (cancelled) return
        setQuestions(data)
        setSettled(
          Object.fromEntries(
            data
              .filter((q) => q.answered?.settled)
              .map((q) => [q.id, q.answered as AnswerResult]),
          ),
        )
      })
      .catch(() => {})
      .finally(() => !cancelled && setQuestionsLoading(false))

    return () => {
      cancelled = true
    }
  }, [slug])

  const steps = useMemo<Step[]>(() => {
    if (!lesson) return []
    // A body the splitter found no headings in is still a lesson — one long
    // step, no checkpoints, exactly as it used to read.
    const sections: LessonSection[] = lesson.sections.length
      ? lesson.sections
      : [{ index: 0, heading: '', markdown: lesson.body }]

    const bySection = new Map(questions.map((q) => [q.section_index, q]))
    const built: Step[] = []
    for (const section of sections) {
      built.push({ id: `read-${section.index}`, kind: 'read', section })
      const question = bySection.get(section.index)
      if (question) built.push({ id: `check-${section.index}`, kind: 'check', section, question })
    }
    built.push({ id: 'recap', kind: 'recap' })
    return built
  }, [lesson, questions])

  const index = Math.max(
    0,
    steps.findIndex((s) => s.id === stepId),
  )
  const step = steps[index]

  useEffect(() => {
    if (!stepId && steps.length) setStepId(steps[0].id)
  }, [stepId, steps])

  useEffect(() => {
    if (step) setSeen((prev) => (prev.has(step.id) ? prev : new Set(prev).add(step.id)))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step?.id])

  useEffect(() => {
    setSettleWait(true)
    const timer = setTimeout(() => setSettleWait(false), 3000)
    return () => clearTimeout(timer)
  }, [step?.id])

  // A checkpoint holds the lesson until it's resolved — that's the point of it.
  // No skipping: the reader answers it, or stays. The same holds for leaving a
  // `read` step while its checkpoint might still be generating: better a wait
  // with something to point at than a question appearing after they've moved
  // on, or never appearing to have existed at all.
  const waitingOnQuestions = step?.kind === 'read' && questionsLoading
  const blocked =
    (step?.kind === 'check' && !settled[step.question.id]) || settleWait || waitingOnQuestions

  const goNext = useCallback(() => {
    if (blocked || index >= steps.length - 1) return
    setStepId(steps[index + 1].id)
  }, [blocked, index, steps])

  const goBack = useCallback(() => {
    if (index <= 0) return
    setStepId(steps[index - 1].id)
  }, [index, steps])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'BUTTON', 'SUMMARY'].includes(target.tagName)) return
      if (event.key === 'ArrowRight') goNext()
      if (event.key === 'ArrowLeft') goBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goBack])

  async function markComplete() {
    if (!lesson) return
    setSaving(true)
    try {
      await dispatch(
        setLessonCompleted({ slug: lesson.slug, completed: true, answers }),
      ).unwrap()
      setLesson({ ...lesson, completed: true })
      navigate('/lessons')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your progress.')
    } finally {
      setSaving(false)
    }
  }

  if (error) return <ErrorBanner message={error} />
  if (!lesson || !step) return <Spinner label="Loading lesson…" />

  const style = categoryStyle(lesson.category)
  const checks = steps.filter((s): s is Extract<Step, { kind: 'check' }> => s.kind === 'check')
  const correctCount = checks.filter((s) => settled[s.question.id]?.correct).length

  return (
    // No `rise` (or any other transform/animation) on this element: a
    // transform anywhere up the tree turns it into the containing block for
    // descendant `fixed` elements, so the bars below would end up pinned to
    // *this div's* edges and drift as its height changes, not the viewport's.
    <div>
      {/* Fixed to the top of the screen, not just the top of the page —
          with the site nav hidden, this is the only way out of a lesson
          short of finishing it, so it stays reachable at any scroll
          position rather than scrolling away with the reading column. */}
      <div className="fixed inset-x-0 top-0 z-10 border-b border-line/60 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-end px-10 py-4 lg:px-16">
          <Link
            to="/lessons"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink"
          >
            <span aria-hidden>✕</span> Exit lesson
          </Link>
        </div>
      </div>

      {/* Fixed to the bottom of the screen, not the end of the content — a
          two-line section and a ten-line one both leave Back and Continue in
          exactly the same place, and the same size as each other whichever
          one you're hovering, rather than the reader having to hunt for them. */}
      {step.kind !== 'recap' && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line/60 bg-cream/95 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-10 py-4 lg:px-16">
            <Button
              variant="quiet"
              onClick={goBack}
              disabled={index === 0}
              className="w-32 shrink-0"
            >
              ← Back
            </Button>
            {settleWait ? (
              <span className="w-32 shrink-0" />
            ) : (
              <Button onClick={goNext} disabled={blocked} className="w-32 shrink-0">
                {waitingOnQuestions ? 'Preparing…' : 'Continue →'}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Everything else — the actual lesson — sits in the middle, between
          the two fixed bars. */}
      <div
        key={step.id}
        className={`rise mx-auto max-w-2xl px-6 pt-24 lg:px-10 ${
          step.kind !== 'recap' ? 'pb-28' : 'pb-16'
        }`}
      >
        <div className="flex items-center gap-3 text-xs">
          <span className={`rounded-full px-2.5 py-1 font-semibold ${style.chip}`}>
            {style.label}
          </span>
          <span className="text-ink-soft">{lesson.estimated_minutes} min</span>
          <span className="text-ink-soft" aria-label={`difficulty ${lesson.difficulty} of 4`}>
            {'●'.repeat(lesson.difficulty)}
            <span className="opacity-25">{'●'.repeat(4 - lesson.difficulty)}</span>
          </span>
        </div>

        <h1 className="mt-3 text-3xl font-bold leading-[1.15] tracking-tight">{lesson.title}</h1>

        {/* The rail: where you are, and how much is left. Steps you've been
            through are reachable again; the ones ahead are not. */}
        <nav className="mt-5 flex items-center gap-1.5" aria-label="Lesson progress">
          {steps.map((s, i) => {
            const visited = seen.has(s.id)
            const current = i === index
            const isCheck = s.kind === 'check'
            return (
              <button
                key={s.id}
                onClick={() => visited && setStepId(s.id)}
                disabled={!visited}
                aria-label={`Step ${i + 1} of ${steps.length}`}
                aria-current={current ? 'step' : undefined}
                className={`h-1.5 rounded-full transition-all ${
                  current ? 'w-8' : isCheck ? 'w-3' : 'w-5'
                } ${
                  current
                    ? 'bg-amber'
                    : visited
                      ? 'cursor-pointer bg-amber/40 hover:bg-amber/70'
                      : 'cursor-default bg-line'
                }`}
              />
            )
          })}
          <span className="ml-2 text-[11px] font-semibold tabular-nums text-ink-soft">
            {index + 1}/{steps.length}
          </span>
        </nav>

        <div className="mt-8">
          {step.kind === 'read' && (
            <>
              {step.section.index === 0 && (
                <p className="mb-6 border-l-2 border-amber pl-4 text-lg leading-relaxed text-ink-soft">
                  {lesson.summary}
                </p>
              )}
              <div className="lesson-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{step.section.markdown}</ReactMarkdown>
              </div>
            </>
          )}

          {step.kind === 'check' && (
            <Checkpoint
              key={step.question.id}
              question={step.question}
              sectionMarkdown={step.section.markdown}
              position={checks.findIndex((c) => c.id === step.id) + 1}
              total={checks.length}
              onAttempt={(chosenIndex) =>
                setAnswers((prev) => [
                  ...prev,
                  { question_id: step.question.id, chosen_index: chosenIndex },
                ])
              }
              onSettled={(result) =>
                setSettled((prev) => ({ ...prev, [step.question.id]: result }))
              }
            />
          )}

          {step.kind === 'recap' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold tracking-tight">That's the lesson</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {checks.length === 0
                    ? 'Take the key points with you.'
                    : `You worked through all ${checks.length} checkpoints, ${correctCount} right first or second time.`}
                </p>
              </div>

              {lesson.key_takeaways.length > 0 && (
                <Card className="border-amber/30 bg-amber-wash p-6">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-deep">
                    Key takeaways
                  </h3>
                  <ul className="mt-4 space-y-3">
                    {lesson.key_takeaways.map((point, i) => (
                      <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                        <span className="mt-px shrink-0 font-bold text-amber-deep">✓</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
                {lesson.completed ? (
                  <span className="text-sm font-semibold text-sage">✓ Completed</span>
                ) : (
                  <Button onClick={markComplete} disabled={saving}>
                    {saving ? 'Saving…' : 'Mark complete'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Outside the step branches on purpose: it keeps a per-step cache of
          what the model said, and remounting it at every checkpoint would
          throw that away and re-ask on the way back. */}
      <Coach
        slug={lesson.slug}
        step={
          step.kind === 'read'
            ? { kind: 'read', sectionIndex: step.section.index }
            : { kind: step.kind }
        }
      />
    </div>
  )
}
