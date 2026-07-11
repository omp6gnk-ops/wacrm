import { supabaseAdmin } from './admin-client'
import { loadAiConfig } from './config'
import { buildConversationContext } from './context'
import { retrieveKnowledge } from './knowledge'
import { generateReply } from './generate'
import { buildSystemPrompt } from './defaults'
import { latestUserMessage } from './query'
import { engineSendText } from '@/lib/flows/meta-send'

interface DispatchArgs {
  /** Tenancy key — drives config, contact, and whatsapp_config lookups. */
  accountId: string
  conversationId: string
  contactId: string
  /** The account's WhatsApp config owner, used for the outbound send's
   *  audit columns (mirrors how the flow runner passes it through). */
  configOwnerUserId: string
}

/**
 * AI auto-reply for a freshly-arrived inbound message.
 *
 * Invoked from the WhatsApp webhook's `after()` block, only when no
 * deterministic flow consumed the message (flows win). Mirrors the flow
 * runner's contract: it owns its try/catch and NEVER throws — a failing
 * or slow LLM call must not affect the webhook's 200 to Meta.
 *
 * Eligibility gates (any → silent no-op):
 *   - AI off / auto-reply disabled for the account
 *   - a human agent is ACTIVELY chatting (sent a message within the
 *     configured takeover window) — they own the thread right now
 *   - auto-reply was disabled for this conversation (prior handoff)
 *   - the per-conversation reply cap is reached
 *   - there's nothing to reply to
 *
 * Smart agent-activity gate:
 *   - If agent never replied (first customer message) → AI replies INSTANTLY
 *   - If agent replied before but is now inactive → AI waits the
 *     configured `aiTakeoverMinutes` before stepping in
 *
 * The 24h WhatsApp session window is inherently open here — we're
 * reacting to a customer message that just landed — so no separate
 * window check is needed.
 */
export async function dispatchInboundToAiReply(
  args: DispatchArgs,
): Promise<void> {
  const { accountId, conversationId, contactId, configOwnerUserId } = args

  try {
    const db = supabaseAdmin()

    const config = await loadAiConfig(db, accountId, { requireActive: false })
    if (!config) return

    // Trigger on button reply gate
    // If the latest message was an interactive button reply, but triggerOnButtonReply is disabled, stand down
    const { data: latestMsg } = await db
      .from('messages')
      .select('content_type')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (latestMsg?.content_type === 'interactive' && !config.triggerOnButtonReply) {
      return
    }

    // Deterministic, user-configured responders win over the LLM.
    // If coexistWithAutomations is false, check for active auto-responders.
    if (!config.coexistWithAutomations) {
      const { data: autoResponders } = await db
        .from('automations')
        .select('id')
        .eq('account_id', accountId)
        .eq('is_active', true)
        .in('trigger_type', ['new_message_received', 'keyword_match'])
        .limit(1)
      if (autoResponders && autoResponders.length > 0) return
    }

    const { data: conv, error: convErr } = await db
      .from('conversations')
      .select('assigned_agent_id, ai_autoreply_disabled, ai_reply_count, has_agent_replied')
      .eq('id', conversationId)
      .maybeSingle()
    if (convErr || !conv) return

    // Check if the reply count and disabled state should be reset due to inactivity
    const resetMinutes = config.aiReplyLimitResetMinutes ?? 240
    const { data: lastMsg } = await db
      .from('messages')
      .select('created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastMsg) {
      const minutesSinceLastActive = (Date.now() - new Date(lastMsg.created_at).getTime()) / (1000 * 60)
      if (minutesSinceLastActive >= resetMinutes) {
        await db
          .from('conversations')
          .update({ ai_reply_count: 0, ai_autoreply_disabled: false })
          .eq('id', conversationId)
        conv.ai_reply_count = 0
        conv.ai_autoreply_disabled = false
      }
    }

    if (conv.ai_autoreply_disabled) return // handed off / turned off here

    // Check for Agent-Specific Assistant AI config
    let isAssistantMode = false
    let assistantPrompt = ''
    let assistantMaxReplies = 3
    let assistantTakeoverDelay: number | null = null

    if (conv.assigned_agent_id) {
      const { data: agentConfig } = await db
        .from('ai_agent_configs')
        .select('system_prompt, max_replies, is_active, takeover_delay_minutes')
        .eq('account_id', accountId)
        .eq('agent_id', conv.assigned_agent_id)
        .eq('is_active', true)
        .maybeSingle()

      if (agentConfig) {
        isAssistantMode = true
        assistantPrompt = agentConfig.system_prompt
        assistantMaxReplies = agentConfig.max_replies
        assistantTakeoverDelay = agentConfig.takeover_delay_minutes
      }
    }

    // If not in assistant mode, check if global auto-reply and global active master switch are enabled
    if (!isAssistantMode) {
      if (!config.isActive || !config.autoReplyEnabled) return
    }

    // Apply Agent Scope Restrictions if not in assistant mode
    if (!isAssistantMode && config.restrictToAgentIds && config.restrictToAgentIds.length > 0) {
      const assignedAgentId = conv.assigned_agent_id
      if (assignedAgentId) {
        if (!config.restrictToAgentIds.includes(assignedAgentId)) {
          return // stand down: chat is assigned to an agent who is not selected
        }
      } else {
        if (!config.restrictToAgentIds.includes('unassigned')) {
          return // stand down: chat is unassigned and unassigned is not selected
        }
      }
    }

    // Smart agent-activity gate:
    // Determine if a human agent has ever replied to this conversation (to distinguish new vs old chats)
    const { data: humanMsg } = await db
      .from('messages')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('sender_type', 'agent')
      .limit(1)
    const humanHasReplied = humanMsg && humanMsg.length > 0

    if (humanHasReplied) {
      const takeoverMinutes = isAssistantMode
        ? (assistantTakeoverDelay ?? config.aiTakeoverMinutes ?? 5)
        : (config.aiTakeoverMinutes ?? 5)

      if (takeoverMinutes > 0) {
        const cutoff = new Date(
          Date.now() - takeoverMinutes * 60 * 1000,
        ).toISOString()

        const { data: recentAgentMsgs } = await db
          .from('messages')
          .select('id')
          .eq('conversation_id', conversationId)
          .eq('sender_type', 'agent')
          .gte('created_at', cutoff)
          .limit(1)

        if (recentAgentMsgs && recentAgentMsgs.length > 0) {
          // Human agent is actively chatting - stand down.
          return
        }
      }
    }

    // Cheap early-out check against correct cap
    const activeMaxReplies = isAssistantMode ? assistantMaxReplies : config.autoReplyMaxPerConversation
    if (conv.ai_reply_count >= activeMaxReplies) return

    const messages = await buildConversationContext(db, conversationId)
    if (messages.length === 0) return

    let systemPrompt = ''
    if (isAssistantMode) {
      systemPrompt = assistantPrompt
    } else {
      // Ground the reply in the account's knowledge base (best-effort).
      const knowledge = await retrieveKnowledge(
        db,
        accountId,
        config,
        latestUserMessage(messages),
      )

      let customSalesPrompt = config.salesSystemPrompt || ''
      if (config.salesModeEnabled) {
        const { data: catalog } = await db
          .from('ai_products')
          .select('id, name, price')
          .eq('account_id', accountId)

        if (catalog && catalog.length > 0) {
          const catalogText = catalog
            .map((p) => `- Product Name: "${p.name}", Price: ₹${p.price}, ID: "${p.id}"`)
            .join('\n')
          customSalesPrompt = `${customSalesPrompt}\n\nAVAILABLE PRODUCTS IN CATALOG (Use these exact IDs to generate links):\n${catalogText}\n\nIMPORTANT: When generating a payment link, call the generate_payment_link tool passing ONLY the exact product_id. Do not hallucinate or guess any other details.`
        }
      }

      systemPrompt = buildSystemPrompt({
        userPrompt: config.systemPrompt,
        mode: 'auto_reply',
        knowledge,
        salesModeEnabled: config.salesModeEnabled,
        salesSystemPrompt: customSalesPrompt,
        collectFields: config.collectFields,
      })
    }

    const { text, handoff } = await generateReply({
      config,
      systemPrompt,
      messages,
      conversationId,
      accountId,
    })

    if (handoff || !text) {
      // The model can't (or shouldn't) answer — stop auto-replying on
      // this thread and leave the inbound unanswered so it surfaces in
      // the inbox for a human. Sticky until an admin re-enables.
      await db
        .from('conversations')
        .update({ ai_autoreply_disabled: true })
        .eq('id', conversationId)
      return
    }

    // Atomically claim a reply slot using the active max replies parameter
    const { data: claimed, error: claimErr } = await db.rpc(
      'claim_ai_reply_slot',
      {
        conversation_id: conversationId,
        max_replies: activeMaxReplies,
      },
    )
    if (claimErr) {
      console.error('[ai auto-reply] claim_ai_reply_slot failed:', claimErr)
      return
    }
    if (claimed !== true) return // lost the per-conversation cap race

    await engineSendText({
      accountId,
      userId: configOwnerUserId,
      conversationId,
      contactId,
      text,
    })

    // Invoke sales intelligence engine if enabled and not in assistant mode
    if (!isAssistantMode && config.salesModeEnabled) {
      const { runSalesAssessment } = await import('./sales-engine')
      await runSalesAssessment({
        accountId,
        conversationId,
        contactId,
        config,
        messages,
        aiReply: text,
      }).catch((err) => console.error('[ai auto-reply] Sales assessment failed:', err))
    }
  } catch (err) {
    console.error('[ai auto-reply] dispatch failed:', err)
  }
}
