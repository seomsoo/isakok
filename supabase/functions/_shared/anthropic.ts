export async function callAnthropic({
  model,
  messages,
  max_tokens,
  timeoutMs,
}: {
  model: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  max_tokens: number
  timeoutMs: number
}): Promise<{
  content: string
  usage: { input_tokens: number; output_tokens: number }
  stop_reason: string | null
}> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model, messages, max_tokens }),
      signal: controller.signal,
    })

    if (!res.ok) {
      throw new Error(`Anthropic API ${res.status}: ${await res.text()}`)
    }

    const data = await res.json()
    return {
      content: data.content[0].text,
      usage: data.usage,
      stop_reason: data.stop_reason ?? null,
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      const e = new Error('Anthropic API timeout')
      e.name = 'TimeoutError'
      throw e
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
