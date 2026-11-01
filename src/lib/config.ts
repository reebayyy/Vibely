// Base URL of the Express API. Leave empty for local development (Vite
// proxies /api, /uploads and /socket.io), or set VITE_API_URL in production.
export const API_BASE = (import.meta.env.VITE_API_URL ?? '')
  .trim()
  .replace(/\/+$/, '')

export const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL ?? '').trim() || API_BASE

export function assetUrl(path: string): string {
  if (!path) return ''
  if (/^(?:https?:)?\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
    return path
  }
  if (!API_BASE) return path

  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
}
