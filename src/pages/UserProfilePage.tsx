import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { TopBar } from '../components/TopBar'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import { ApiError, api, type Post, type ProfileSummary } from '../lib/api'
import { timeAgo } from '../lib/format'
import { initials } from '../lib/images'

export function UserProfilePage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const { refresh } = useChat()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<ProfileSummary | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [startingMessage, setStartingMessage] = useState(false)
  const [messageError, setMessageError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    api
      .getUserProfile(id)
      .then((response) => {
        if (cancelled) return
        setProfile(response.user)
        setPosts(response.posts)
      })
      .catch((caught) => {
        if (cancelled) return
        setError(
          caught instanceof ApiError
            ? caught.message
            : 'Could not load this profile.',
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  async function startConversation() {
    if (!profile) return

    setStartingMessage(true)
    setMessageError(null)

    try {
      const { conversation } = await api.openConversation(profile.id)
      await refresh()
      navigate(`/messages/${conversation.id}`)
    } catch (caught) {
      setMessageError(
        caught instanceof ApiError
          ? caught.message
          : 'Could not open a conversation with this person.',
      )
    } finally {
      setStartingMessage(false)
    }
  }

  return (
    <div className="page">
      <TopBar />

      <p className="breadcrumb">
        <Link to="/feed" className="link-button">
          ← Back to feed
        </Link>
      </p>

      {loading && <p className="muted feed__status">Loading profile…</p>}

      {error && (
        <div className="card empty">
          <p className="section-title">Profile unavailable</p>
          <p className="muted">{error}</p>
        </div>
      )}

      {profile && (
        <>
          <section className="card profile-view">
            <div className="avatar-row">
              <div className="avatar">
                {profile.profilePic ? (
                  <img src={profile.profilePic} alt={`${profile.name}'s profile`} />
                ) : (
                  <span>{initials(profile.name) || '?'}</span>
                )}
              </div>

              <div className="profile-view__intro">
                <h1 className="page-title">{profile.name}</h1>
                <p className="muted">{profile.bio || 'No bio yet.'}</p>

                {user?.id !== profile.id && (
                  <button
                    type="button"
                    className="btn btn--secondary btn--small profile-view__message"
                    onClick={() => void startConversation()}
                    disabled={startingMessage}
                  >
                    {startingMessage ? 'Opening…' : 'Message'}
                  </button>
                )}

                {messageError && (
                  <p className="alert alert--error" role="alert">
                    {messageError}
                  </p>
                )}
              </div>
            </div>

            {profile.photos.length > 0 && (
              <>
                <div className="section-head">
                  <h2 className="section-title">Photos</h2>
                </div>
                <div className="photo-grid">
                  {profile.photos.map((photo, index) => (
                    <div className="photo-tile" key={photo}>
                      <img
                        src={photo}
                        alt={`${profile.name} photo ${index + 1}`}
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <h2 className="section-title feed-section-title">Posts</h2>

          <section className="feed" aria-label={`${profile.name}'s posts`}>
            {posts.length === 0 && (
              <div className="card empty">
                <p className="muted">No posts yet.</p>
              </div>
            )}

            {posts.map((post) => (
              <article className="card post" key={post.id}>
                <img
                  className="post__image"
                  src={post.image}
                  alt={post.caption || `Photo shared by ${profile.name}`}
                  loading="lazy"
                />
                {post.caption && <p className="post__caption">{post.caption}</p>}
                <span className="post__time post__timestamp">
                  {timeAgo(post.createdAt)}
                </span>
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
