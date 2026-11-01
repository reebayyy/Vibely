import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { TopBar } from '../components/TopBar'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import {
  ApiError,
  api,
  type ChatMessage,
  type UserSearchResult,
} from '../lib/api'
import { assetUrl } from '../lib/config'
import { clockTime, timeAgo } from '../lib/format'
import { initials } from '../lib/images'
import { connectSocket } from '../lib/socket'

const MAX_MESSAGE_LENGTH = 2000

function describeError(caught: unknown, fallback: string) {
  return caught instanceof ApiError ? caught.message : fallback
}

export function MessagesPage() {
  const { user } = useAuth()
  const { conversations, loading, refresh, markReadLocal } = useChat()
  const { conversationId } = useParams()
  const navigate = useNavigate()

  const activeId = conversationId ?? ''
  const activeConversation =
    conversations.find((conversation) => conversation.id === activeId) ?? null

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesError, setMessagesError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [openingUserId, setOpeningUserId] = useState<string | null>(null)

  const messagesRef = useRef<HTMLDivElement>(null)

  // Load the history when a conversation is opened.
  useEffect(() => {
    if (!activeId) {
      setMessages([])
      setMessagesError(null)
      return
    }

    let cancelled = false
    setMessagesLoading(true)
    setMessagesError(null)

    api
      .listMessages(activeId)
      .then((response) => {
        if (cancelled) return
        setMessages(response.messages)
        markReadLocal(activeId)
        void api
          .markConversationRead(activeId)
          .then(() => refresh())
          .catch(() => undefined)
      })
      .catch((caught) => {
        if (!cancelled) {
          setMessagesError(
            describeError(caught, 'Could not load this conversation.'),
          )
        }
      })
      .finally(() => {
        if (!cancelled) setMessagesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeId, markReadLocal, refresh])

  // Append messages that arrive while this conversation is open.
  useEffect(() => {
    if (!activeId) return

    const socket = connectSocket()
    let hasConnected = socket.connected

    const reloadAfterReconnect = () => {
      if (!hasConnected) {
        hasConnected = true
        return
      }

      void api
        .listMessages(activeId)
        .then((response) => {
          setMessages(response.messages)
          markReadLocal(activeId)
          return api.markConversationRead(activeId).then(() => refresh())
        })
        .catch(() => undefined)
    }

    const handleNewMessage = (payload: { message: ChatMessage }) => {
      if (payload.message.conversationId !== activeId) return

      setMessages((current) =>
        current.some((message) => message.id === payload.message.id)
          ? current
          : [...current, payload.message],
      )

      markReadLocal(activeId)
      void api
        .markConversationRead(activeId)
        .then(() => refresh())
        .catch(() => undefined)
    }

    socket.on('connect', reloadAfterReconnect)
    socket.on('message:new', handleNewMessage)

    return () => {
      socket.off('connect', reloadAfterReconnect)
      socket.off('message:new', handleNewMessage)
    }
  }, [activeId, markReadLocal, refresh])

  // Keep the newest message in view.
  useEffect(() => {
    const element = messagesRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages, messagesLoading, activeId])

  // Debounced user search.
  useEffect(() => {
    if (!searchOpen) return

    const term = query.trim()
    if (!term) {
      setResults([])
      setSearching(false)
      return
    }

    let cancelled = false
    setSearching(true)
    setSearchError(null)

    const timer = window.setTimeout(() => {
      api
        .searchUsers(term)
        .then((response) => {
          if (!cancelled) setResults(response.users)
        })
        .catch((caught) => {
          if (!cancelled) {
            setSearchError(describeError(caught, 'Could not search for people.'))
          }
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, searchOpen])

  async function startConversation(person: UserSearchResult) {
    setOpeningUserId(person.id)
    setSearchError(null)

    try {
      const { conversation } = await api.openConversation(person.id)
      await refresh()
      setSearchOpen(false)
      setQuery('')
      setResults([])
      navigate(`/messages/${conversation.id}`)
    } catch (caught) {
      setSearchError(describeError(caught, 'Could not start this conversation.'))
    } finally {
      setOpeningUserId(null)
    }
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const text = draft.trim()
    if (!text || !activeId || sending) return

    setSending(true)
    setMessagesError(null)

    try {
      const { message } = await api.sendMessage(activeId, text)
      setMessages((current) =>
        current.some((existing) => existing.id === message.id)
          ? current
          : [...current, message],
      )
      setDraft('')
      void refresh()
    } catch (caught) {
      setMessagesError(describeError(caught, 'Could not send your message.'))
    } finally {
      setSending(false)
    }
  }

  function avatar(person: { name: string; profilePic: string }, className: string) {
    return (
      <div className={className}>
        {person.profilePic ? (
          <img src={assetUrl(person.profilePic)} alt="" />
        ) : (
          <span>{initials(person.name) || '?'}</span>
        )}
      </div>
    )
  }

  return (
    <div className="page page--messages">
      <TopBar />

      <div className="messages-head">
        <div>
          <p className="eyebrow">Direct messages</p>
          <h1 className="page-title">Messages</h1>
          <p className="muted">Private chats with one person at a time.</p>
        </div>

        <button
          type="button"
          className="btn btn--secondary btn--small"
          onClick={() => {
            setSearchOpen((open) => !open)
            setSearchError(null)
          }}
        >
          {searchOpen ? 'Close' : '+ New message'}
        </button>
      </div>

      {searchOpen && (
        <section className="card user-search" aria-label="Start a new conversation">
          <h2 className="section-title">New message</h2>
          <input
            className="input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value.slice(0, 50))}
            placeholder="Search people by name…"
            aria-label="Search people by name"
            maxLength={50}
            autoFocus
          />

          {searching && <p className="muted user-search__status">Searching…</p>}
          {searchError && (
            <p className="alert alert--error" role="alert">
              {searchError}
            </p>
          )}

          {!searching && query.trim() && results.length === 0 && !searchError && (
            <p className="muted user-search__status">No people found.</p>
          )}

          {!query.trim() && (
            <p className="muted user-search__status">
              Type a name to find someone to message.
            </p>
          )}

          {results.length > 0 && (
            <div className="user-search__results">
              {results.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  className="user-result"
                  onClick={() => void startConversation(person)}
                  disabled={openingUserId !== null}
                >
                  {avatar(person, 'post__avatar')}
                  <span className="user-result__meta">
                    <span className="user-result__name">{person.name}</span>
                    <span className="user-result__bio">
                      {person.bio || 'No bio yet.'}
                    </span>
                  </span>
                  <span className="user-result__action">
                    {openingUserId === person.id ? 'Opening…' : 'Message'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="messages-layout">
        <aside
          className={`card conversation-list ${
            activeId ? 'conversation-list--hidden-mobile' : ''
          }`}
        >
          <h2 className="section-title conversation-list__title">Inbox</h2>

          {loading && conversations.length === 0 && (
            <p className="muted conversation-list__empty">Loading conversations…</p>
          )}

          {!loading && conversations.length === 0 && (
            <p className="muted conversation-list__empty">
              No conversations yet. Start one with “New message”.
            </p>
          )}

          {conversations.map((conversation) => (
            <Link
              key={conversation.id}
              to={`/messages/${conversation.id}`}
              className={`conversation-item ${
                conversation.id === activeId ? 'conversation-item--active' : ''
              }`}
            >
              {avatar(conversation.otherUser, 'conversation-item__avatar')}

              <span className="conversation-item__body">
                <span className="conversation-item__name">
                  {conversation.otherUser.name}
                </span>
                <span className="conversation-item__preview">
                  {conversation.lastMessage?.text ?? 'Say hello'}
                </span>
              </span>

              <span className="conversation-item__meta">
                {conversation.lastMessageAt && (
                  <span className="post__time">
                    {timeAgo(conversation.lastMessageAt)}
                  </span>
                )}
                {conversation.unreadCount > 0 && (
                  <span className="unread-badge">{conversation.unreadCount}</span>
                )}
              </span>
            </Link>
          ))}
        </aside>

        <section className="card chat" aria-label="Conversation">
          {!activeId && (
            <div className="chat__empty">
              <p className="section-title">Select a conversation</p>
              <p className="muted">
                Pick a chat on the left, or start a new message.
              </p>
            </div>
          )}

          {activeId && !activeConversation && loading && (
            <div className="chat__empty">
              <p className="muted">Loading conversation…</p>
            </div>
          )}

          {activeId && !activeConversation && !loading && (
            <div className="chat__empty">
              <p className="section-title">Conversation unavailable</p>
              <p className="muted">
                It may have been removed, or you are not part of it.
              </p>
              <Link to="/messages" className="link-button">
                Back to messages
              </Link>
            </div>
          )}

          {activeConversation && (
            <>
              <header className="chat__head">
                <Link
                  to={`/users/${activeConversation.otherUser.id}`}
                  className="chat__person"
                >
                  {avatar(activeConversation.otherUser, 'post__avatar')}
                  <span className="chat__person-name">
                    {activeConversation.otherUser.name}
                  </span>
                </Link>

                <Link to="/messages" className="link-button chat__back">
                  ← All messages
                </Link>
              </header>

              <div className="chat__messages" ref={messagesRef}>
                {messagesLoading && (
                  <p className="muted chat__status">Loading messages…</p>
                )}

                {!messagesLoading && messages.length === 0 && !messagesError && (
                  <p className="muted chat__status">
                    No messages yet. Say hello 👋
                  </p>
                )}

                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`chat-bubble ${
                      message.senderId === user?.id ? 'chat-bubble--mine' : ''
                    }`}
                  >
                    <span className="chat-bubble__text">{message.text}</span>
                    <span className="chat-bubble__time">
                      {clockTime(message.createdAt)}
                    </span>
                  </div>
                ))}
              </div>

              {messagesError && (
                <p className="alert alert--error chat__error" role="alert">
                  {messagesError}
                </p>
              )}

              <form className="chat__form" onSubmit={handleSend}>
                <input
                  className="input"
                  type="text"
                  value={draft}
                  onChange={(event) =>
                    setDraft(event.target.value.slice(0, MAX_MESSAGE_LENGTH))
                  }
                  placeholder="Write a message…"
                  aria-label="Message"
                  maxLength={MAX_MESSAGE_LENGTH}
                />
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={sending || !draft.trim()}
                >
                  {sending ? 'Sending…' : 'Send'}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
