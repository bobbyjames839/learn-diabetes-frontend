import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui'

type Mode = 'signin' | 'signup'

const POINTS = [
  {
    title: 'Mechanisms, not rules',
    body: 'Why a high-fat meal shows up hours later, why a sprint can push glucose up, why a correction on top of active insulin ends in a low.',
  },
  {
    title: 'Short, focused lessons',
    body: 'Each one takes a few minutes and covers a single idea, with a worked example using hypothetical numbers.',
  },
  {
    title: 'Track what you have covered',
    body: 'Your progress, streak and remaining lessons are saved to your account.',
  },
]

export default function Login() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName.trim() || null } },
        })
        if (error) throw error
        // With email confirmation on, there's no session until the link is clicked.
        if (!data.session) {
          setNotice('Check your email for a confirmation link, then sign in.')
          setMode('signin')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
      // On success the AuthProvider's listener swaps the route.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      {/* Pitch */}
      <div className="hidden flex-col justify-between bg-cream-deep px-12 py-12 lg:flex xl:px-20">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber text-sm font-bold text-white">
            L
          </span>
          <span className="text-[15px] font-bold tracking-tight">Learn Diabetes</span>
        </div>

        <div className="max-w-md">
          <h1 className="text-4xl font-bold leading-[1.15] tracking-tight">
            Understand how glucose actually behaves.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-soft">
            A short course on the mechanisms behind type 1 diabetes — carbohydrate, insulin timing,
            exercise, illness and the patterns they create.
          </p>

          <dl className="mt-10 space-y-6">
            {POINTS.map((p) => (
              <div key={p.title} className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                <div>
                  <dt className="text-sm font-bold">{p.title}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-ink-soft">{p.body}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm rise">
          <div className="mb-8 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber text-base font-bold text-white">
              L
            </span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="mt-1.5 text-sm text-ink-soft">
            {mode === 'signin'
              ? 'Sign in to pick up where you left off.'
              : 'Free, and your progress is saved as you go.'}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === 'signup' && (
              <Field
                label="Name"
                value={displayName}
                onChange={setDisplayName}
                type="text"
                placeholder="Bobby"
                autoComplete="name"
              />
            )}
            <Field
              label="Email"
              value={email}
              onChange={setEmail}
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
            <Field
              label="Password"
              value={password}
              onChange={setPassword}
              type="password"
              placeholder="At least 6 characters"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
              minLength={6}
            />

            {error && (
              <p role="alert" className="rounded-lg bg-berry-wash px-3 py-2.5 text-sm text-berry">
                {error}
              </p>
            )}
            {notice && (
              <p className="rounded-lg bg-sage-wash px-3 py-2.5 text-sm text-sage">{notice}</p>
            )}

            <Button type="submit" disabled={busy} className="w-full py-3">
              {busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-soft">
            {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin')
                setError(null)
              }}
              className="cursor-pointer font-semibold text-amber-deep underline underline-offset-4"
            >
              {mode === 'signin' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  ...props
}: {
  label: string
  value: string
  onChange: (v: string) => void
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-ink-soft">{label}</span>
      <input
        {...props}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-line bg-card px-3.5 py-2.5 text-sm outline-none transition focus:border-amber focus:ring-2 focus:ring-amber/15"
      />
    </label>
  )
}
