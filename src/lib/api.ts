import { supabase } from './supabase'

export interface Profile {
  id: string
  email: string | null
  display_name: string | null
  diagnosed_year: number | null
  created_at: string
  onboarding_goal: string | null
  onboarding_experience: string | null
  onboarding_learning_style: string | null
  onboarding_content_preference: string | null
  onboarding_focus: string | null
  // NULL means the reader hasn't taken the onboarding quiz yet.
  onboarding_completed_at: string | null
  /**
   * Where this reader stands per area of diabetes management, 1-100. The half
   * of the profile they don't write: lesson and chat sessions move these, and
   * every prompt handed the profile is handed them. Always the full set of
   * areas — 50 means nothing has been learned about that one yet.
   */
  area_ratings: Record<string, number>
}

export type OnboardingGoal = 'newly_diagnosed' | 'managing_long_term' | 'caregiver' | 'curious'
export type OnboardingExperience = 'new' | 'basics' | 'experienced'
export type OnboardingLearningStyle = 'quick_bites' | 'deep_dives' | 'mixed'
export type OnboardingContentPreference = 'why_first' | 'examples_first'
export type OnboardingFocus =
  'carb_counting' | 'insulin_action' | 'exercise' | 'highs_lows' | 'not_sure'

export interface OnboardingAnswers {
  goal: OnboardingGoal
  experience: OnboardingExperience
  learning_style: OnboardingLearningStyle
  content_preference: OnboardingContentPreference
  focus: OnboardingFocus
}

export interface LessonSummary {
  slug: string
  title: string
  summary: string
  category: string
  difficulty: number
  estimated_minutes: number
  order_index: number
  completed: boolean
  last_viewed_at: string | null
}

/** One chunk of a lesson. Split server-side so the checkpoints line up. */
export interface LessonSection {
  index: number
  heading: string
  markdown: string
}

export interface LessonDetail extends LessonSummary {
  body: string
  key_takeaways: string[]
  sections: LessonSection[]
}

export interface QuestionOption {
  index: number
  text: string
}

/**
 * What the reader gets back from one attempt.
 *
 * Until the checkpoint is settled the answer key stays on the server, so
 * `correct_index` and `explanation` are null while a retry is still open.
 */
export interface AnswerResult {
  question_id: string
  chosen_index: number
  correct: boolean
  attempt: number
  settled: boolean
  correct_index: number | null
  explanation: string | null
  /** The teacher's reply to this particular wrong turn. */
  coaching: string | null
}

export interface Question {
  id: string
  section_index: number
  prompt: string
  options: QuestionOption[]
  /** Set when this reader has already attempted it, on a revisit. */
  answered: AnswerResult | null
  /** Wrong options already spent — not offered again on the retry. */
  tried_indices: number[]
}

/** One checkpoint attempt made this session, held client-side until completion. */
export interface AnswerAttempt {
  question_id: string
  chosen_index: number
}

export interface ConceptInsight {
  concept: string
  asked: number
  correct: number
  misconceptions: string[]
}

export interface Insights {
  questions_answered: number
  questions_correct: number
  by_concept: ConceptInsight[]
}

export interface CategoryStat {
  category: string
  total: number
  completed: number
}

/**
 * One card in the 20-card review deck. `chat_gap` cards were written at the end
 * of a chat session, for something the reader struggled with there; `weak_spot`
 * cards come from checkpoints they've gotten wrong; `takeaway` cards fill any
 * remaining seats. `front`/`back` differ by kind — a question prompt vs. its
 * explanation for a weak spot, a lesson title vs. its key takeaway otherwise —
 * so the deck never needs to know which it's showing to render it.
 *
 * Reviewing the deck writes nothing. The deck is a queue of 20: a lesson or chat
 * session adds what it turned up and the oldest cards drop off to make room, so
 * cards earned in earlier sessions stay put until they've been pushed out.
 * Ordered newest first.
 *
 * `lesson_slug` and `category` are empty on a `chat_gap` card, which belongs to
 * no lesson; `lesson_title` carries the conversation's topic instead.
 */
export interface Flashcard {
  id: string
  kind: 'chat_gap' | 'weak_spot' | 'takeaway'
  lesson_slug: string
  lesson_title: string
  category: string
  front: string
  back: string
}

/** One message in a chat session. Held here and never stored server-side. */
export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatCheckOption {
  text: string
  correct: boolean
  /** What the tutor says to someone who picks this one. Shown the moment they do. */
  response: string
}

/**
 * A question the tutor stopped to ask, shown as a quiz rather than as text.
 *
 * Unlike a lesson checkpoint the answer key ships with it — a check has no
 * retry and is never recorded, so there is nothing to withhold and the reader
 * finds out where they stand without a round trip.
 */
export interface ChatCheck {
  question: string
  options: ChatCheckOption[]
}

export type SessionTopic =
  | 'carb_counting'
  | 'insulin_action'
  | 'exercise'
  | 'highs_lows'
  | 'ketones_sick_days'
  | 'tutor_picks'

/**
 * What the reader settles before the tutor speaks.
 *
 * Sent on every turn rather than only on the first: the brief is what keeps a
 * session on its subject, and a brief sent once would be forty turns behind by
 * the end. A closed set the server validates against the same Literal — see
 * `schemas.SessionBriefIn`.
 *
 * A subject and nothing else. How long a session runs isn't the reader's to
 * settle before it starts; the tutor proposes the end when the work is done
 * (`wrap_up` on a turn).
 */
export interface SessionBrief {
  topic: SessionTopic
}

/** The picker's options, labelled. The server holds the matching prompt text. */
export const SESSION_TOPICS: { value: SessionTopic; label: string; blurb: string }[] = [
  {
    value: 'carb_counting',
    label: 'Counting carbs',
    blurb: 'What counts, what doesn’t, and why estimates go wrong',
  },
  {
    value: 'insulin_action',
    label: 'How insulin acts',
    blurb: 'Onset, peak and tail — and what that timing causes',
  },
  {
    value: 'exercise',
    label: 'Exercise',
    blurb: 'Why different activity moves glucose in opposite directions',
  },
  {
    value: 'highs_lows',
    label: 'Highs and lows',
    blurb: 'What drives them, how they feel, how they resolve',
  },
  {
    value: 'ketones_sick_days',
    label: 'Ketones and illness',
    blurb: 'Where ketones come from and why illness changes things',
  },
  {
    value: 'tutor_picks',
    label: 'You choose',
    blurb: 'The tutor picks from what you’ve been getting wrong',
  },
]

/**
 * The generated recap a finished session leaves behind — never the
 * conversation itself, which is never stored. See `app/chat_summary.py`.
 */
export interface ChatSessionSummary {
  id: string
  topic: SessionTopic
  headline: string
  summary: string
  checks_correct: number
  checks_total: number
  cards_added: number
  created_at: string
}

/**
 * What the deck is made of. The total is always 20 once seeded, so the split is
 * the part worth showing: `starters` is the hand-written filler a new reader
 * begins with, and it falls to zero as sessions push cards they earned in.
 */
export interface DeckStat {
  total: number
  weak_spots: number
  from_tutor: number
  starters: number
}

/** A lesson whose checkpoints this reader has missed. First attempts only. */
export interface TroubleSpot {
  lesson_slug: string
  lesson_title: string
  category: string
  asked: number
  missed: number
}

export interface Stats {
  lessons_total: number
  lessons_completed: number
  percent_complete: number
  minutes_learned: number
  streak_days: number
  last_activity_at: string | null
  by_category: CategoryStat[]
  next_lesson: LessonSummary | null
  checkpoints_answered: number
  checkpoints_correct: number
  checkpoint_accuracy: number
  deck: DeckStat
  /** Every card the tutor has ever written, not just those still in the deck. */
  tutor_cards: number
  trouble_spots: TroubleSpot[]
}

/**
 * In dev, requests hit `/api/...` and vite's proxy forwards them to the
 * local backend. In production there's no proxy, so VITE_API_URL points
 * straight at the deployed backend. Left unset, paths stay relative.
 */
const API_BASE = import.meta.env.VITE_API_URL ?? ''

/** Every call carries the Supabase access token; the API rejects anything else. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) throw new Error('Your session has expired. Sign in again.')

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...(init?.headers ?? {}),
    },
  })

  if (!res.ok) {
    const detail = await res
      .json()
      .then((b) => b.detail)
      .catch(() => null)
    throw new Error(detail ?? `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export const api = {
  me: () => request<Profile>('/api/me'),

  updateMe: (body: Partial<Pick<Profile, 'display_name' | 'diagnosed_year'>>) =>
    request<Profile>('/api/me', { method: 'PATCH', body: JSON.stringify(body) }),

  stats: () => request<Stats>('/api/stats'),

  /** The stored 20-card review deck, most recently earned card first. */
  flashcards: () => request<Flashcard[]>('/api/flashcards'),

  lessons: () => request<LessonSummary[]>('/api/lessons'),

  lesson: (slug: string) => request<LessonDetail>(`/api/lessons/${slug}`),

  /** Empty when checkpoints aren't configured — the lesson still reads. */
  questions: (slug: string) => request<Question[]>(`/api/lessons/${slug}/questions`),

  /**
   * Judges one attempt. Nothing is saved server-side yet — the checkpoint only
   * becomes a permanent record once the lesson is completed (see `setProgress`),
   * so the server needs this session's already-tried options to score it.
   */
  answer: (questionId: string, chosenIndex: number, triedIndices: number[]) =>
    request<AnswerResult>(`/api/questions/${questionId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ chosen_index: chosenIndex, tried_indices: triedIndices }),
    }),

  insights: () => request<Insights>('/api/insights'),

  /**
   * The companion's remark for one screen. Shaped by what this reader answered
   * in *earlier* sessions — the server reads that off their record, so nothing
   * about the session in progress is sent. A null message is normal and common.
   */
  coach: (slug: string, sectionIndex: number, shownTips: string[]) =>
    request<{ message: string | null }>('/api/coach', {
      method: 'POST',
      body: JSON.stringify({
        slug,
        section_index: sectionIndex,
        shown_tips: shownTips,
      }),
    }),

  /**
   * Opens a session: the tutor's first message, written before the reader has
   * said anything. The brief is the whole body — just the subject they picked.
   * Everything else the opening needs, the server has.
   */
  startChat: (brief: SessionBrief) =>
    request<{ reply: string; check: ChatCheck | null }>('/api/chat/start', {
      method: 'POST',
      body: JSON.stringify({ brief }),
    }),

  // A turn of a session is not here. `POST /api/chat` streams, and its client
  // is `useChat` in `pages/Chat.tsx` — the AI SDK owns that request, including
  // the auth header, so routing it through this helper would mean two transports
  // for one endpoint. Everything else a session does is a plain call and lives
  // here.

  /**
   * Ends a chat session: the model reads the conversation back and writes up to
   * five cards for whatever the reader struggled with, then enqueues them onto
   * the deck. Zero cards is a normal outcome for a short conversation. Also
   * writes and returns a generated recap of the session — the conversation
   * itself is still never stored, `session` is what survives it instead.
   * `checks_correct`/`checks_total` are tallied here, client-side, since a
   * check is answered in the browser and never recorded anywhere else.
   */
  endChat: (
    messages: ChatTurn[],
    brief: SessionBrief,
    checks: { correct: number; total: number },
  ) =>
    request<{ cards_added: number; session: ChatSessionSummary }>('/api/chat/end', {
      method: 'POST',
      body: JSON.stringify({
        messages,
        brief,
        checks_correct: checks.correct,
        checks_total: checks.total,
      }),
    }),

  /** Past sessions, most recently ended first — recaps only, never the transcript. */
  chatSessions: () => request<ChatSessionSummary[]>('/api/chat/sessions'),

  /** `answers` is the session's full checkpoint attempt history; only saved when completing. */
  setProgress: (slug: string, completed: boolean, answers: AnswerAttempt[] = []) =>
    request<{ slug: string; completed: boolean }>(`/api/lessons/${slug}/progress`, {
      method: 'POST',
      body: JSON.stringify({ completed, answers }),
    }),

  /** One-time onboarding quiz — all five answers submitted together. */
  submitOnboarding: (answers: OnboardingAnswers) =>
    request<Profile>('/api/me/onboarding', { method: 'POST', body: JSON.stringify(answers) }),
}
