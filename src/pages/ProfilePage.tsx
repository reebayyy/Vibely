import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { TopBar } from '../components/TopBar'
import { useAuth } from '../context/AuthContext'
import { ApiError, api } from '../lib/api'
import { assetUrl } from '../lib/config'
import { fileToDataUrl, initials, validateImage } from '../lib/images'

const MAX_PHOTOS = 9
const MAX_BIO_LENGTH = 300

export function ProfilePage() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState(user?.name ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [profilePic, setProfilePic] = useState(user?.profilePic ?? '')
  const [photos, setPhotos] = useState<string[]>(user?.photos ?? [])

  const [avatarUploading, setAvatarUploading] = useState(false)
  const [photosUploading, setPhotosUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const avatarInput = useRef<HTMLInputElement>(null)
  const photosInput = useRef<HTMLInputElement>(null)

  if (!user) return null

  const displayName = name.trim() || user.name

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    const problem = validateImage(file)
    if (problem) {
      setError(problem)
      return
    }

    setError(null)
    setAvatarUploading(true)

    try {
      const { url } = await api.uploadImage(await fileToDataUrl(file))
      setProfilePic(url)
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Upload failed. Please try again.',
      )
    } finally {
      setAvatarUploading(false)
    }
  }

  async function handlePhotosChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''

    if (files.length === 0) return

    const slots = MAX_PHOTOS - photos.length
    if (slots <= 0) {
      setError(`You can upload up to ${MAX_PHOTOS} photos.`)
      return
    }

    const accepted = files.slice(0, slots)

    for (const file of accepted) {
      const problem = validateImage(file)
      if (problem) {
        setError(problem)
        return
      }
    }

    setError(null)
    setPhotosUploading(true)

    const uploaded: string[] = []

    try {
      for (const file of accepted) {
        const { url } = await api.uploadImage(await fileToDataUrl(file))
        uploaded.push(url)
      }
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Upload failed. Please try again.',
      )
    } finally {
      if (uploaded.length > 0) {
        setPhotos((current) => [...current, ...uploaded].slice(0, MAX_PHOTOS))
      }
      setPhotosUploading(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSaving(true)

    try {
      const response = await api.updateProfile({
        name: name.trim(),
        bio: bio.trim(),
        profilePic,
        photos,
      })

      setUser(response.user)
      navigate('/feed', { state: { justSaved: true } })
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Could not save your profile.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <TopBar />

      <form className="card profile-card" onSubmit={handleSubmit}>
        <p className="eyebrow">Profile</p>
        <h1 className="page-title">Your profile</h1>
        <p className="muted">
          Add a photo and a few words about yourself. You can change this any time.
        </p>

        {error && (
          <p className="alert alert--error" role="alert">
            {error}
          </p>
        )}

        <div className="avatar-row">
          <div className="avatar">
            {profilePic ? (
              <img src={assetUrl(profilePic)} alt={`${displayName}'s profile`} />
            ) : (
              <span>{initials(displayName) || '?'}</span>
            )}
          </div>

          <div className="avatar-actions">
            <button
              type="button"
              className="btn btn--secondary btn--small"
              onClick={() => avatarInput.current?.click()}
              disabled={avatarUploading}
            >
              {avatarUploading ? 'Uploading…' : profilePic ? 'Change photo' : 'Upload photo'}
            </button>
            {profilePic && (
              <button
                type="button"
                className="link-button"
                onClick={() => setProfilePic('')}
              >
                Remove photo
              </button>
            )}
            <span className="hint">JPG, PNG, WebP or GIF · up to 4 MB</span>
          </div>

          <input
            ref={avatarInput}
            className="visually-hidden"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleAvatarChange}
          />
        </div>

        <div className="field">
          <label htmlFor="profile-name">Name</label>
          <input
            id="profile-name"
            className="input"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name"
            required
            minLength={2}
            maxLength={40}
          />
        </div>

        <div className="field">
          <div className="field__head">
            <label htmlFor="bio">Bio</label>
            <span className="char-count">
              {bio.length}/{MAX_BIO_LENGTH}
            </span>
          </div>
          <textarea
            id="bio"
            className="textarea"
            value={bio}
            onChange={(event) => setBio(event.target.value.slice(0, MAX_BIO_LENGTH))}
            placeholder="Tell people a little about yourself…"
            rows={4}
            maxLength={MAX_BIO_LENGTH}
          />
        </div>

        <div className="section-head">
          <div>
            <h2 className="section-title">Photos</h2>
            <p className="muted">Upload up to {MAX_PHOTOS} photos for your profile.</p>
          </div>
          <span className="char-count">
            {photos.length}/{MAX_PHOTOS}
          </span>
        </div>

        <div className="photo-grid">
          {photos.map((photo, index) => (
            <div className="photo-tile" key={photo}>
              <img src={assetUrl(photo)} alt={`Profile photo ${index + 1}`} />
              <button
                type="button"
                className="photo-remove"
                aria-label={`Remove photo ${index + 1}`}
                onClick={() =>
                  setPhotos((current) => current.filter((item) => item !== photo))
                }
              >
                ×
              </button>
            </div>
          ))}

          {photos.length < MAX_PHOTOS && (
            <button
              type="button"
              className="photo-add"
              onClick={() => photosInput.current?.click()}
              disabled={photosUploading}
            >
              {photosUploading ? (
                <span className="spinner" aria-hidden="true" />
              ) : (
                <span className="photo-add__plus" aria-hidden="true">
                  +
                </span>
              )}
              <span>{photosUploading ? 'Uploading…' : 'Add photos'}</span>
            </button>
          )}
        </div>

        <input
          ref={photosInput}
          className="visually-hidden"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          onChange={handlePhotosChange}
        />

        <div className="actions">
          <p className="hint">Photos are optional — you can add them later.</p>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={saving || avatarUploading || photosUploading}
          >
            {saving && <span className="spinner" aria-hidden="true" />}
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </form>
    </div>
  )
}
