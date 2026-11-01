import { useState, type FormEvent } from 'react'

import { useAuth } from '../context/AuthContext'
import { ApiError } from '../lib/api'

export function AuthPage() {
  const { signIn, signUp } = useAuth()

  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const isLogin = mode === 'login'

  function switchMode(next: 'login' | 'signup') {
    setMode(next)
    setError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSaving(true)

    try {
      if (isLogin) {
        await signIn(email.trim(), password)
      } else {
        await signUp(name.trim(), email.trim(), password)
      }
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Something went wrong. Please try again.',
      )
      setSaving(false)
    }
  }

  return (
    <div className="page page--auth">
      <header className="brand brand--center">
        <span className="brand__mark" aria-hidden="true">
          S
        </span>
        <span className="brand__name">Social App</span>
      </header>

      <section className="card auth-card">
        <p className="eyebrow">{isLogin ? 'Welcome back' : 'Join the community'}</p>
        <h1 className="auth-title">{isLogin ? 'Sign in' : 'Create your account'}</h1>
        <p className="muted">
          {isLogin
            ? 'Sign in to set up your profile.'
            : 'Create an account to build your profile.'}
        </p>

        {error && (
          <p className="alert alert--error" role="alert">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="field">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                className="input"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                autoComplete="name"
                required
                minLength={2}
                maxLength={40}
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={isLogin ? 'Your password' : 'At least 8 characters'}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              required
              minLength={isLogin ? undefined : 8}
            />
          </div>

          <button className="btn btn--primary btn--block" type="submit" disabled={saving}>
            {saving && <span className="spinner" aria-hidden="true" />}
            {saving ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          {isLogin ? 'New here? ' : 'Already have an account? '}
          <button
            type="button"
            className="link-button"
            onClick={() => switchMode(isLogin ? 'signup' : 'login')}
          >
            {isLogin ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </section>
    </div>
  )
}
