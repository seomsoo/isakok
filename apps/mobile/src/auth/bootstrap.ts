import { AuthService } from './AuthService'

let bootstrapped = false

export async function bootstrapAuth(): Promise<void> {
  if (bootstrapped) return
  bootstrapped = true
  try {
    await AuthService.ensureAnonymousSession()
  } catch (err) {
    bootstrapped = false
    throw err
  }
}
