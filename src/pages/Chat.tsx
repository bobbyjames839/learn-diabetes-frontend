import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SESSION_TOPICS, api } from '../lib/api'
import type {
  ChatCheck,
  ChatSessionSummary,
  ChatTurn,
  SessionBrief,
  SessionTopic,
} from '../lib/api'
import {
  endChatSession,
  loadChatSessions,
  profileReceived,
  useAppDispatch,
  useAppSelector,
} from '../store'
import { Button } from '../components/ui'

/**
 * A teaching session — and deliberately the inverse of a chatbot, in what it
 * does, what it looks like, and how it is paced.
 *
 * A chat box asks what you want to know, which is the one thing a learner
 * doesn't have. So the reader never faces an empty box. They settle a *brief*
 * first — a subject and how far to go — and then the tutor speaks, arriving
 * already knowing who they are.
 *
 * The session itself is built like the lesson reader, not like a transcript.
 * One turn fills the screen at a time; the site nav is gone; there is a step
 * count and a way back through what you have already been told. That is the
 * difference between being taught and scrolling a chat log: a chat log invites
 * you to skim to the bottom, and a lesson holds you on the idea in front of you.
 *
 * A tutor turn may carry a `check`: a multiple-choice question rendered as a
 * quiz, answered by choosing rather than typing. Nothing here is drawn as a
 * chat bubble. The tutor is a voice on the page, the reader's own words are a
 * quiet aside above it, and the checks are the furniture in between.
 *
 * The transcript lives here and nowhere else. The server stores none of it, so
 * every turn sends the whole conversation back up, and closing the tab ends the
 * session for good. What survives is what the session *learned*: the occasional
 * profile revision (which comes back on the turn that made it) and the cards
 * written when it ends. A check is not recorded either — a fumbled one earns a
 * card at the end, the same as anything else they found hard.
 *
 * Ending is explicit, because it costs a model call and writes cards. It also
 * happens on unmount, so a reader who navigates away still gets the cards their
 * conversation earned — the one thing they'd otherwise lose by leaving.
 */

/**
 * One thing on the page. Richer than a `ChatTurn` because a turn is what the
 * server needs and this is what the reader sees: the check that came with a
 * tutor message, and which option they picked, exist only here.
 */
type Entry =
  | {
      kind: 'tutor'
      content: string
      check: ChatCheck | null
      picked: number | null
      /** This turn proposed the session was done. An offer, not an ending. */
      wrapUp: boolean
    }
  | { kind: 'reader'; content: string }

/** Setup or the session itself. What a finished session leaves is a dialog
 * over the setup screen, not a screen of its own. */
type Phase = 'setup' | 'session'

/** The reader's "next": carried on without having to invent a question. */
const KEEP_GOING = 'Keep going.'

/** The session as the server wants it back: just who said what. */
function toTurns(entries: Entry[]): ChatTurn[] {
  return entries.map((entry) => ({
    role: entry.kind === 'tutor' ? 'assistant' : 'user',
    content: entry.content,
  }))
}

/**
 * How the checks in this session went. Tallied here, client-side, because a
 * check is answered in the browser and never recorded anywhere else — this is
 * the only way the count reaches the server at all.
 */
function tallyChecks(entries: Entry[]): { correct: number; total: number } {
  let total = 0
  let correct = 0
  for (const entry of entries) {
    if (entry.kind === 'tutor' && entry.check && entry.picked !== null) {
      total += 1
      if (entry.check.options[entry.picked]?.correct) correct += 1
    }
  }
  return { correct, total }
}

export default function Chat() {
  const dispatch = useAppDispatch()
  const profile = useAppSelector((s) => s.app.profile)

  const [phase, setPhase] = useState<Phase>('setup')
  const [brief, setBrief] = useState<SessionBrief>({ topic: 'tutor_picks' })
  const [entries, setEntries] = useState<Entry[]>([])
  // Which tutor turn is on screen. The session is stepped, so this is the
  // reader's position in it rather than a scroll offset.
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // What the session that just ended left behind, while its dialog is up.
  // Null the rest of the time, which is most of it.
  const [recap, setRecap] = useState<ChatSessionSummary | null>(null)
  // A past session the reader clicked on, from the list below. Separate from
  // `recap` — that one is news about a session that just happened, this one
  // is a lookup — but they share the same dialog.
  const [viewing, setViewing] = useState<ChatSessionSummary | null>(null)

  // Read at unmount time. The cleanup below runs once, so it would otherwise
  // close over the empty transcript (and initial brief) this component
  // started with.
  const entriesRef = useRef(entries)
  entriesRef.current = entries
  const briefRef = useRef(brief)
  briefRef.current = brief

  // Past sessions, for the setup screen — recaps only, the conversations
  // themselves were never kept. Loaded once; a session just ended is added to
  // the list locally rather than by refetching (see the `endChatSession` case
  // in store.ts).
  useEffect(() => {
    dispatch(loadChatSessions())
  }, [dispatch])

  // Leaving the page ends the session too — the cards are the point of ending
  // it, and a reader who wanders off has still had the conversation.
  useEffect(() => {
    return () => {
      if (entriesRef.current.length > 1) {
        dispatch(
          endChatSession({
            messages: toTurns(entriesRef.current),
            brief: briefRef.current,
            checks: tallyChecks(entriesRef.current),
          }),
        )
      }
    }
  }, [dispatch])

  // Every tutor turn is a step. The reader's own messages hang off the step
  // that answered them rather than taking one of their own.
  const steps = useMemo(
    () => entries.reduce<number[]>((acc, e, i) => (e.kind === 'tutor' ? [...acc, i] : acc), []),
    [entries],
  )
  const atLatest = step >= steps.length - 1

  const name = profile?.display_name || profile?.email?.split('@')[0] || ''

  /** The reader's one opening move: the brief. Everything after this is a reply. */
  async function begin() {
    if (thinking) return
    setPhase('session')
    setEntries([])
    setStep(0)
    setThinking(true)
    setError(null)
    setRecap(null)

    try {
      const { reply, check } = await api.startChat(brief)
      setEntries([{ kind: 'tutor', content: reply, check, picked: null, wrapUp: false }])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The tutor could not start a session just now.')
    } finally {
      setThinking(false)
    }
  }

  /** Sends whatever the reader just contributed and appends the tutor's answer. */
  const send = useCallback(
    async (content: string, from: Entry[]) => {
      const next: Entry[] = [...from, { kind: 'reader', content }]
      setEntries(next)
      setThinking(true)
      setError(null)

      try {
        const {
          reply,
          check,
          profile: revised,
          wrap_up: wrapUp,
        } = await api.chat(toTurns(next), brief)
        const grown: Entry[] = [
          ...next,
          { kind: 'tutor', content: reply, check, picked: null, wrapUp },
        ]
        setEntries(grown)
        // Move them on to what just arrived. A new turn they have to go and
        // find is the chat-log failure this whole screen is built to avoid.
        setStep(grown.filter((e) => e.kind === 'tutor').length - 1)
        // The profile comes back only on the rare turn that revised it. Nothing
        // is said about it — it's bookkeeping, not part of the conversation.
        if (revised) dispatch(profileReceived(revised))
      } catch (e) {
        // The reader's own message stays on screen: they said it, and rolling it
        // back so they have to type it again is the worst possible apology.
        setError(e instanceof Error ? e.message : 'The tutor could not answer just now.')
      } finally {
        setThinking(false)
      }
    },
    [brief, dispatch],
  )

  function submitDraft() {
    const content = draft.trim()
    if (!content || thinking) return
    setDraft('')
    send(content, entries)
  }

  /**
   * Answering a check. The response is already on screen by the time this
   * returns — it shipped with the question — so the round trip buys the tutor's
   * *next* turn rather than the verdict, and the reader is never left waiting
   * to find out whether they were right.
   */
  function answerCheck(entryIndex: number, optionIndex: number) {
    const entry = entries[entryIndex]
    if (thinking || entry.kind !== 'tutor' || !entry.check || entry.picked !== null) return

    const chosen = entry.check.options[optionIndex]
    const answered = entries.map((e, i) =>
      i === entryIndex && e.kind === 'tutor' ? { ...e, picked: optionIndex } : e,
    )
    setEntries(answered)
    // Sent as their words, because from the model's side that is what it was:
    // it asked a question and this is the answer it got back.
    send(`My answer: ${chosen.text}`, answered)
  }

  async function finish() {
    if (thinking) return
    if (entries.length < 2) {
      setPhase('setup')
      setEntries([])
      return
    }
    setThinking(true)
    try {
      const { session } = await dispatch(
        endChatSession({ messages: toTurns(entries), brief, checks: tallyChecks(entries) }),
      ).unwrap()
      setRecap(session)
    } catch {
      // Ending is a courtesy on top of a conversation that already happened.
      // Failing to write cards and a recap is not worth an error banner.
    } finally {
      setEntries([])
      setThinking(false)
      setPhase('setup')
    }
  }

  const pastSessions = useAppSelector((s) => s.app.chatSessions)

  if (phase === 'setup') {
    return (
      <>
        <Setup
          name={name}
          brief={brief}
          onChange={setBrief}
          onBegin={begin}
          pastSessions={pastSessions}
          onSelectSession={setViewing}
        />
        {recap !== null && <SessionFinished session={recap} onClose={() => setRecap(null)} />}
        {viewing !== null && (
          <SessionFinished
            session={viewing}
            title="Past session"
            onClose={() => setViewing(null)}
          />
        )}
      </>
    )
  }

  const tutorIndex = steps[step]
  const current = tutorIndex === undefined ? null : entries[tutorIndex]
  const before = tutorIndex !== undefined && tutorIndex > 0 ? entries[tutorIndex - 1] : null
  const openCheck =
    atLatest && current?.kind === 'tutor' && !!current.check && current.picked === null

  // The tutor's own judgement that the session has done its work, on the turn
  // that made it. Nobody set a length up front — this is where the end comes
  // from instead — and it is an offer: the composer stays, and typing anything
  // carries on as if it were never made.
  const proposedEnd = atLatest && current?.kind === 'tutor' && current.wrapUp

  // What the tutor is working on, shown back to the reader while they wait —
  // unless it's the canned "Keep going", which says nothing about them.
  const last = entries.at(-1)
  const waitingOn = last?.kind === 'reader' && last.content !== KEEP_GOING ? last.content : null

  // Pinned to the window rather than trailing the text: on a short turn a
  // composer that follows the content floats halfway up the page.
  //
  // It also belongs to the live end of the session. Looking back at an earlier
  // turn there is nothing to reply to, and while a check is open a text box
  // beside it invites talking around the question rather than answering it.
  const composer = current && !thinking && (
    <div className="shrink-0 border-t border-line bg-card/70 px-6 py-3.5 backdrop-blur sm:px-8">
      <div className="mx-auto w-full max-w-2xl">
        {!atLatest ? (
          <div className="flex items-center gap-3">
            <p className="flex-1 text-sm text-ink-soft">
              Looking back at step {step + 1} of {steps.length}.
            </p>
            <Button onClick={() => setStep(steps.length - 1)}>Back to the session</Button>
          </div>
        ) : openCheck ? (
          <p className="py-1.5 text-center text-sm text-ink-soft">
            Pick an answer above to carry on.
          </p>
        ) : (
          // Two rows on a phone, one on anything wider. Three controls side by
          // side at 390px pushes the last one off the screen entirely.
          //
          // All three are `h-10 rounded-card`, set here rather than left to
          // each control's own padding: an input, a `Button` and a bordered
          // button work out to three different heights and two different corner
          // radii, and a row of controls that don't line up reads as misplaced
          // even when it is perfectly centred.
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                submitDraft()
              }}
              className="flex flex-1 gap-2.5 sm:gap-3"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={
                  proposedEnd
                    ? 'Or say what you want to pick up…'
                    : 'Have a go — say what you think, or ask…'
                }
                className="h-10 min-w-0 flex-1 rounded-card border border-line bg-card px-4 text-sm outline-none transition focus:border-amber/50"
              />
              <Button type="submit" disabled={!draft.trim()} className="h-10 rounded-card px-5">
                Send
              </Button>
            </form>
            {/* Once the tutor has proposed the end, finishing takes the seat
                "Keep going" normally has. Carrying on is still there — say
                anything and the session goes on — but the button that carries
                you on without a question would be arguing with the proposal. */}
            {proposedEnd ? (
              <Button onClick={finish} className="h-10 shrink-0 rounded-card px-5">
                Finish session
              </Button>
            ) : (
              <button
                onClick={() => send(KEEP_GOING, entries)}
                className="h-10 shrink-0 rounded-card border border-line px-4 text-sm font-semibold text-ink-soft transition hover:border-amber/50 hover:text-ink"
              >
                Keep going →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <SessionShell
      brief={brief}
      step={step}
      total={steps.length}
      thinking={thinking}
      onBack={() => setStep((s) => Math.max(0, s - 1))}
      onForward={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
      onExit={finish}
      footer={composer}
    >
      {thinking ? (
        // The whole page waits, rather than a placeholder arriving underneath
        // the last turn. A session is stepped: what's coming isn't the next
        // message in a log, it's the next page, so the current one steps aside
        // for it the same way a lesson section gives way to its checkpoint.
        <Waiting
          label={entries.length === 0 ? 'Putting a session together' : 'Reading what you said'}
          // Their own words while the tutor works on them — but not the canned
          // "Keep going", which says nothing back to them.
          aside={waitingOn}
        />
      ) : (
        <div className="mx-auto w-full max-w-2xl px-6 py-10 sm:px-8">
          {/* Their own words, above the answer to them: context for the turn on
            screen, not a message in a thread. */}
          {before?.kind === 'reader' && (
            <p className="mb-8 border-l-2 border-line pl-4 text-sm italic leading-relaxed text-ink-soft">
              {before.content}
            </p>
          )}

          {current?.kind === 'tutor' && (
            // Keyed on the step so moving between turns re-runs the entrance:
            // the page should feel like it turned, not like text was swapped.
            <div key={step} className="rise space-y-7">
              <p className="whitespace-pre-wrap text-[17px] leading-[1.8] text-ink">
                {current.content}
              </p>
              {current.check && (
                <Check
                  check={current.check}
                  picked={current.picked}
                  disabled={thinking || !atLatest}
                  onPick={(optionIndex) => answerCheck(tutorIndex, optionIndex)}
                />
              )}
            </div>
          )}

          {error && (
            <div className="mt-8 rounded-card border border-berry/30 bg-berry-wash/40 px-5 py-4">
              <p className="text-sm text-berry">{error}</p>
              {entries.length === 0 && (
                <button
                  onClick={begin}
                  className="mt-3 text-sm font-semibold text-ink underline underline-offset-4"
                >
                  Try again
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </SessionShell>
  )
}

/**
 * The session, full screen.
 *
 * `fixed inset-0` rather than a route of its own: a session is a place you are
 * in, the same way a lesson is, and covering the site nav is the point. Nothing
 * else is reachable until it ends, which is also what makes ending it reliably
 * write the cards.
 */
function SessionShell({
  brief,
  step,
  total,
  thinking,
  onBack,
  onForward,
  onExit,
  footer,
  children,
}: {
  brief: SessionBrief
  step: number
  total: number
  thinking: boolean
  onBack: () => void
  onForward: () => void
  onExit: () => void
  // Outside the scrolling region: the composer belongs to the window, not to
  // the end of the text, or it drifts up the page on a short turn.
  footer: React.ReactNode
  children: React.ReactNode
}) {
  const topic = SESSION_TOPICS.find((t) => t.value === brief.topic)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-cream">
      <header className="shrink-0 border-b border-line bg-card/70 backdrop-blur">
        {/* Same width as the prose below it, so the session title sits over the
            text it belongs to rather than 48px out from it. */}
        <div className="mx-auto flex w-full max-w-2xl items-center gap-4 px-6 py-3.5 sm:px-8">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">
              {topic && topic.value !== 'tutor_picks' ? topic.label : 'Tutor session'}
            </p>
            {/* The subject's own blurb, not a length: nobody set one, and the
                tutor says when it's done. */}
            <p className="truncate text-xs text-ink-soft">{topic?.blurb}</p>
          </div>

          {total > 1 && (
            <div className="flex shrink-0 items-center gap-1">
              <StepButton onClick={onBack} disabled={step === 0} label="Previous step">
                ←
              </StepButton>
              <span className="w-16 text-center text-xs font-semibold tabular-nums text-ink-soft">
                {step + 1} / {total}
              </span>
              <StepButton onClick={onForward} disabled={step >= total - 1} label="Next step">
                →
              </StepButton>
            </div>
          )}

          <button
            onClick={onExit}
            disabled={thinking}
            className="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold text-ink-soft transition hover:bg-cream-deep hover:text-ink disabled:opacity-40"
          >
            End session
          </button>
        </div>

        {/* Not progress towards a known end — a session has no fixed length.
            It's how far they've come, which is the honest version. */}
        <div className="h-0.5 bg-line">
          <div
            className="h-full bg-amber transition-[width] duration-500"
            style={{ width: `${Math.min(100, ((step + 1) / Math.max(total, 4)) * 100)}%` }}
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">{children}</div>
      {footer}
    </div>
  )
}

function StepButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void
  disabled: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-full text-ink-soft transition hover:bg-cream-deep hover:text-ink disabled:pointer-events-none disabled:opacity-25"
    >
      {children}
    </button>
  )
}

/**
 * What a finished session leaves behind, over the setup screen rather than in
 * it. The recap is news about the session that just ended, not part of the
 * question of what to do next — a panel wedged above the choices reads as a
 * step in choosing one. Dismissing it puts the reader back where they'd be
 * anyway: picking a brief. It stays in "Past sessions" below after that.
 */
function SessionFinished({
  session,
  onClose,
  title = 'Session finished',
}: {
  session: ChatSessionSummary
  onClose: () => void
  title?: string
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const { cards_added, checks_total, checks_correct } = session

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 px-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-finished-title"
        onClick={(e) => e.stopPropagation()}
        className="rise w-full max-w-md rounded-card border border-sage/40 bg-card px-6 py-5 shadow-lg"
      >
        <p id="session-finished-title" className="text-sm font-bold text-sage">
          {title}
        </p>
        <p className="mt-2 text-base font-bold text-ink">{session.headline}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{session.summary}</p>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-ink-soft">
          {checks_total > 0 && (
            <span>
              {checks_correct} of {checks_total} checks correct
            </span>
          )}
          <span>
            {cards_added > 0
              ? `${cards_added} card${cards_added === 1 ? '' : 's'} added to your deck`
              : 'Nothing new for your deck this time'}
          </span>
        </div>

        <div className="mt-5 flex justify-end">
          <Button onClick={onClose} className="h-10 rounded-card px-5">
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Past sessions, in the reader's own record — recaps only. The transcript
 * behind each one is gone; this is what was kept in its place. Newest first,
 * matching the deck's own ordering convention.
 */
function PastSessions({
  sessions,
  onSelect,
}: {
  sessions: ChatSessionSummary[]
  onSelect: (session: ChatSessionSummary) => void
}) {
  if (sessions.length === 0) return null

  return (
    <fieldset className="mt-9">
      <legend className="text-xs font-bold uppercase tracking-[0.14em] text-ink-soft">
        Past sessions
      </legend>
      <ul className="mt-4 space-y-2.5">
        {sessions.map((session) => (
          <li key={session.id}>
            <button
              type="button"
              onClick={() => onSelect(session)}
              className="w-full rounded-card border border-line bg-card px-4 py-3.5 text-left transition hover:border-amber/50 hover:bg-amber-wash/25"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-bold">{session.headline}</p>
                <p className="shrink-0 text-xs text-ink-soft">
                  {new Date(session.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">{session.summary}</p>
              {(session.checks_total > 0 || session.cards_added > 0) && (
                <p className="mt-2 text-xs font-semibold text-ink-soft">
                  {session.checks_total > 0 &&
                    `${session.checks_correct}/${session.checks_total} checks`}
                  {session.checks_total > 0 && session.cards_added > 0 && ' · '}
                  {session.cards_added > 0 &&
                    `${session.cards_added} card${session.cards_added === 1 ? '' : 's'} added`}
                </p>
              )}
            </button>
          </li>
        ))}
      </ul>
    </fieldset>
  )
}

/** What the reader settles before the tutor speaks. */
function Setup({
  name,
  brief,
  onChange,
  onBegin,
  pastSessions,
  onSelectSession,
}: {
  name: string
  brief: SessionBrief
  onChange: (brief: SessionBrief) => void
  onBegin: () => void
  pastSessions: ChatSessionSummary[]
  onSelectSession: (session: ChatSessionSummary) => void
}) {
  return (
    // Fits the height it is given rather than setting its own: the shell pins
    // /chat to the window at every width, so the heading and the Begin control
    // stay put and only the choices between them scroll when they don't fit.
    <div className="rise mx-auto flex h-full w-full max-w-3xl flex-col">
      <h1 className="shrink-0 text-3xl font-bold tracking-tight">Tutor</h1>
      <p className="mt-1.5 max-w-xl shrink-0 text-sm leading-relaxed text-ink-soft">
        A one-to-one session, pitched at what you already know. The tutor gives you something to
        work out, then teaches from what you said — so you don't need a question ready, and being
        wrong is the useful part. Nothing is saved except what you found hard, which becomes cards
        to review.
      </p>

      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        <fieldset className="mt-9">
          <legend className="text-xs font-bold uppercase tracking-[0.14em] text-ink-soft">
            What do you want to go over{name ? `, ${name}` : ''}?
          </legend>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SESSION_TOPICS.map((topic) => (
              <Choice
                key={topic.value}
                label={topic.label}
                blurb={topic.blurb}
                selected={brief.topic === topic.value}
                onSelect={() => onChange({ ...brief, topic: topic.value as SessionTopic })}
              />
            ))}
          </div>
        </fieldset>

        <PastSessions sessions={pastSessions} onSelect={onSelectSession} />
      </div>

      <div className="shrink-0 pt-7">
        <Button onClick={onBegin} className="h-10 rounded-card px-5">
          Begin session
        </Button>
      </div>
    </div>
  )
}

function Choice({
  label,
  blurb,
  selected,
  onSelect,
}: {
  label: string
  blurb: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`rounded-card border px-4 py-3.5 text-left transition ${
        selected
          ? 'border-amber bg-amber-wash/60 shadow-sm'
          : 'border-line bg-card hover:border-amber/50 hover:bg-amber-wash/25'
      }`}
    >
      <span className="block text-sm font-bold">{label}</span>
      <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">{blurb}</span>
    </button>
  )
}

/**
 * The gap between steps, which is a whole page rather than a bubble arriving.
 *
 * Skeleton lines under the last turn were a chat log's idea of waiting: they
 * only make sense where new text lands at the bottom of a list you're scrolling.
 * Here the next turn *replaces* what's on screen, so the waiting state does too
 * — it holds the middle of the page, says what is being done, and shows the
 * reader's own last words so the wait is visibly about them.
 *
 * A travelling stripe rather than a filling bar: nothing knows how long the
 * model will take, and a progress bar that isn't measuring progress is a lie.
 */
function Waiting({ label, aside }: { label: string; aside: string | null }) {
  return (
    <div className="flex h-full items-center justify-center px-6 py-10">
      <div className="rise w-full max-w-md text-center" aria-live="polite">
        {aside && (
          <p className="mx-auto mb-7 max-w-sm text-sm italic leading-relaxed text-ink-soft/80">
            “{aside}”
          </p>
        )}

        <p className="text-sm font-semibold text-ink-soft">
          {label}
          <span className="ml-1 inline-flex gap-1 align-middle">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="inline-block h-1 w-1 animate-pulse rounded-full bg-amber"
                style={{ animationDelay: `${i * 180}ms` }}
              />
            ))}
          </span>
        </p>

        <div className="mx-auto mt-5 h-0.5 w-44 overflow-hidden rounded-full bg-line">
          <div className="sweep h-full w-1/3 rounded-full bg-amber" />
        </div>
      </div>
    </div>
  )
}

/**
 * The tutor stopping to ask, mid-session.
 *
 * Deliberately built like a lesson checkpoint rather than like a message: this
 * is the part of the page that isn't a conversation. No retry, though — a
 * wrong answer is met with the reason it's wrong and the session carries on,
 * because the tutor's next turn is already picking the idea back up.
 */
function Check({
  check,
  picked,
  disabled,
  onPick,
}: {
  check: ChatCheck
  picked: number | null
  disabled: boolean
  onPick: (index: number) => void
}) {
  const answered = picked !== null
  const chosen = answered ? check.options[picked] : null

  return (
    <section
      className={`rounded-card border px-6 py-5 transition-colors ${
        !answered
          ? 'border-amber/50 bg-amber-wash/40'
          : chosen!.correct
            ? 'border-sage/40 bg-sage-wash/40'
            : 'border-berry/30 bg-berry-wash/30'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">
          Quick check
        </p>
        {answered && (
          <span className={`text-xs font-bold ${chosen!.correct ? 'text-sage' : 'text-berry'}`}>
            {chosen!.correct ? '✓ That’s it' : 'Not quite'}
          </span>
        )}
      </div>

      <p className="mt-3 whitespace-pre-line text-base font-semibold leading-relaxed">
        {check.question}
      </p>

      <ul className="mt-5 space-y-2">
        {check.options.map((option, index) => {
          const isPicked = picked === index
          // Once they've answered, the right one is shown whether or not they
          // found it — there is no second attempt to protect.
          let style = 'border-line bg-card hover:border-amber/60 hover:bg-amber-wash/50'
          if (answered && option.correct) style = 'border-sage/60 bg-sage-wash'
          else if (isPicked) style = 'border-berry/40 bg-berry-wash/50'
          else if (answered) style = 'border-line bg-card/40 text-ink-soft'

          return (
            <li key={index}>
              <button
                onClick={() => onPick(index)}
                disabled={answered || disabled}
                className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm leading-relaxed transition ${style} ${
                  answered || disabled ? 'cursor-default' : 'cursor-pointer'
                }`}
              >
                <span className="mt-px w-4 shrink-0 text-center font-bold">
                  {answered && option.correct ? '✓' : isPicked ? '✗' : ''}
                </span>
                <span>{option.text}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {/* Written in the same breath as the question, so it lands the instant
          they choose rather than after a round trip. */}
      {answered && (
        <p className="mt-5 border-t border-line/70 pt-4 text-sm leading-relaxed">
          {chosen!.response}
        </p>
      )}
    </section>
  )
}
