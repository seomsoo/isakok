import { AuthService } from './AuthService'

let bootstrapped = false

export async function bootstrapAuth(): Promise<void> {
  if (bootstrapped) return
  bootstrapped = true
  try {
    const result = await AuthService.ensureAnonymousSession()
    // 일시 오류로 보류되면(sessionLifecycle이 백오프 재시도) 다음 bootstrapAuth 호출도 다시 시도할 수 있게 둔다.
    if (result === 'deferred') bootstrapped = false
  } catch (err) {
    bootstrapped = false
    throw err
  }
}
