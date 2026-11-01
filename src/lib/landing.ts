import type { User } from './api'

/** Where a signed-in user should land by default. */
export function landingPath(user: User): string {
  return user.profileCompleted ? '/feed' : '/profile'
}
