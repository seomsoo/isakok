import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { callAnthropic } from '../_shared/anthropic.ts'
import { buildCacheKey } from '../_shared/cacheKey.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { log } from '../_shared/logger.ts'
import { isValidConditions, isUuid } from '../_shared/conditionsValidator.ts'
import {
  CHECKLIST_GUIDE_PROMPT_VERSION,
  buildChecklistGuidePrompt,
  parseResponse,
  normalizeGuides,
} from '../_shared/prompts/checklist-guide.ts'

interface AiGeneratedGuide {
  master_item_id: string
  custom_guide: string
}

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startedAt = Date.now()
  const url = new URL(req.url)
  const debugTiming =
    req.headers.get('x-debug-timing') === '1' || url.searchParams.get('debug_timing') === '1'
  let cacheKey: string | undefined
  let errorStage = 'request_start'
  let dbFetchStartedAt: number | undefined
  let dbFetchEnded = false
  let anthropicStartedAt: number | undefined
  let anthropicModel: string | undefined
  const timings: Record<string, unknown> = {}

  const logDbFetchEnd = (extra: Record<string, unknown> = {}) => {
    if (dbFetchStartedAt === undefined || dbFetchEnded) return
    dbFetchEnded = true
    const ms = Date.now() - dbFetchStartedAt
    timings.db_fetch_ms = ms
    log({ event: 'db_fetch_end', db_fetch_ms: ms, ...extra })
  }

  log({ event: 'request_start' })

  try {
    errorStage = 'request_parse'
    const { moveId } = await req.json()

    if (!moveId || typeof moveId !== 'string' || !isUuid(moveId)) {
      return json({ status: 'error', code: 'INVALID_INPUT' }, 400)
    }

    errorStage = 'db_fetch'
    dbFetchStartedAt = Date.now()
    log({ event: 'db_fetch_start' })

    const { data: move, error: moveErr } = await supabaseAdmin
      .from('moves')
      .select('housing_type, contract_type, move_type')
      .eq('id', moveId)
      .is('deleted_at', null)
      .maybeSingle()

    if (moveErr || !move) {
      logDbFetchEnd()
      return json({ status: 'error', code: 'NOT_FOUND' }, 404)
    }

    if (!isValidConditions(move)) {
      logDbFetchEnd()
      return json({ status: 'error', code: 'INVALID_INPUT' }, 400)
    }

    const { data: items, error: itemsErr } = await supabaseAdmin
      .from('user_checklist_items')
      .select(
        `
        master_item_id,
        master_checklist_items ( title, guide_content )
      `,
      )
      .eq('move_id', moveId)

    if (itemsErr || !items || items.length === 0) {
      logDbFetchEnd()
      return json({ status: 'error', code: 'NOT_FOUND' }, 404)
    }

    const { data: versionRow } = await supabaseAdmin
      .from('system_config')
      .select('value')
      .eq('key', 'master_checklist_version')
      .single()
    const currentVersion = versionRow!.value as number

    cacheKey = buildCacheKey({
      housing_type: move.housing_type,
      contract_type: move.contract_type,
      move_type: move.move_type,
      prompt_version: CHECKLIST_GUIDE_PROMPT_VERSION,
    })

    const { data: cached } = await supabaseAdmin
      .from('ai_guide_cache')
      .select('guides, master_version, generating_at')
      .eq('cache_key', cacheKey)
      .maybeSingle()

    let guides: AiGeneratedGuide[]
    let source: 'cache_hit' | 'generated'

    if (
      cached &&
      cached.master_version === currentVersion &&
      cached.generating_at === null &&
      Array.isArray(cached.guides) &&
      cached.guides.length > 0
    ) {
      logDbFetchEnd({ item_count: items.length, cache_status: 'hit' })
      guides = cached.guides as AiGeneratedGuide[]
      source = 'cache_hit'
    } else {
      const { data: claimed } = await supabaseAdmin.rpc('claim_ai_guide_generation', {
        p_cache_key: cacheKey,
        p_master_version: currentVersion,
      })

      if (!claimed) {
        await sleep(5000)
        const { data: retried } = await supabaseAdmin
          .from('ai_guide_cache')
          .select('guides, master_version, generating_at')
          .eq('cache_key', cacheKey)
          .single()

        if (
          retried &&
          retried.master_version === currentVersion &&
          retried.generating_at === null &&
          Array.isArray(retried.guides) &&
          retried.guides.length > 0
        ) {
          logDbFetchEnd({ item_count: items.length, cache_status: 'hit_after_wait' })
          guides = retried.guides as AiGeneratedGuide[]
          source = 'cache_hit'
        } else {
          logDbFetchEnd({ item_count: items.length, cache_status: 'inflight_timeout' })
          log({ cacheKey, status: 'inflight_timeout', duration_ms: Date.now() - startedAt })
          log({
            event: 'error',
            cacheKey,
            error_stage: errorStage,
            error_message: 'AI guide generation inflight timeout',
            total_ms: Date.now() - startedAt,
          })
          return json({ status: 'error', code: 'TIMEOUT' }, 504)
        }
      } else {
        logDbFetchEnd({ item_count: items.length, cache_status: 'miss_claimed' })
        errorStage = 'prompt_build'
        const promptBuildStartedAt = Date.now()
        log({ event: 'prompt_build_start' })

        const promptItems = items.map(
          (i: {
            master_item_id: string
            master_checklist_items: { title: string; guide_content: string }
          }) => ({
            master_item_id: i.master_item_id,
            title: i.master_checklist_items.title,
            guide_content: i.master_checklist_items.guide_content,
          }),
        )

        const prompt = buildChecklistGuidePrompt({
          conditions: move,
          items: promptItems,
        })
        const promptBuildMs = Date.now() - promptBuildStartedAt
        timings.prompt_build_ms = promptBuildMs
        log({
          event: 'prompt_build_end',
          prompt_build_ms: promptBuildMs,
          prompt_length: prompt.length,
          item_count: promptItems.length,
        })

        const model = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-4-5-20251001'

        errorStage = 'anthropic'
        anthropicModel = model
        anthropicStartedAt = Date.now()
        log({ event: 'anthropic_start', model })
        const apiResponse = await callAnthropic({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 16384,
          timeoutMs: 120000,
        })
        const anthropicMs = Date.now() - anthropicStartedAt
        timings.anthropic_ms = anthropicMs
        timings.model = model
        timings.input_tokens = apiResponse.usage.input_tokens
        timings.output_tokens = apiResponse.usage.output_tokens
        timings.stop_reason = apiResponse.stop_reason
        log({
          event: 'anthropic_end',
          anthropic_ms: anthropicMs,
          model,
          input_tokens: apiResponse.usage.input_tokens,
          output_tokens: apiResponse.usage.output_tokens,
          stop_reason: apiResponse.stop_reason,
        })

        const expectedIds = new Set<string>(
          promptItems.map((i: { master_item_id: string }) => i.master_item_id),
        )
        errorStage = 'parse'
        const parseStartedAt = Date.now()
        log({ event: 'parse_start' })
        const parsed = parseResponse(apiResponse.content)
        guides = normalizeGuides(parsed, expectedIds)
        const parseMs = Date.now() - parseStartedAt
        timings.parse_ms = parseMs
        timings.parsed_guide_count = guides.length
        log({
          event: 'parse_end',
          parse_ms: parseMs,
          parsed_guide_count: guides.length,
        })

        errorStage = 'cache_update'
        await supabaseAdmin
          .from('ai_guide_cache')
          .update({
            master_version: currentVersion,
            guides,
            generating_at: null,
          })
          .eq('cache_key', cacheKey)

        source = 'generated'

        log({
          cacheKey,
          status: 'success',
          source,
          duration_ms: Date.now() - startedAt,
          tokens_used: apiResponse.usage.output_tokens,
          generated_count: guides.length,
          expected_count: expectedIds.size,
        })
      }
    }

    errorStage = 'apply_guides'
    const applyGuidesStartedAt = Date.now()
    log({ event: 'apply_guides_start' })
    const { data: updated } = await supabaseAdmin.rpc('apply_ai_guides', {
      p_move_id: moveId,
      p_guides: guides,
    })
    const applyGuidesMs = Date.now() - applyGuidesStartedAt
    timings.apply_guides_ms = applyGuidesMs
    log({
      event: 'apply_guides_end',
      apply_guides_ms: applyGuidesMs,
      updated: updated ?? 0,
    })

    timings.total_ms = Date.now() - startedAt
    log({ event: 'request_end', status: 'ok', source, total_ms: timings.total_ms })

    const body: Record<string, unknown> = { status: 'ok', source, updated: updated ?? 0 }
    if (debugTiming) body.timings = timings
    return json(body, 200)
  } catch (err) {
    const errorLog: Record<string, unknown> = {
      event: 'error',
      status: 'error',
      cacheKey,
      error_stage: errorStage,
      error_message: (err as Error).message ?? String(err),
      total_ms: Date.now() - startedAt,
    }

    if (errorStage === 'anthropic' && anthropicStartedAt !== undefined) {
      errorLog.anthropic_ms = Date.now() - anthropicStartedAt
      errorLog.model = anthropicModel
    }

    log(errorLog)

    if (cacheKey) {
      try {
        // master_version을 0으로 리셋해 stale guides가 캐시 히트되지 않도록 함
        await supabaseAdmin
          .from('ai_guide_cache')
          .update({ generating_at: null, master_version: 0 })
          .eq('cache_key', cacheKey)
      } catch {
        // best effort
      }
    }

    let code: string
    let status: number
    if ((err as Error).name === 'TimeoutError') {
      code = 'TIMEOUT'
      status = 504
    } else if ((err as Error).name === 'ParseError') {
      code = 'PARSE_FAIL'
      status = 500
    } else {
      code = 'API_FAIL'
      status = 500
    }

    const errBody: Record<string, unknown> = { status: 'error', code }
    if (debugTiming) {
      timings.total_ms = Date.now() - startedAt
      timings.error_stage = errorStage
      timings.error_message = (err as Error).message ?? String(err)
      if (errorStage === 'anthropic' && anthropicStartedAt !== undefined) {
        timings.anthropic_ms = Date.now() - anthropicStartedAt
        timings.model = anthropicModel
      }
      errBody.timings = timings
    }
    return json(errBody, status)
  }
})
