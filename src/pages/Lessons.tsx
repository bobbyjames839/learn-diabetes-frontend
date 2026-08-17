import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loadLessons, useAppDispatch, useAppSelector } from '../store'
import { Bar, Card, EmptyState, ErrorDialog, Spinner, categoryStyle } from '../components/ui'
import { useSmoothWheelScroll } from '../hooks/useSmoothWheelScroll'

/**
 * The lesson list, and nothing else. The other two sections — the review deck
 * and the tutor — are pages of their own, reached from the site nav; the column
 * here only ever filters what's on this page.
 */

export default function Lessons() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { lessons, loading, error } = useAppSelector((s) => s.app)
  const [filter, setFilter] = useState('all')
  const gridScrollRef = useSmoothWheelScroll<HTMLUListElement>()

  useEffect(() => {
    dispatch(loadLessons())
  }, [dispatch])

  const categories = useMemo(() => Array.from(new Set(lessons.map((l) => l.category))), [lessons])
  const visible = filter === 'all' ? lessons : lessons.filter((l) => l.category === filter)
  const done = lessons.filter((l) => l.completed).length

  if (loading && lessons.length === 0) return <Spinner label="Loading lessons…" />

  return (
    <div className="flex flex-col rise lg:h-full lg:min-h-0">
      <div className="mb-8 flex shrink-0 flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lessons</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Work through the mechanisms behind how glucose behaves.
          </p>
        </div>
        {lessons.length > 0 && (
          <div className="w-56">
            <div className="mb-1.5 flex justify-between text-xs font-semibold">
              <span className="text-ink-soft">Progress</span>
              <span className="tabular-nums">
                {done}/{lessons.length}
              </span>
            </div>
            <Bar value={(done / lessons.length) * 100} />
          </div>
        )}
      </div>

      {error && (
        <ErrorDialog
          message={error}
          onRetry={() => dispatch(loadLessons())}
          onBack={() => navigate('/')}
          backLabel="Back to overview"
        />
      )}

      {lessons.length === 0 && !loading ? (
        <EmptyState title="No lessons published yet">
          Generate lesson content with the prompt in <code>docs/AUTHORING_LESSONS.md</code>, run it
          through <code>app.lessons_to_sql</code>, then apply the SQL in Supabase.
        </EmptyState>
      ) : (
        <div className="flex gap-10 lg:min-h-0 lg:flex-1">
          {/* Sidebar — stays put; only the panel beside it scrolls. */}
          <aside className="hidden w-44 shrink-0 lg:block">
            <p className="mb-3 pl-3 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-soft/70">
              Categories
            </p>
            <ul className="space-y-px">
              {[
                { key: 'all', label: 'All lessons' },
                ...categories.map((c) => ({
                  key: c,
                  label: categoryStyle(c).label,
                })),
              ].map((item) => {
                const count =
                  item.key === 'all'
                    ? lessons.length
                    : lessons.filter((l) => l.category === item.key).length
                return (
                  <li key={item.key}>
                    {/* Selection reads as a weight + accent-rule change rather than
                        a filled pill, so the column sits in the page, not on it. */}
                    <button
                      onClick={() => setFilter(item.key)}
                      className={`flex w-full cursor-pointer items-center justify-between border-l-2 py-1.5 pl-3 pr-1 text-sm transition ${
                        filter === item.key
                          ? 'border-amber font-semibold text-ink'
                          : 'border-transparent font-medium text-ink-soft hover:border-line hover:text-ink'
                      }`}
                    >
                      {item.label}
                      <span className="text-xs tabular-nums text-ink-soft/60">{count}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col lg:min-h-0">
            {/* Mobile filter */}
            <div className="mb-5 flex shrink-0 gap-2 overflow-x-auto lg:hidden">
              {['all', ...categories].map((c) => (
                <button
                  key={c}
                  onClick={() => setFilter(c)}
                  className={`shrink-0 cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    filter === c ? 'bg-ink text-cream' : 'border border-line bg-card text-ink-soft'
                  }`}
                >
                  {c === 'all' ? 'All' : categoryStyle(c).label}
                </button>
              ))}
            </div>

            {/* A scrolling region: the padding gives the hover lift and its
                shadow room inside the overflow box — without pt the top edge of
                a lifted card gets clipped, and the negative top margin cancels
                the visual offset it would add. auto-rows-min + content-start
                stop a short list from stretching its rows to fill the available
                height. */}
            <ul
              ref={gridScrollRef}
              className="grid auto-rows-min content-start gap-4 sm:grid-cols-2 scroll-soft lg:-mt-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-1 lg:pb-3 lg:pt-2"
            >
              {visible.map((lesson) => {
                const style = categoryStyle(lesson.category)
                return (
                  <li key={lesson.slug}>
                    <Link to={`/lessons/${lesson.slug}`} className="group block h-full">
                      <Card
                        className={`relative flex h-full flex-col overflow-hidden p-5 transition group-hover:-translate-y-0.5 group-hover:shadow-[0_6px_20px_rgba(43,33,24,0.07)] ${
                          lesson.completed
                            ? 'border-sage/40 bg-sage-wash/40 group-hover:border-sage/60'
                            : 'group-hover:border-amber/50'
                        }`}
                      >
                        {lesson.completed && (
                          <span className="absolute inset-x-0 top-0 h-1 bg-sage/50" aria-hidden />
                        )}

                        <div className="mb-3 flex items-center justify-between gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${style.chip}`}
                          >
                            {style.label}
                          </span>
                          {lesson.completed && (
                            <span className="flex items-center gap-1 rounded-full bg-sage/15 px-2.5 py-1 text-[11px] font-bold text-sage">
                              ✓ Done
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-bold leading-snug">{lesson.title}</h3>
                        <p
                          className={`mt-2 line-clamp-3 flex-1 text-sm leading-relaxed ${
                            lesson.completed ? 'text-ink-soft/70' : 'text-ink-soft'
                          }`}
                        >
                          {lesson.summary}
                        </p>

                        <div className="mt-4 flex items-center gap-3 border-t border-line pt-3 text-xs text-ink-soft">
                          <span>{lesson.estimated_minutes} min</span>
                          <span aria-label={`difficulty ${lesson.difficulty} of 4`}>
                            {'●'.repeat(lesson.difficulty)}
                            <span className="opacity-25">{'●'.repeat(4 - lesson.difficulty)}</span>
                          </span>
                          <span
                            className={`ml-auto font-semibold opacity-0 transition group-hover:opacity-100 ${
                              lesson.completed ? 'text-sage' : 'text-amber-deep'
                            }`}
                          >
                            {lesson.completed ? 'Review →' : 'Read →'}
                          </span>
                        </div>
                      </Card>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
