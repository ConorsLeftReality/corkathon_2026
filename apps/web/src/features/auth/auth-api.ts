import { z } from 'zod'
import { apiRequest } from '#src/api/api-client.ts'

const userSchema = z.object({ id: z.number(), email: z.string() })
const userResponse = z.object({ user: userSchema })

export type User = z.infer<typeof userSchema>
export type Credentials = { email: string; password: string }

export async function fetchCurrentUser(): Promise<User> {
  const { user } = await apiRequest('/api/auth/me', userResponse)
  return user
}

export async function signIn(credentials: Credentials): Promise<User> {
  const options = { method: 'POST', body: credentials } as const
  const { user } = await apiRequest('/api/auth/login', userResponse, options)
  return user
}

export async function register(credentials: Credentials): Promise<User> {
  const options = { method: 'POST', body: credentials } as const
  const { user } = await apiRequest('/api/auth/register', userResponse, options)
  return user
}

export async function signOut(): Promise<void> {
  await apiRequest('/api/auth/logout', z.undefined(), { method: 'POST' })
}
