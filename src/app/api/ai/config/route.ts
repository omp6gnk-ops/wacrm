import { NextResponse } from 'next/server'
import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { encrypt, decrypt } from '@/lib/whatsapp/encryption'
import { validateAiCredentials } from '@/lib/ai/validate'
import { embedTexts } from '@/lib/ai/embeddings'
import { AiError, type AiProvider } from '@/lib/ai/types'

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * GET /api/ai/config
 *
 * Any member may read the config so the inbox/settings can reflect
 * whether AI is set up. The encrypted key is NEVER returned — only a
 * `has_key` flag; the settings form shows a masked placeholder.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount()

    const { data, error } = await supabase
      .from('ai_configs')
      // `api_key` is selected only to derive `has_key` — it is stripped
      // out below and never returned to the client.
      .select(
        'provider, model, system_prompt, is_active, auto_reply_enabled, auto_reply_max_per_conversation, ai_takeover_minutes, ai_reply_limit_reset_minutes, api_key, embeddings_api_key, ' +
        'coexist_with_automations, trigger_on_button_reply, sales_mode_enabled, sales_system_prompt, collect_fields, ' +
        'auto_categorize_enabled, categorize_after_replies, interested_tag_id, not_interested_tag_id, interested_status_id, not_interested_status_id, ' +
        'payment_qr_url, payment_instructions, restrict_to_agent_ids, razorpay_enabled, razorpay_key_id, razorpay_key_secret, razorpay_webhook_secret, ' +
        'storage_provider, cloudinary_cloud_name, cloudinary_api_key, cloudinary_api_secret',
      )
      .eq('account_id', accountId)
      .maybeSingle()

    if (error) {
      console.error('[ai/config GET] fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to load AI configuration' },
        { status: 500 },
      )
    }

    if (!data) return NextResponse.json({ configured: false })
    // The keys are selected only to derive the has_* flags; neither is
    // returned to the client.
    const { api_key, embeddings_api_key, razorpay_key_secret, cloudinary_api_secret, ...safe } = data as any
    return NextResponse.json({
      configured: true,
      has_key: !!api_key,
      has_embeddings_key: !!embeddings_api_key,
      has_razorpay_key_secret: !!razorpay_key_secret,
      has_cloudinary_api_secret: !!cloudinary_api_secret,
      ...safe,
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * POST /api/ai/config  (admin+)
 *
 * Upsert the account's AI config. Validates the key with the provider
 * before persisting (mirrors the WhatsApp config verifying with Meta
 * first), then stores the key AES-256-GCM-encrypted. When `api_key` is
 * omitted the existing stored key is reused (the form sends it only
 * when the user re-enters it).
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('admin')

    const limit = checkRateLimit(`ai-config:${userId}`, RATE_LIMITS.adminAction)
    if (!limit.success) return rateLimitResponse(limit)

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return bad('Invalid request body')

    const provider = body.provider as AiProvider
    if (provider !== 'openai' && provider !== 'anthropic') {
      return bad('provider must be "openai" or "anthropic"')
    }
    const model = typeof body.model === 'string' ? body.model.trim() : ''
    if (!model) return bad('model is required')

    const systemPrompt =
      typeof body.system_prompt === 'string' && body.system_prompt.trim()
        ? body.system_prompt.trim()
        : null
    const isActive = body.is_active === true
    const autoReplyEnabled = body.auto_reply_enabled === true

    let maxPer = Number(body.auto_reply_max_per_conversation)
    if (!Number.isFinite(maxPer)) maxPer = 3
    maxPer = Math.min(50, Math.max(1, Math.floor(maxPer)))

    let takeoverMin = Number(body.ai_takeover_minutes)
    if (!Number.isFinite(takeoverMin)) takeoverMin = 5
    takeoverMin = Math.min(60, Math.max(0, Math.floor(takeoverMin)))

    let resetMin = Number(body.ai_reply_limit_reset_minutes)
    if (!Number.isFinite(resetMin)) resetMin = 240
    resetMin = Math.max(1, Math.floor(resetMin))

    const rawKey = typeof body.api_key === 'string' ? body.api_key.trim() : ''

    // Embeddings key (optional, for semantic KB search): a non-empty
    // string sets/replaces it; an explicit null clears it; absent leaves
    // it unchanged. The form only sends it when the admin edits it.
    const rawEmbeddingsKey =
      typeof body.embeddings_api_key === 'string'
        ? body.embeddings_api_key.trim()
        : ''
    const clearEmbeddingsKey = body.embeddings_api_key === null

    // Reuse the stored key when the form didn't send a fresh one.
    const { data: existing } = await supabase
      .from('ai_configs')
      .select('id, provider, model, api_key')
      .eq('account_id', accountId)
      .maybeSingle()

    let apiKeyPlain: string
    if (rawKey) {
      apiKeyPlain = rawKey
    } else if (existing?.api_key) {
      try {
        apiKeyPlain = decrypt(existing.api_key)
      } catch {
        return bad('Stored API key could not be decrypted — re-enter your key.')
      }
    } else {
      return bad('api_key is required')
    }

    // Only spend a provider round-trip when the credentials that affect
    // reachability actually changed. A save that just flips a toggle or
    // edits the system prompt on an existing, already-validated config
    // skips the call — no wasted token/latency on the account's key.
    const credentialsChanged =
      !existing ||
      rawKey !== '' ||
      provider !== existing.provider ||
      model !== existing.model

    if (credentialsChanged) {
      try {
        await validateAiCredentials({
          provider,
          model,
          apiKey: apiKeyPlain,
          systemPrompt,
          isActive: isActive,
          autoReplyEnabled,
          autoReplyMaxPerConversation: maxPer,
          aiTakeoverMinutes: takeoverMin,
          embeddingsApiKey: null,
          coexistWithAutomations: body.coexist_with_automations !== false,
          triggerOnButtonReply: body.trigger_on_button_reply !== false,
          salesModeEnabled: body.sales_mode_enabled === true,
          salesSystemPrompt: body.sales_system_prompt || null,
          collectFields: body.collect_fields || [],
          autoCategorizeEnabled: body.auto_categorize_enabled === true,
          categorizeAfterReplies: body.categorize_after_replies || 3,
          interestedTagId: body.interested_tag_id || null,
          notInterestedTagId: body.not_interested_tag_id || null,
          interestedStatusId: body.interested_status_id || null,
          notInterestedStatusId: body.not_interested_status_id || null,
          paymentQrUrl: body.payment_qr_url || null,
          paymentInstructions: body.payment_instructions || null,
        } as any)
      } catch (err) {
        if (err instanceof AiError) {
          return NextResponse.json(
            { error: err.message, code: err.code },
            { status: 400 },
          )
        }
        console.error('[ai/config POST] validation error:', err)
        return bad('Could not validate the API key with the provider.')
      }
    }

    // Validate a new embeddings key before storing (a cheap 1-input
    // embed), same "verify before save" discipline as the chat key.
    if (rawEmbeddingsKey) {
      try {
        await embedTexts(rawEmbeddingsKey, ['ping'])
      } catch (err) {
        if (err instanceof AiError) {
          return NextResponse.json(
            { error: `Embeddings key: ${err.message}`, code: err.code },
            { status: 400 },
          )
        }
        console.error('[ai/config POST] embeddings validation error:', err)
        return bad('Could not validate the embeddings key.')
      }
    }

    const encryptedKey = rawKey ? encrypt(rawKey) : null

    // Parse new settings fields
    const coexistWithAutomations = body.coexist_with_automations !== false
    const triggerOnButtonReply = body.trigger_on_button_reply !== false
    
    const salesModeEnabled = body.sales_mode_enabled === true
    const salesSystemPrompt = typeof body.sales_system_prompt === 'string' && body.sales_system_prompt.trim()
      ? body.sales_system_prompt.trim()
      : null
    const collectFields = Array.isArray(body.collect_fields) ? body.collect_fields : []

    const autoCategorizeEnabled = body.auto_categorize_enabled === true
    let categorizeAfterReplies = Number(body.categorize_after_replies)
    if (!Number.isFinite(categorizeAfterReplies)) categorizeAfterReplies = 3
    categorizeAfterReplies = Math.min(20, Math.max(1, Math.floor(categorizeAfterReplies)))

    const interestedTagId = typeof body.interested_tag_id === 'string' && body.interested_tag_id.trim() ? body.interested_tag_id.trim() : null
    const notInterestedTagId = typeof body.not_interested_tag_id === 'string' && body.not_interested_tag_id.trim() ? body.not_interested_tag_id.trim() : null
    const interestedStatusId = typeof body.interested_status_id === 'string' && body.interested_status_id.trim() ? body.interested_status_id.trim() : null
    const notInterestedStatusId = typeof body.not_interested_status_id === 'string' && body.not_interested_status_id.trim() ? body.not_interested_status_id.trim() : null

    const paymentQrUrl = typeof body.payment_qr_url === 'string' && body.payment_qr_url.trim() ? body.payment_qr_url.trim() : null
    const paymentInstructions = typeof body.payment_instructions === 'string' && body.payment_instructions.trim() ? body.payment_instructions.trim() : null

    const restrictToAgentIds = Array.isArray(body.restrict_to_agent_ids) ? body.restrict_to_agent_ids : []
    const razorpayEnabled = body.razorpay_enabled === true
    const razorpayKeyId = typeof body.razorpay_key_id === 'string' && body.razorpay_key_id.trim() ? body.razorpay_key_id.trim() : null
    const rawRazorpayKeySecret = typeof body.razorpay_key_secret === 'string' ? body.razorpay_key_secret.trim() : ''
    const clearRazorpayKeySecret = body.razorpay_key_secret === null
    const razorpayWebhookSecret = typeof body.razorpay_webhook_secret === 'string' && body.razorpay_webhook_secret.trim() ? body.razorpay_webhook_secret.trim() : null

    const storageProvider = typeof body.storage_provider === 'string' && ['supabase', 'cloudinary', 'mega', 'google_drive'].includes(body.storage_provider)
      ? body.storage_provider
      : 'supabase'
    const cloudinaryCloudName = typeof body.cloudinary_cloud_name === 'string' && body.cloudinary_cloud_name.trim() ? body.cloudinary_cloud_name.trim() : null
    const cloudinaryApiKey = typeof body.cloudinary_api_key === 'string' && body.cloudinary_api_key.trim() ? body.cloudinary_api_key.trim() : null
    const rawCloudinaryApiSecret = typeof body.cloudinary_api_secret === 'string' ? body.cloudinary_api_secret.trim() : ''
    const clearCloudinaryApiSecret = body.cloudinary_api_secret === null

    const shared: Record<string, unknown> = {
      provider,
      model,
      system_prompt: systemPrompt,
      is_active: isActive,
      auto_reply_enabled: autoReplyEnabled,
      auto_reply_max_per_conversation: maxPer,
      ai_takeover_minutes: takeoverMin,
      ai_reply_limit_reset_minutes: resetMin,
      coexist_with_automations: coexistWithAutomations,
      trigger_on_button_reply: triggerOnButtonReply,
      sales_mode_enabled: salesModeEnabled,
      sales_system_prompt: salesSystemPrompt,
      collect_fields: collectFields,
      auto_categorize_enabled: autoCategorizeEnabled,
      categorize_after_replies: categorizeAfterReplies,
      interested_tag_id: interestedTagId,
      not_interested_tag_id: notInterestedTagId,
      interested_status_id: interestedStatusId,
      not_interested_status_id: notInterestedStatusId,
      payment_qr_url: paymentQrUrl,
      payment_instructions: paymentInstructions,
      restrict_to_agent_ids: restrictToAgentIds,
      razorpay_enabled: razorpayEnabled,
      razorpay_key_id: razorpayKeyId,
      razorpay_webhook_secret: razorpayWebhookSecret,
      storage_provider: storageProvider,
      cloudinary_cloud_name: cloudinaryCloudName,
      cloudinary_api_key: cloudinaryApiKey,
    }
    if (rawRazorpayKeySecret) {
      shared.razorpay_key_secret = encrypt(rawRazorpayKeySecret)
    } else if (clearRazorpayKeySecret) {
      shared.razorpay_key_secret = null
    }

    if (rawCloudinaryApiSecret) {
      shared.cloudinary_api_secret = encrypt(rawCloudinaryApiSecret)
    } else if (clearCloudinaryApiSecret) {
      shared.cloudinary_api_secret = null
    }

    if (rawEmbeddingsKey) {
      shared.embeddings_api_key = encrypt(rawEmbeddingsKey)
    } else if (clearEmbeddingsKey) {
      shared.embeddings_api_key = null
    }

    if (existing) {
      const { error: upErr } = await supabase
        .from('ai_configs')
        .update(encryptedKey ? { ...shared, api_key: encryptedKey } : shared)
        .eq('account_id', accountId)
      if (upErr) {
        console.error('[ai/config POST] update error:', upErr)
        return NextResponse.json(
          { error: 'Failed to save AI configuration' },
          { status: 500 },
        )
      }
    } else {
      const { error: insErr } = await supabase.from('ai_configs').insert({
        account_id: accountId,
        created_by: userId,
        api_key: encryptedKey, // guaranteed non-null: rawKey required when no existing row
        ...shared,
      })
      if (insErr) {
        console.error('[ai/config POST] insert error:', insErr)
        return NextResponse.json(
          { error: 'Failed to save AI configuration' },
          { status: 500 },
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * DELETE /api/ai/config  (admin+)
 *
 * Removes the account's AI config (turns everything off and forgets the
 * key). Also used to recover from a corrupted encrypted key.
 */
export async function DELETE() {
  try {
    const { supabase, accountId } = await requireRole('admin')
    const { error } = await supabase
      .from('ai_configs')
      .delete()
      .eq('account_id', accountId)
    if (error) {
      console.error('[ai/config DELETE] error:', error)
      return NextResponse.json(
        { error: 'Failed to delete AI configuration' },
        { status: 500 },
      )
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}
