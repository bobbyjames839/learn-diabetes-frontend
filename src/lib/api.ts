import { supabase } from './supabase'

export interface Profile {
  id: string
  email: string | null
  display_name: string | null
  diagnosed_year: number | null
  created_at: string
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

/** What the reader gets back once they commit to an answer. */
export interface AnswerResult {
  question_id: string
  chosen_index: number
  correct: boolean
  correct_index: number
  explanation: string
}

export interface Question {
  id: string
  section_index: number
  prompt: string
  options: QuestionOption[]
  /** Set when this reader has already answered, on a revisit. */
  answered: AnswerResult | null
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

export interface Stats {
  lessons_total: number
  lessons_completed: number
  percent_complete: number
  minutes_learned: number
  streak_days: number
  last_activity_at: string | null
  by_category: CategoryStat[]
  next_lesson: LessonSummary | null
}

/** Every call carries the Supabase access token; the API rejects anything else. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) throw new Error('Your session has expired. Sign in again.')

  const res = await fetch(path, {
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

  lessons: () => request<LessonSummary[]>('/api/lessons'),

  lesson: (slug: string) => request<LessonDetail>(`/api/lessons/${slug}`),

  /** Empty when checkpoints aren't configured — the lesson still reads. */
  questions: (slug: string) => request<Question[]>(`/api/lessons/${slug}/questions`),

  answer: (questionId: string, chosenIndex: number) =>
    request<AnswerResult>(`/api/questions/${questionId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ chosen_index: chosenIndex }),
    }),

  insights: () => request<Insights>('/api/insights'),

  setProgress: (slug: string, completed: boolean) =>
    request<{ slug: string; completed: boolean }>(`/api/lessons/${slug}/progress`, {
      method: 'POST',
      body: JSON.stringify({ completed }),
    }),
}
