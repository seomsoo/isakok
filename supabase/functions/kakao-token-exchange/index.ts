import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const KAKAO_USER_API = 'https://kapi.kakao.com/v2/user/me'

interface RequestBody {
  kakaoAccessToken: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return errorResponse(405, 'Method Not Allowed')
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse(401, 'Authorization header missing')
    }

    const body = (await req.json()) as RequestBody
    if (!body.kakaoAccessToken) return errorResponse(400, 'kakaoAccessToken missing')

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    )
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData.user) return errorResponse(401, 'JWT verification failed')

    const currentAnonymousUserId = userData.user.is_anonymous ? userData.user.id : null

    const kakaoRes = await fetch(KAKAO_USER_API, {
      headers: { Authorization: `Bearer ${body.kakaoAccessToken}` },
    })
    if (!kakaoRes.ok) return errorResponse(401, 'Kakao token verification failed')
    const kakaoUser = await kakaoRes.json()
    const kakaoId = String(kakaoUser.id)
    const realEmail = kakaoUser.kakao_account?.email as string | undefined

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { data: existingLink } = await admin
      .from('auth_provider_links')
      .select('user_id')
      .eq('provider', 'kakao')
      .eq('provider_user_id', kakaoId)
      .maybeSingle()

    let userId: string
    let linked = false
    let loginEmail: string

    if (existingLink) {
      userId = existingLink.user_id

      if (currentAnonymousUserId && existingLink.user_id === currentAnonymousUserId) {
        linked = true
      } else {
        linked = false
      }

      const { data: existingUser } = await admin.auth.admin.getUserById(userId)
      loginEmail = existingUser.user?.email ?? `kakao_${kakaoId}@isakok.invalid`
    } else if (currentAnonymousUserId) {
      const email = realEmail ?? `kakao_${kakaoId}@isakok.invalid`
      const { error: updErr } = await admin.auth.admin.updateUserById(currentAnonymousUserId, {
        email,
        email_confirm: true,
        user_metadata: { kakao_id: kakaoId, provider: 'kakao' },
        app_metadata: { provider: 'kakao' },
      })
      if (updErr) {
        const msg = updErr.message?.toLowerCase() ?? ''
        if (msg.includes('already') || msg.includes('duplicate')) {
          return errorResponse(409, 'KAKAO_EMAIL_CONFLICT')
        }
        return errorResponse(500, `updateUser failed: ${updErr.message}`)
      }

      const { error: linkErr } = await admin.from('auth_provider_links').insert({
        provider: 'kakao',
        provider_user_id: kakaoId,
        user_id: currentAnonymousUserId,
      })
      if (linkErr) return errorResponse(500, `link failed: ${linkErr.message}`)

      userId = currentAnonymousUserId
      loginEmail = email
      linked = true
    } else {
      const email = realEmail ?? `kakao_${kakaoId}@isakok.invalid`
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { kakao_id: kakaoId, provider: 'kakao' },
        app_metadata: { provider: 'kakao' },
      })
      if (createErr) {
        const msg = createErr.message?.toLowerCase() ?? ''
        if (msg.includes('already') || msg.includes('duplicate')) {
          return errorResponse(409, 'KAKAO_EMAIL_CONFLICT')
        }
        return errorResponse(500, createErr.message)
      }
      userId = created.user.id

      const { error: newLinkErr } = await admin.from('auth_provider_links').insert({
        provider: 'kakao',
        provider_user_id: kakaoId,
        user_id: userId,
      })
      if (newLinkErr) {
        await admin.auth.admin.deleteUser(userId).catch(() => {})
        return errorResponse(500, `link failed: ${newLinkErr.message}`)
      }
      loginEmail = email
    }

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: loginEmail,
    })
    if (linkErr) return errorResponse(500, linkErr.message)
    const tokenHash = link.properties.hashed_token

    const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: verified, error: verifyErr } = await anon.auth.verifyOtp({
      type: 'magiclink',
      token_hash: tokenHash,
    })
    if (verifyErr) return errorResponse(500, verifyErr.message)
    if (!verified.session) return errorResponse(500, 'session creation failed')

    return new Response(
      JSON.stringify({
        access_token: verified.session.access_token,
        refresh_token: verified.session.refresh_token,
        linked,
        user_id: userId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return errorResponse(500, err instanceof Error ? err.message : 'unknown')
  }
})

function errorResponse(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
