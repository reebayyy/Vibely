export type User = {
  id: string
  name: string
  email: string
  bio: string
  profilePic: string
  photos: string[]
  profileCompleted: boolean
  createdAt?: string
}

export type Post = {
  id: string
  image: string
  caption: string
  createdAt: string
  author: {
    id: string
    name: string
    profilePic: string
  }
}

export type ProfileSummary = {
  id: string
  name: string
  bio: string
  profilePic: string
  photos: string[]
  createdAt?: string
}

export type UserSearchResult = {
  id: string
  name: string
  profilePic: string
  bio: string
}

export type ChatMessage = {
  id: string
  conversationId: string
  senderId: string
  text: string
  createdAt: string
}

export type Conversation = {
  id: string
  otherUser: {
    id: string
    name: string
    profilePic: string
  }
  lastMessage: {
    text: string
    senderId: string
    createdAt: string
  } | null
  lastMessageAt: string | null
  unreadCount: number
  createdAt: string
}

export type AuthResponse = {
  token: string
  user: User
}

export type ProfileInput = {
  name?: string
  bio?: string
  profilePic?: string
  photos?: string[]
}

const TOKEN_KEY = 'social-app.token'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function storeToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()

  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    throw new ApiError('Cannot reach the server. Is the API running?', 0)
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const statusMessages: Record<number, string> = {
      502: 'The API server is unavailable. Make sure it is running and connected to MongoDB.',
      503: 'The API server is temporarily unavailable. Please try again shortly.',
      504: 'The API server timed out. Please try again.',
    }

    throw new ApiError(
      typeof data?.error === 'string'
        ? data.error
        : (statusMessages[response.status] ?? `Request failed (${response.status}).`),
      response.status,
    )
  }

  return data as T
}

export const api = {
  register(input: { name: string; email: string; password: string }) {
    return request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: input,
    })
  },

  login(input: { email: string; password: string }) {
    return request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: input,
    })
  },

  me() {
    return request<{ user: User }>('/api/auth/me')
  },

  updateProfile(input: ProfileInput) {
    return request<{ user: User }>('/api/profile', { method: 'PUT', body: input })
  },

  listPosts() {
    return request<{ posts: Post[] }>('/api/posts')
  },

  getUserProfile(id: string) {
    return request<{ user: ProfileSummary; posts: Post[] }>(
      `/api/users/${encodeURIComponent(id)}`,
    )
  },

  createPost(input: { image: string; caption: string }) {
    return request<{ post: Post }>('/api/posts', { method: 'POST', body: input })
  },

  searchUsers(query: string) {
    return request<{ users: UserSearchResult[] }>(
      `/api/users?q=${encodeURIComponent(query)}`,
    )
  },

  listConversations() {
    return request<{ conversations: Conversation[] }>('/api/conversations')
  },

  openConversation(userId: string) {
    return request<{ conversation: Conversation }>('/api/conversations', {
      method: 'POST',
      body: { userId },
    })
  },

  listMessages(conversationId: string) {
    return request<{ messages: ChatMessage[] }>(
      `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
    )
  },

  sendMessage(conversationId: string, text: string) {
    return request<{ message: ChatMessage }>(
      `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
      { method: 'POST', body: { text } },
    )
  },

  markConversationRead(conversationId: string) {
    return request<{ ok: boolean }>(
      `/api/conversations/${encodeURIComponent(conversationId)}/read`,
      { method: 'POST' },
    )
  },

  uploadImage(data: string) {
    return request<{ url: string }>('/api/uploads', {
      method: 'POST',
      body: { data },
    })
  },
}
