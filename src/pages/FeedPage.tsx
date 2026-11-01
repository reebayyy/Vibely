import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { TopBar } from '../components/TopBar'
import { useAuth } from '../context/AuthContext'
import { ApiError, api, type Post } from '../lib/api'
import { timeAgo } from '../lib/format'
import { fileToDataUrl, initials, validateImage } from '../lib/images'

const MAX_CAPTION_LENGTH = 300

export function FeedPage() {
  const { user } = useAuth()
  const location = useLocation()

  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [caption, setCaption] = useState('')
  const [posting, setPosting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [showSaved] = useState(
    Boolean((location.state as { justSaved?: boolean } | null)?.justSaved),
  )

  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false

    api
      .listPosts()
      .then((response) => {
        if (!cancelled) setPosts(response.posts)
      })
      .catch((caught) => {
        if (!cancelled) {
          setLoadError(
            caught instanceof ApiError ? caught.message : 'Could not load the feed.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0]
    if (!picked) return

    const problem = validateImage(picked)
    if (problem) {
      setFormError(problem)
      event.target.value = ''
      return
    }

    setFormError(null)
    setFile(picked)
    setPreview(await fileToDataUrl(picked))
  }

  function clearComposer() {
    setFile(null)
    setPreview('')
    setCaption('')
    if (fileInput.current) fileInput.current.value = ''
  }

  async function handlePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!file) {
      setFormError('Choose an image to post.')
      return
    }

    setFormError(null)
    setPosting(true)

    try {
      const { url } = await api.uploadImage(await fileToDataUrl(file))
      const { post } = await api.createPost({ image: url, caption: caption.trim() })
      setPosts((current) => [post, ...current])
      clearComposer()
    } catch (caught) {
      setFormError(
        caught instanceof ApiError ? caught.message : 'Could not publish your post.',
      )
    } finally {
      setPosting(false)
    }
  }

  if (!user) return null

  return (
    <div className="page">
      <TopBar />

      {showSaved && (
        <p className="alert alert--success" role="status">
          Profile saved. Welcome to the feed!
        </p>
      )}

      <div className="feed-head">
        <p className="eyebrow">Community</p>
        <h1 className="page-title">Feed</h1>
        <p className="muted">See what everyone is sharing.</p>
      </div>

      <form className="card composer" onSubmit={handlePost}>
        <h2 className="section-title">Share a photo</h2>

        {preview ? (
          <div className="composer__preview">
            <img src={preview} alt="Selected photo preview" />
            <button type="button" className="link-button" onClick={clearComposer}>
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="composer__picker"
            onClick={() => fileInput.current?.click()}
          >
            + Choose an image
          </button>
        )}

        <input
          ref={fileInput}
          className="visually-hidden"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleFileChange}
        />

        <div className="field">
          <label htmlFor="caption">Caption (optional)</label>
          <input
            id="caption"
            className="input"
            type="text"
            value={caption}
            onChange={(event) =>
              setCaption(event.target.value.slice(0, MAX_CAPTION_LENGTH))
            }
            placeholder="Say something about this photo…"
            maxLength={MAX_CAPTION_LENGTH}
          />
        </div>

        {formError && (
          <p className="alert alert--error" role="alert">
            {formError}
          </p>
        )}

        <div className="composer__actions">
          <span className="char-count">
            {caption.length}/{MAX_CAPTION_LENGTH}
          </span>
          <button type="submit" className="btn btn--primary" disabled={posting}>
            {posting && <span className="spinner" aria-hidden="true" />}
            {posting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </form>

      <section className="feed" aria-label="Posts">
        {loading && <p className="muted feed__status">Loading feed…</p>}

        {loadError && (
          <p className="alert alert--error" role="alert">
            {loadError}
          </p>
        )}

        {!loading && !loadError && posts.length === 0 && (
          <div className="card empty">
            <p className="section-title">No posts yet</p>
            <p className="muted">Be the first to share a photo.</p>
          </div>
        )}

        {posts.map((post) => (
          <article className="card post" key={post.id}>
            <Link to={`/users/${post.author.id}`} className="post__head post__link">
              <div className="post__avatar">
                {post.author.profilePic ? (
                  <img src={post.author.profilePic} alt="" />
                ) : (
                  <span>{initials(post.author.name) || '?'}</span>
                )}
              </div>
              <div className="post__meta">
                <span className="post__author">{post.author.name}</span>
                <span className="post__time">{timeAgo(post.createdAt)}</span>
              </div>
            </Link>

            <img
              className="post__image"
              src={post.image}
              alt={post.caption || `Photo shared by ${post.author.name}`}
              loading="lazy"
            />

            {post.caption && <p className="post__caption">{post.caption}</p>}
          </article>
        ))}
      </section>
    </div>
  )
}
