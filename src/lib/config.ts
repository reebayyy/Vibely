// Base URL of the API. Leave empty when the API is served from the same
// Vercel project (recommended); set VITE_API_URL only for a separate API host.
export const API_BASE = (import.meta.env.VITE_API_URL ?? '')
  .trim()
  .replace(/\/+$/, '')

export function assetUrl(path: string): string {
  if (!path) return ''
  if (/^(?:https?:)?\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
    return path
  }
  if (!API_BASE) return path

  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
}
