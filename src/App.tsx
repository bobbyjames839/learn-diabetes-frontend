import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './auth/AuthProvider'
import { loadProfile, useAppDispatch, useAppSelector } from './store'
import { Avatar, Container, Spinner } from './components/ui'
import Home from './pages/Home'
import Lessons from './pages/Lessons'
import Login from './pages/Login'
import Quizzes from './pages/Quizzes'

// The markdown renderer is only needed on the reader, so keep it out of the
// initial bundle.
const LessonDetail = lazy(() => import('./pages/LessonDetail'))

const NAV = [
  { to: '/', label: 'Overview' },
  { to: '/lessons', label: 'Lessons' },
  { to: '/quizzes', label: 'Quizzes' },
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
        <NavLink to="/" className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber text-sm font-bold text-white">
            L
          </span>
          <span className="text-[15px] font-bold tracking-tight">Learn Diabetes</span>
        </NavLink>

        <nav className="flex flex-1 items-center gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  isActive ? 'bg-cream-deep text-ink' : 'text-ink-soft hover:text-ink'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="relative" ref={menuRef}>
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

function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const dispatch = useAppDispatch()
  const profile = useAppSelector((s) => s.app.profile)

  // Every authenticated page needs the profile for the header, not just the
  // Overview — otherwise a hard refresh on /lessons leaves it empty.
  useEffect(() => {
    if (!profile) dispatch(loadProfile())
  }, [dispatch, profile])

  // Overview and Lessons are fixed-height panels on desktop — the page itself
  // never scrolls, only the list inside them does. The reader scrolls normally.
  const fixedHeight = pathname === '/' || pathname === '/lessons'

  return (
    <div
      className={`flex min-h-full flex-col ${fixedHeight ? 'lg:h-full lg:overflow-hidden' : ''}`}
    >
      <Header />
      <main className={`flex-1 ${fixedHeight ? 'lg:min-h-0' : ''}`}>
        <Container className={fixedHeight ? 'py-8 lg:h-full' : 'py-10'}>{children}</Container>
      </main>
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
                <Route
                  path="/lessons/:slug"
                  element={
                    <Suspense fallback={<Spinner label="Loading lesson…" />}>
                      <LessonDetail />
                    </Suspense>
                  }
                />
                <Route path="/quizzes" element={<Quizzes />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Shell>
          </RequireAuth>
        }
      />
    </Routes>
  )
}
