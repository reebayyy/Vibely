import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'

import { useAuth } from '../context/AuthContext'
import { landingPath } from '../lib/landing'
import { PageLoader } from './PageLoader'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth()
  const location = useLocation()

  if (initializing) return <PageLoader />
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}

export function PublicOnly({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth()

  if (initializing) return <PageLoader />
  if (user) return <Navigate to={landingPath(user)} replace />

  return <>{children}</>
}

export function RootRedirect() {
  const { user, initializing } = useAuth()

  if (initializing) return <PageLoader />
  if (!user) return <Navigate to="/login" replace />

  return <Navigate to={landingPath(user)} replace />
}
