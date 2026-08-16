import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '../lib/api'
import type { AnswerResult, LessonDetail as Lesson, Question } from '../lib/api'
import { setLessonCompleted, useAppDispatch } from '../store'
import Checkpoint from '../components/Checkpoint'
import { Button, Card, ErrorBanner, SafetyNotice, Spinner, categoryStyle } from '../components/ui'

export default function LessonDetail() {
  const { slug } = useParams<{ slug: string }>()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, AnswerResult>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setLesson(null)
    setQuestions([])
    setAnswers({})
    setError(null)
    window.scrollTo(0, 0)

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
        setAnswers(
          Object.fromEntries(
            data.filter((q) => q.answered).map((q) => [q.id, q.answered as AnswerResult]),
          ),
        )
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [slug])

  // One checkpoint per section at most, keyed for lookup while rendering.
  const bySection = useMemo(() => {
    const map = new Map<number, Question>()
    for (const question of questions) map.set(question.section_index, question)
    return map
  }, [questions])

  const answeredCount = Object.keys(answers).length
  const correctCount = Object.values(answers).filter((a) => a.correct).length

  async function toggleComplete() {
    if (!lesson) return
    setSaving(true)
    try {
      const next = !lesson.completed
      await dispatch(setLessonCompleted({ slug: lesson.slug, completed: next })).unwrap()
      setLesson({ ...lesson, completed: next })
      if (next) navigate('/lessons')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your progress.')
    } finally {
      setSaving(false)
    }
  }

  if (error) return <ErrorBanner message={error} />
  if (!lesson) return <Spinner label="Loading lesson…" />

  const style = categoryStyle(lesson.category)

  return (
    <div className="rise">
      <Link
        to="/lessons"
        className="mb-8 inline-block text-sm font-semibold text-ink-soft hover:text-ink"
      >
        ← All lessons
      </Link>

      <div className="flex gap-12">
        {/* Article column, held to a comfortable measure */}
        <article className="min-w-0 max-w-2xl flex-1">
          <div className="flex items-center gap-3 text-xs">
            <span className={`rounded-full px-2.5 py-1 font-semibold ${style.chip}`}>
              {style.label}
            </span>
            <span className="text-ink-soft">{lesson.estimated_minutes} min read</span>
            <span className="text-ink-soft" aria-label={`difficulty ${lesson.difficulty} of 4`}>
              {'●'.repeat(lesson.difficulty)}
              <span className="opacity-25">{'●'.repeat(4 - lesson.difficulty)}</span>
            </span>
          </div>

          <h1 className="mt-4 text-4xl font-bold leading-[1.15] tracking-tight">{lesson.title}</h1>
          <p className="mt-4 border-l-2 border-amber pl-4 text-lg leading-relaxed text-ink-soft">
            {lesson.summary}
          </p>

          {/* Section, then its checkpoint, then the next section. Falls back to
              the whole body if the split produced nothing to work with. */}
          <div className="mt-10">
            {lesson.sections.length === 0 ? (
              <div className="lesson-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{lesson.body}</ReactMarkdown>
              </div>
            ) : (
              lesson.sections.map((section) => {
                const question = bySection.get(section.index)
                return (
                  <div key={section.index}>
                    <div className="lesson-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.markdown}</ReactMarkdown>
                    </div>
                    {question && (
                      <Checkpoint
                        question={question}
                        position={questions.indexOf(question) + 1}
                        total={questions.length}
                        onAnswered={(result) =>
                          setAnswers((prev) => ({ ...prev, [question.id]: result }))
                        }
                      />
                    )}
                  </div>
                )
              })
            )}
          </div>

          {questions.length > 0 && (
            <div className="mt-10 rounded-card border border-line bg-cream-deep/50 px-6 py-4">
              <p className="text-sm font-semibold">
                {answeredCount === 0
                  ? `${questions.length} checkpoints in this lesson`
                  : `You answered ${answeredCount} of ${questions.length} checkpoints — ${correctCount} correct`}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                {answeredCount < questions.length
                  ? 'Checkpoints are optional. Scroll back to any you skipped.'
                  : 'Nice work. What you answered shapes the practice that comes next.'}
              </p>
            </div>
          )}

          <div className="mt-10 flex items-center gap-4 border-t border-line pt-6">
            <Button
              onClick={toggleComplete}
              disabled={saving}
              variant={lesson.completed ? 'ghost' : 'primary'}
            >
              {saving ? 'Saving…' : lesson.completed ? 'Mark as not done' : 'Mark complete'}
            </Button>
            {lesson.completed && (
              <span className="text-sm font-semibold text-sage">✓ Completed</span>
            )}
          </div>

          <div className="mt-10">
            <SafetyNotice />
          </div>
        </article>

        {/* Sticky takeaways */}
        {lesson.key_takeaways.length > 0 && (
          <aside className="hidden w-72 shrink-0 lg:block">
            <Card className="sticky top-24 border-amber/30 bg-amber-wash p-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-amber-deep">
                Key takeaways
              </h2>
              <ul className="mt-4 space-y-3">
                {lesson.key_takeaways.map((point, i) => (
                  <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                    <span className="mt-px shrink-0 font-bold text-amber-deep">✓</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </aside>
        )}
      </div>

      {/* Takeaways inline on narrow screens */}
      {lesson.key_takeaways.length > 0 && (
        <Card className="mt-8 border-amber/30 bg-amber-wash p-5 lg:hidden">
          <h2 className="text-xs font-bold uppercase tracking-wider text-amber-deep">
            Key takeaways
          </h2>
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
    </div>
  )
}
