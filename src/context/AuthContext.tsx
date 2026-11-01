import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  api,
  clearToken,
  getToken,
  storeToken,
  type User,
} from '../lib/api'

type AuthContextValue = {
  user: User | null
  initializing: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<void>
  signOut: () => void
  setUser: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)
  const [initializing, setInitializing] = useState(() => Boolean(getToken()))

  useEffect(() => {
    if (!getToken()) {
      setInitializing(false)
      return
    }

    let cancelled = false

    api
      .me()
      .then((response) => {
        if (!cancelled) setUserState(response.user)
      })
      .catch(() => {
        clearToken()
      })
      .finally(() => {
        if (!cancelled) setInitializing(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function signIn(email: string, password: string) {
    const response = await api.login({ email, password })
    storeToken(response.token)
    setUserState(response.user)
  }

  async function signUp(name: string, email: string, password: string) {
    const response = await api.register({ name, email, password })
    storeToken(response.token)
    setUserState(response.user)
  }

  function signOut() {
    clearToken()
    setUserState(null)
  }

  function setUser(nextUser: User) {
    setUserState(nextUser)
  }

  const value = useMemo(
    () => ({ user, initializing, signIn, signUp, signOut, setUser }),
    [user, initializing],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.')
  }

  return context
}
