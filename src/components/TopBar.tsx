import { NavLink } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'nav__link nav__link--active' : 'nav__link'

export function TopBar() {
  const { user, signOut } = useAuth()
  const { unreadTotal } = useChat()

  return (
    <header className="topbar">
      <div className="topbar__left">
        <NavLink to="/feed" className="brand">
          <span className="brand__mark" aria-hidden="true">
            S
          </span>
          <span className="brand__name">Social App</span>
        </NavLink>

        <nav className="nav" aria-label="Main">
          <NavLink to="/feed" className={linkClass}>
            Feed
          </NavLink>
          <NavLink to="/profile" className={linkClass}>
            Profile
          </NavLink>
          <NavLink to="/messages" className={linkClass}>
            Messages
            {unreadTotal > 0 && (
              <span className="nav__badge" aria-label={`${unreadTotal} unread`}>
                {unreadTotal > 99 ? '99+' : unreadTotal}
              </span>
            )}
          </NavLink>
        </nav>
      </div>

      <div className="topbar__right">
        {user && <span className="topbar__email">{user.email}</span>}
        <button type="button" className="btn btn--ghost btn--small" onClick={signOut}>
          Sign out
        </button>
      </div>
    </header>
  )
}
