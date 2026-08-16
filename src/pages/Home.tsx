import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadDashboard, updateProfile, useAppDispatch, useAppSelector } from '../store'
import {
  Bar,
  Button,
  Card,
  ErrorBanner,
  ProgressRing,
  SafetyNotice,
  Spinner,
  StatCard,
  categoryStyle,
} from '../components/ui'

function greeting(date = new Date()) {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function Home() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { profile, stats, loading, error } = useAppSelector((s) => s.app)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')

  useEffect(() => {
    dispatch(loadDashboard())
  }, [dispatch])

  if (loading && !stats) return <Spinner label="Loading your dashboard…" />
  if (error) return <ErrorBanner message={error} onRetry={() => dispatch(loadDashboard())} />
  if (!stats || !profile) return null

  const first = (profile.display_name || profile.email?.split('@')[0] || 'there').split(' ')[0]

  async function saveName() {
    await dispatch(updateProfile({ display_name: name.trim() || null }))
    setEditing(false)
  }

  return (
    <div className="flex h-full flex-col gap-6 rise">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-soft">{greeting()},</p>
          {editing ? (
            <div className="mt-1 flex gap-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveName()}
                placeholder="Your name"
                className="rounded-lg border border-line bg-card px-3 py-1.5 text-lg outline-none focus:border-amber"
              />
              <Button onClick={saveName}>Save</Button>
              <Button variant="quiet" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <h1 className="text-3xl font-bold tracking-tight">
              {first}
              <button
                onClick={() => {
                  setName(profile.display_name ?? '')
                  setEditing(true)
                }}
                className="ml-3 align-middle text-xs font-semibold text-ink-soft underline underline-offset-4 hover:text-ink"
              >
                edit
              </button>
            </h1>
          )}
        </div>

        {stats.last_activity_at && (
          <p className="text-sm text-ink-soft">
            Last active{' '}
            {new Date(stats.last_activity_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </p>
        )}
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          value={stats.lessons_completed}
          label="Lessons done"
          hint={`of ${stats.lessons_total}`}
          accent="amber"
        />
        <StatCard
          value={`${stats.minutes_learned}`}
          label="Minutes learned"
          hint="across completed lessons"
          accent="sage"
        />
        <StatCard
          value={stats.streak_days}
          label="Day streak"
          hint={stats.streak_days > 0 ? 'keep it going' : 'complete a lesson to start'}
          accent="berry"
        />
        <StatCard
          value={`${stats.percent_complete}%`}
          label="Course progress"
          hint={`${stats.lessons_total - stats.lessons_completed} remaining`}
          accent="amber"
        />
      </div>

      {/* Main two-column area */}
      <div className="grid flex-1 gap-4 lg:min-h-0 lg:grid-cols-3">
        {/* Continue */}
        <Card className="flex flex-col justify-between p-6 lg:col-span-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              {stats.next_lesson ? 'Continue learning' : 'All caught up'}
            </p>

            {stats.next_lesson ? (
              <>
                <h2 className="mt-3 text-2xl font-bold leading-snug tracking-tight">
                  {stats.next_lesson.title}
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
                  {stats.next_lesson.summary}
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs">
                  <span
                    className={`rounded-full px-2.5 py-1 font-semibold ${
                      categoryStyle(stats.next_lesson.category).chip
                    }`}
                  >
                    {categoryStyle(stats.next_lesson.category).label}
                  </span>
                  <span className="text-ink-soft">
                    {stats.next_lesson.estimated_minutes} min read
                  </span>
                </div>
              </>
            ) : (
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
                {stats.lessons_total === 0
                  ? 'No lessons have been published yet. Add lesson content to the database to get started.'
                  : "You've completed every lesson. Quizzes are coming next."}
              </p>
            )}
          </div>

          <div className="mt-6 flex items-center gap-3">
            {stats.next_lesson ? (
              <Button onClick={() => navigate(`/lessons/${stats.next_lesson!.slug}`)}>
                {stats.lessons_completed === 0 ? 'Start learning' : 'Continue'}
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => navigate('/lessons')}>
                Browse lessons
              </Button>
            )}
            <Button variant="quiet" onClick={() => navigate('/lessons')}>
              All lessons →
            </Button>
          </div>
        </Card>

        {/* Progress breakdown */}
        <Card className="flex flex-col p-6">
          <div className="flex justify-center">
            <ProgressRing percent={stats.percent_complete} />
          </div>

          <div className="scroll-soft mt-6 flex-1 space-y-3 overflow-y-auto pr-1">
            {stats.by_category.length === 0 ? (
              <p className="text-center text-sm text-ink-soft">No categories yet.</p>
            ) : (
              stats.by_category.map((c) => {
                const style = categoryStyle(c.category)
                return (
                  <div key={c.category}>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 font-semibold">
                        <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                        {style.label}
                      </span>
                      <span className="tabular-nums text-ink-soft">
                        {c.completed}/{c.total}
                      </span>
                    </div>
                    <Bar value={c.total ? (c.completed / c.total) * 100 : 0} />
                  </div>
                )
              })
            )}
          </div>
        </Card>
      </div>

      <SafetyNotice />
    </div>
  )
}
