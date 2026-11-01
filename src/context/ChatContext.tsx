import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { api, type Conversation } from '../lib/api'
import { useAuth } from './AuthContext'

type ChatContextValue = {
  conversations: Conversation[]
  loading: boolean
  unreadTotal: number
  refresh: () => Promise<void>
  markReadLocal: (conversationId: string) => void
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!user) {
      setConversations([])
      return
    }

    const response = await api.listConversations().catch(() => null)
    if (response) setConversations(response.conversations)
  }, [user])

  useEffect(() => {
    if (!user) {
      setConversations([])
      return
    }

    let cancelled = false
    let inFlight = false

    setLoading(true)
    void refresh().finally(() => {
      if (!cancelled) setLoading(false)
    })

    const poll = () => {
      if (cancelled || inFlight || document.visibilityState !== 'visible') return
      inFlight = true
      void refresh().finally(() => {
        inFlight = false
      })
    }

    const timer = window.setInterval(poll, 4000)
    const handleVisible = () => {
      if (document.visibilityState === 'visible') poll()
    }

    document.addEventListener('visibilitychange', handleVisible)
    window.addEventListener('focus', handleVisible)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisible)
      window.removeEventListener('focus', handleVisible)
    }
  }, [user, refresh])

  const markReadLocal = useCallback((conversationId: string) => {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, unreadCount: 0 }
          : conversation,
      ),
    )
  }, [])

  const unreadTotal = conversations.reduce(
    (total, conversation) => total + conversation.unreadCount,
    0,
  )

  const value = useMemo(
    () => ({ conversations, loading, unreadTotal, refresh, markReadLocal }),
    [conversations, loading, unreadTotal, refresh, markReadLocal],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat(): ChatContextValue {
  const context = useContext(ChatContext)

  if (!context) {
    throw new Error('useChat must be used inside <ChatProvider>.')
  }

  return context
}
