import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { reset, store } from '../store'

interface AuthValue {
  session: Session | null
  /** Distinguishes "not signed in" from "we haven't checked yet". */
  ready: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue>({
  session: null,
  ready: false,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })

    // Fires on sign in, sign out, and every token refresh.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      // Drop the previous user's cached data so it can never appear under a
      // different account.
      if (event === 'SIGNED_OUT') store.dispatch(reset())
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, ready, signOut }}>{children}</AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
