import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DeckStat, TroubleSpot } from '../lib/api'
import { loadDashboard, updateProfile, useAppDispatch, useAppSelector } from '../store'
import { useSmoothWheelScroll } from '../hooks/useSmoothWheelScroll'
import {
  Bar,
  Button,
  Card,
  ErrorBanner,
  ProgressRing,
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
  const categoryScrollRef = useSmoothWheelScroll<HTMLDivElement>()

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
                className="ml-3 cursor-pointer align-middle text-xs font-semibold text-ink-soft underline underline-offset-4 hover:text-ink"
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

      {/* Stat row. Course progress isn't here — the ring below already says it,
          and the fourth seat is better spent on something the tiles are the only
          place to see. */}
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
          value={stats.checkpoints_answered ? `${stats.checkpoint_accuracy}%` : '—'}
          label="Checkpoints"
          hint={
            stats.checkpoints_answered
              ? `${stats.checkpoints_correct} of ${stats.checkpoints_answered} first tries`
              : 'answered as you finish lessons'
          }
          accent="amber"
        />
      </div>

      {/* Main two-column area */}
      <div className="grid flex-1 gap-4 lg:min-h-0 lg:grid-cols-3">
        {/* Continue, and under it what the rest of the app knows about this
            reader: the lessons that tripped them up, and the deck those and
            their tutor sessions have been filling. */}
        <div className="flex flex-col gap-4 lg:col-span-2 lg:min-h-0">
          {/* Continue keeps its natural height — squeezing it is what put the
              buttons on top of the summary. The panels below take the slack
              instead: a list and a legend both look fine with room under them,
              and a headline with a button through it does not. */}
          <Card className="flex shrink-0 flex-col p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                {stats.next_lesson ? 'Continue learning' : 'All caught up'}
              </p>

              {stats.next_lesson ? (
                <>
                  <h2 className="mt-3 text-2xl font-bold leading-snug tracking-tight">
                    {stats.next_lesson.title}
                  </h2>
                  {/* Clamped: a long summary is the one piece of content here
                      that can run to five lines and push the card past its
                      share of the window. */}
                  <p className="mt-2 line-clamp-2 max-w-xl text-sm leading-relaxed text-ink-soft">
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
                    : "You've completed every lesson. Revisit any of them any time."}
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

          <div className="grid min-h-0 flex-1 gap-4 sm:grid-cols-2">
            <TroubleSpots spots={stats.trouble_spots} answered={stats.checkpoints_answered} />
            <DeckPanel deck={stats.deck} tutorCards={stats.tutor_cards} />
          </div>
        </div>

        {/* Progress breakdown */}
        <Card className="flex flex-col p-6">
          <div className="flex justify-center">
            <ProgressRing percent={stats.percent_complete} />
          </div>

          <div
            ref={categoryScrollRef}
            className="scroll-soft mt-6 flex-1 space-y-3 overflow-y-auto pr-1"
          >
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
    </div>
  )
}

function PanelHeading({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">{children}</p>
}

/**
 * The lessons whose checkpoints this reader has actually missed — first
 * attempts only, so the retry that follows coaching doesn't count against them.
 *
 * Every row goes back to the lesson, because "you missed two of these" is only
 * useful next to the way to do something about it.
 */
function TroubleSpots({ spots, answered }: { spots: TroubleSpot[]; answered: number }) {
  const navigate = useNavigate()

  return (
    <Card className="flex min-h-0 flex-col overflow-hidden p-5">
      <PanelHeading>Worth another look</PanelHeading>

      {spots.length === 0 ? (
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-ink-soft">
          {answered === 0
            ? 'Checkpoints appear as you work through a lesson. Whatever you miss shows up here.'
            : `Nothing tripping you up — ${answered} checkpoints and no weak spots yet.`}
        </p>
      ) : (
        <div className="mt-3 min-h-0 space-y-1.5 overflow-y-auto">
          {spots.map((spot) => {
            const style = categoryStyle(spot.category)
            return (
              <button
                key={spot.lesson_slug}
                onClick={() => navigate(`/lessons/${spot.lesson_slug}`)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-cream-deep/60"
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {spot.lesson_title}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-ink-soft">
                  {spot.missed}/{spot.asked} missed
                </span>
              </button>
            )
          })}
        </div>
      )}
    </Card>
  )
}

/**
 * What the 20-card deck is made of, which is the one number about it that moves.
 * The total is 20 for everyone the moment they sign up; what changes is how much
 * of it the reader earned rather than started with, so the split is the metric
 * and the starters shrinking to nothing is the story.
 */
function DeckPanel({ deck, tutorCards }: { deck: DeckStat; tutorCards: number }) {
  const navigate = useNavigate()
  const rows: { label: string; count: number; className: string }[] = [
    { label: 'From checkpoints', count: deck.weak_spots, className: 'bg-berry' },
    { label: 'From the tutor', count: deck.from_tutor, className: 'bg-sage' },
    { label: 'Starter cards', count: deck.starters, className: 'bg-amber' },
  ]
  const earned = deck.weak_spots + deck.from_tutor

  return (
    <Card className="flex min-h-0 flex-col overflow-hidden p-5">
      <div className="flex items-baseline justify-between gap-3">
        <PanelHeading>Review deck</PanelHeading>
        <button
          onClick={() => navigate('/flashcards')}
          className="cursor-pointer text-xs font-semibold text-ink-soft underline underline-offset-4 hover:text-ink"
        >
          Review →
        </button>
      </div>

      {deck.total === 0 ? (
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">Your deck is still empty.</p>
      ) : (
        <>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-cream-deep">
            {rows
              .filter((r) => r.count > 0)
              .map((r) => (
                <div
                  key={r.label}
                  className={r.className}
                  style={{ width: `${(r.count / deck.total) * 100}%` }}
                />
              ))}
          </div>
          <div className="mt-3 space-y-1">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center gap-2 text-xs">
                <span className={`h-2 w-2 shrink-0 rounded-full ${r.className}`} />
                <span className="flex-1 text-ink-soft">{r.label}</span>
                <span className="tabular-nums font-semibold">{r.count}</span>
              </div>
            ))}
          </div>
          {/* One line, always — this panel shares a row with the trouble spots
              and the pair of them have to fit the window without scrolling. */}
          <p className="mt-auto truncate pt-3 text-xs text-ink-soft">
            {earned === 0
              ? 'All twenty are still the ones you started with.'
              : `${earned} of ${deck.total} earned` +
                (tutorCards > 0 ? ` · ${tutorCards} written by the tutor in all` : '')}
          </p>
        </>
      )}
    </Card>
  )
}
