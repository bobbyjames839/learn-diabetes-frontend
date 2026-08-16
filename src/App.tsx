import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './auth/AuthProvider'
import { loadProfile, submitOnboarding, useAppDispatch, useAppSelector } from './store'
import { Button } from './components/ui'
import type { OnboardingAnswers } from './lib/api'
import { Avatar, Container, Spinner } from './components/ui'
import Onboarding from './components/Onboarding'
import Home from './pages/Home'
import Lessons from './pages/Lessons'
import Flashcards from './pages/Flashcards'
import Login from './pages/Login'

// The markdown renderer is only needed on the reader, and most sessions never
// open the tutor, so keep both out of the initial bundle.
const LessonDetail = lazy(() => import('./pages/LessonDetail'))
const Chat = lazy(() => import('./pages/Chat'))

const NAV = [
  { to: '/', label: 'Overview' },
  { to: '/lessons', label: 'Lessons' },
  { to: '/flashcards', label: 'Flashcards' },
  { to: '/chat', label: 'Tutor' },
]

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth()
  if (!ready) return <Spinner />
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

function Header() {
  const { session, signOut } = useAuth()
  const profile = useAppSelector((s) => s.app.profile)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // The session is guaranteed here (RequireAuth) and always carries an email, so
  // fall back to that rather than to a placeholder like "You".
  const email = profile?.email ?? session?.user.email ?? ''
  const name = profile?.display_name || email.split('@')[0]

  useEffect(() => {
    if (!menuOpen) return
    function onClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [menuOpen])

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-cream/85 backdrop-blur">
      <Container className="flex h-16 items-center gap-8">
        <NavLink to="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber text-sm font-bold text-white">
            L
          </span>
          <span className="hidden text-[15px] font-bold tracking-tight sm:block">
            Learn Diabetes
          </span>
        </NavLink>

        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  isActive ? 'bg-cream-deep text-ink' : 'text-ink-soft hover:text-ink'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex cursor-pointer items-center gap-2 rounded-full py-1 pl-1 pr-3 transition hover:bg-cream-deep"
          >
            <Avatar name={name} size={30} />
            <span className="hidden text-sm font-semibold sm:block">{name}</span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-line bg-card py-1 shadow-lg">
              <p className="truncate px-3 py-2 text-xs text-ink-soft">{email}</p>
              <button
                onClick={signOut}
                className="w-full cursor-pointer px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-cream-deep"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </Container>
    </header>
  )
}

// Matches the reader (/lessons/some-slug) but not the list (/lessons).
const LESSON_READER = /^\/lessons\/[^/]+$/

// Pages that own the full height of the window: the page itself never scrolls,
// only the region inside it does. The lesson reader scrolls normally.
//
// Only from `lg` up — on a phone these are taller than the window and pinning
// them would cut them off.
const FIXED_HEIGHT = ['/', '/lessons']

// The tutor, at every width. A session covers the whole window from inside the
// page anyway (`fixed inset-0`), so pinning its setup screen too is what keeps
// the two the same size: without it the page is 100vh once a session starts and
// document-height before, which is a visible jump on the way in and out.
// `Chat` fits itself to the height it's given and scrolls its own middle.
const ALWAYS_FIXED_HEIGHT = ['/chat']

function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const { signOut } = useAuth()
  const dispatch = useAppDispatch()
  const profile = useAppSelector((s) => s.app.profile)
  const profileError = useAppSelector((s) => s.app.profileError)
  const [onboardingError, setOnboardingError] = useState<string | null>(null)
  const [onboardingSaving, setOnboardingSaving] = useState(false)

  // Every authenticated page needs the profile for the header, not just the
  // Overview — otherwise a hard refresh on /lessons leaves it empty.
  useEffect(() => {
    if (!profile) dispatch(loadProfile())
  }, [dispatch, profile])

  // A Supabase session only proves sign-in succeeded — it says nothing about
  // whether the backend is reachable (wrong CORS origin, the server being
  // down). Block here rather than rendering pages against a profile that
  // never loaded, which would otherwise look like a signed-in but silently
  // broken app.
  if (!profile && profileError) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-lg font-bold tracking-tight">Couldn't reach the server</h1>
        <p className="max-w-sm text-sm text-ink-soft">{profileError}</p>
        <div className="flex gap-3">
          <Button onClick={() => dispatch(loadProfile())}>Try again</Button>
          <button
            onClick={signOut}
            className="cursor-pointer px-3 py-2 text-sm font-semibold text-ink-soft underline underline-offset-4"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  async function handleOnboarding(answers: OnboardingAnswers) {
    setOnboardingSaving(true)
    setOnboardingError(null)
    try {
      await dispatch(submitOnboarding(answers)).unwrap()
    } catch (e) {
      setOnboardingError(e instanceof Error ? e.message : 'Could not save your answers.')
    } finally {
      setOnboardingSaving(false)
    }
  }

  const pinnedAtAllWidths = ALWAYS_FIXED_HEIGHT.includes(pathname)
  const fixedHeight = pinnedAtAllWidths || FIXED_HEIGHT.includes(pathname)

  // A lesson is a place you're in, not a page you're on. No site nav, no
  // account menu, nothing pulling attention away — the only ways out are the
  // reader's own exit control or finishing it.
  const inLesson = LESSON_READER.test(pathname)

  return (
    <div
      className={`flex min-h-full flex-col ${
        pinnedAtAllWidths
          ? 'h-full overflow-hidden'
          : fixedHeight
            ? 'lg:h-full lg:overflow-hidden'
            : ''
      }`}
    >
      {!inLesson && <Header />}
      <main className={`flex-1 ${pinnedAtAllWidths ? 'min-h-0' : fixedHeight ? 'lg:min-h-0' : ''}`}>
        <Container
          className={pinnedAtAllWidths ? 'h-full py-8' : fixedHeight ? 'py-8 lg:h-full' : 'py-10'}
        >
          {children}
        </Container>
      </main>
      {/* Mandatory, and only decided once the profile has actually loaded —
          showing it against a null profile would flash it for every reader
          for a frame before the real check-in request even lands. */}
      {profile && !profile.onboarding_completed_at && (
        <Onboarding
          name={profile.display_name || profile.email?.split('@')[0] || ''}
          submitting={onboardingSaving}
          error={onboardingError}
          onSubmit={handleOnboarding}
        />
      )}
    </div>
  )
}

export default function App() {
  const { session, ready } = useAuth()

  if (!ready) return <Spinner />

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="*"
        element={
          <RequireAuth>
            <Shell>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/lessons" element={<Lessons />} />
                <Route path="/flashcards" element={<Flashcards />} />
                <Route
                  path="/chat"
                  element={
                    <Suspense fallback={<Spinner label="Loading tutor…" />}>
                      <Chat />
                    </Suspense>
                  }
                />
                <Route
                  path="/lessons/:slug"
                  element={
                    <Suspense fallback={<Spinner label="Loading lesson…" />}>
                      <LessonDetail />
                    </Suspense>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Shell>
          </RequireAuth>
        }
      />
    </Routes>
  )
}
