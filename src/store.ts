import { configureStore, createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { useDispatch, useSelector } from 'react-redux'
import { api } from './lib/api'
import type { LessonSummary, Profile, Stats } from './lib/api'

interface AppState {
  profile: Profile | null
  stats: Stats | null
  lessons: LessonSummary[]
  loading: boolean
  error: string | null
}

const initialState: AppState = {
  profile: null,
  stats: null,
  lessons: [],
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

export const updateProfile = createAsyncThunk(
  'app/updateProfile',
  (body: { display_name?: string | null; diagnosed_year?: number | null }) => api.updateMe(body),
)

export const setLessonCompleted = createAsyncThunk(
  'app/setLessonCompleted',
  async ({ slug, completed }: { slug: string; completed: boolean }) => {
    await api.setProgress(slug, completed)
    // Stats are derived server-side, so re-read rather than recompute here.
    return { slug, completed, stats: await api.stats() }
  },
)

const slice = createSlice({
  name: 'app',
  initialState,
  reducers: {
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
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.profile = action.payload
      })
      .addCase(setLessonCompleted.fulfilled, (state, action) => {
        state.stats = action.payload.stats
        const lesson = state.lessons.find((l) => l.slug === action.payload.slug)
        if (lesson) lesson.completed = action.payload.completed
      })
  },
})

export const { clearError, reset } = slice.actions

export const store = configureStore({ reducer: { app: slice.reducer } })

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
