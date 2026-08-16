import { configureStore, createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { useDispatch, useSelector } from 'react-redux'
import { api } from './lib/api'
import type {
  AnswerAttempt,
  ChatSessionSummary,
  ChatTurn,
  Flashcard,
  LessonSummary,
  OnboardingAnswers,
  Profile,
  SessionBrief,
  Stats,
} from './lib/api'

interface AppState {
  profile: Profile | null
  stats: Stats | null
  lessons: LessonSummary[]
  flashcards: Flashcard[]
  chatSessions: ChatSessionSummary[]
  loading: boolean
  error: string | null
}

const initialState: AppState = {
  profile: null,
  stats: null,
  lessons: [],
  flashcards: [],
  chatSessions: [],
  loading: false,
  error: null,
}

export const loadDashboard = createAsyncThunk('app/dashboard', async () => {
  const [profile, stats] = await Promise.all([api.me(), api.stats()])
  return { profile, stats }
})

/** Profile only — dispatched app-wide so the header is correct on every page. */
export const loadProfile = createAsyncThunk('app/profile', () => api.me())

export const loadLessons = createAsyncThunk('app/lessons', () => api.lessons())

export const loadFlashcards = createAsyncThunk('app/flashcards', () => api.flashcards())

export const updateProfile = createAsyncThunk(
  'app/updateProfile',
  (body: { display_name?: string | null; diagnosed_year?: number | null }) => api.updateMe(body),
)

export const submitOnboarding = createAsyncThunk(
  'app/submitOnboarding',
  (answers: OnboardingAnswers) => api.submitOnboarding(answers),
)

export const setLessonCompleted = createAsyncThunk(
  'app/setLessonCompleted',
  async ({
    slug,
    completed,
    answers = [],
  }: {
    slug: string
    completed: boolean
    answers?: AnswerAttempt[]
  }) => {
    await api.setProgress(slug, completed, answers)
    // Completing a lesson is the end of a session, and a session ends with
    // three writes on the server: the answers, the profile, and the deck. All
    // three are re-read rather than recomputed here, so the deck and the
    // profile update the moment the lesson is finished with no separate
    // refresh step of their own.
    const [profile, stats, flashcards] = await Promise.all([
      api.me(),
      api.stats(),
      api.flashcards(),
    ])
    return { slug, completed, profile, stats, flashcards }
  },
)

/**
 * Ends a chat session, which is the other moment the deck changes: the server
 * writes whatever cards the conversation earned, then enqueues them onto it.
 * Also writes and returns a generated recap of the session — see
 * `api.endChat`. Re-read the deck for the same reason as above.
 */
export const endChatSession = createAsyncThunk(
  'app/endChatSession',
  async ({
    messages,
    brief,
    checks,
  }: {
    messages: ChatTurn[]
    brief: SessionBrief
    checks: { correct: number; total: number }
  }) => {
    const { cards_added, session } = await api.endChat(messages, brief, checks)
    // Nothing changed unless cards were written, and most short conversations
    // write none — so the common case costs no extra request.
    const flashcards = cards_added > 0 ? await api.flashcards() : null
    return { cards_added, session, flashcards }
  },
)

/** Past sessions, for the reader to look back on — recaps only. */
export const loadChatSessions = createAsyncThunk('app/chatSessions', () => api.chatSessions())

const slice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    /**
     * A profile the server handed back outside a fetch of its own — a chat turn
     * that revised it, for instance. Cheaper and more honest than refetching:
     * the response already carries the new copy.
     */
    profileReceived(state, action: PayloadAction<Profile>) {
      state.profile = action.payload
    },
    clearError(state) {
      state.error = null
    },
    reset() {
      return initialState
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadDashboard.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(loadDashboard.fulfilled, (state, action) => {
        state.loading = false
        state.profile = action.payload.profile
        state.stats = action.payload.stats
      })
      .addCase(loadDashboard.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message ?? 'Could not load your dashboard.'
      })
      .addCase(loadProfile.fulfilled, (state, action) => {
        state.profile = action.payload
      })
      .addCase(loadLessons.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(loadLessons.fulfilled, (state, action) => {
        state.loading = false
        state.lessons = action.payload
      })
      .addCase(loadLessons.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message ?? 'Could not load the lessons.'
      })
      .addCase(loadFlashcards.fulfilled, (state, action) => {
        state.flashcards = action.payload
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.profile = action.payload
      })
      .addCase(submitOnboarding.fulfilled, (state, action) => {
        state.profile = action.payload
      })
      .addCase(setLessonCompleted.fulfilled, (state, action) => {
        // The profile can have moved: finishing a lesson may revise what it
        // claims about the reader's experience or focus (see app/learner.py).
        state.profile = action.payload.profile
        state.stats = action.payload.stats
        state.flashcards = action.payload.flashcards
        const lesson = state.lessons.find((l) => l.slug === action.payload.slug)
        if (lesson) lesson.completed = action.payload.completed
      })
      .addCase(endChatSession.fulfilled, (state, action) => {
        if (action.payload.flashcards) state.flashcards = action.payload.flashcards
        state.chatSessions = [action.payload.session, ...state.chatSessions]
      })
      .addCase(loadChatSessions.fulfilled, (state, action) => {
        state.chatSessions = action.payload
      })
  },
})

export const { clearError, profileReceived, reset } = slice.actions

export const store = configureStore({ reducer: { app: slice.reducer } })

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
