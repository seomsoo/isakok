// Expo Push REST 호출 (12단계 §7-3). 외부 의존 없이 Deno fetch.
// ticket은 보낸 메시지와 같은 순서로 반환되므로 호출부가 평행 배열로 token에 매핑한다.

export interface ExpoMessage {
  to: string
  title: string
  body: string
  data: { route: string }
  channelId?: string
}

export interface ExpoTicket {
  status: 'ok' | 'error'
  id?: string
  message?: string
  details?: { error?: string }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * 메시지를 100개 청크로 Expo Push에 전송. 네트워크/HTTP/형식 오류 시 해당 청크를
 * error ticket으로 채워(메시지 수와 길이 일치) 호출부가 failed 처리하도록 한다.
 */
export async function sendExpoPush(messages: ExpoMessage[]): Promise<ExpoTicket[]> {
  const tickets: ExpoTicket[] = []
  for (const c of chunk(messages, 100)) {
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(c),
      })
      const body = (await res.json().catch(() => null)) as { data?: ExpoTicket[] } | null
      const data = body?.data
      if (Array.isArray(data) && data.length === c.length) {
        tickets.push(...data)
      } else {
        for (let i = 0; i < c.length; i++) {
          tickets.push({ status: 'error', message: 'malformed expo response' })
        }
      }
    } catch (e) {
      for (let i = 0; i < c.length; i++) {
        tickets.push({ status: 'error', message: e instanceof Error ? e.message : 'fetch failed' })
      }
    }
  }
  return tickets
}
