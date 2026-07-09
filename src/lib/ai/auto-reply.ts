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

    const config = await loadAiConfig(db, accountId)
    if (!config || !config.autoReplyEnabled) return

    // Deterministic, user-configured responders win over the LLM — the
    // caller already excludes messages a Flow consumed. Message-level
    // automations (`new_message_received` / `keyword_match`) are
    // dispatched independently for this same inbound and may send their
    // own reply, so if the account has any active one we stand down to
    // avoid double-texting the customer. (Relationship triggers like
    // `first_inbound_message` don't count — they're not per-message
    // auto-responders.)
    const { data: autoResponders } = await db
      .from('automations')
      .select('id')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .in('trigger_type', ['new_message_received', 'keyword_match'])
      .limit(1)
    if (autoResponders && autoResponders.length > 0) return

    const { data: conv, error: convErr } = await db
      .from('conversations')
      .select('assigned_agent_id, ai_autoreply_disabled, ai_reply_count, has_agent_replied')
      .eq('id', conversationId)
      .maybeSingle()
    if (convErr || !conv) return
    if (conv.ai_autoreply_disabled) return // handed off / turned off here

    // Smart agent-activity gate: instead of blocking AI entirely when a
    // chat is assigned, we use a two-tier approach:
    //
    // Tier 1 — Agent NEVER replied (first customer contact / broadcast
    //   reply): AI responds INSTANTLY. The customer shouldn't wait.
    //
    // Tier 2 — Agent HAS replied before but is now inactive: AI waits
    //   for `aiTakeoverMinutes` (admin-configured, default 5) before
    //   stepping in. This prevents double-texting when an agent just
    //   sent a message, but hands the chat to AI when agents are
    //   offline (nights, holidays, breaks).
    if (conv.assigned_agent_id) {
      const agentHasReplied = conv.has_agent_replied === true

      if (agentHasReplied) {
        // Tier 2: agent replied before — check recency window.
        const takeoverMinutes = config.aiTakeoverMinutes ?? 5
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
            // Agent is actively chatting — stand down.
            return
          }
        }
        // Agent replied before but is now inactive — AI takes over.
        // Reset the AI reply count so the bot gets a fresh quota for
        // this new "session" (avoids the cap being exhausted from a
        // much earlier AI interaction).
        if (conv.ai_reply_count > 0) {
          await db
            .from('conversations')
            .update({ ai_reply_count: 0 })
            .eq('id', conversationId)
          conv.ai_reply_count = 0
        }
      }
      // Tier 1 (agentHasReplied === false): fall through — AI replies
      // instantly, no waiting.
    }

    // Cheap early-out; the authoritative cap check is the atomic claim
    // below (this read can race a concurrent inbound).
    if (conv.ai_reply_count >= config.autoReplyMaxPerConversation) return

    const messages = await buildConversationContext(db, conversationId)
    if (messages.length === 0) return

    // Ground the reply in the account's knowledge base (best-effort).
    const knowledge = await retrieveKnowledge(
      db,
      accountId,
      config,
      latestUserMessage(messages),
    )

    const systemPrompt = buildSystemPrompt({
      userPrompt: config.systemPrompt,
      mode: 'auto_reply',
      knowledge,
    })

    const { text, handoff } = await generateReply({
      config,
      systemPrompt,
      messages,
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

    // Atomically claim a reply slot: the cap check + increment happen in
    // one UPDATE, so concurrent inbounds can never overshoot the cap. If
    // another inbound just took the last slot, `claimed` is false and we
    // skip the send. (We consume a slot slightly before the send lands —
    // fail-safe: under-reply rather than over-reply.)
    const { data: claimed, error: claimErr } = await db.rpc(
      'claim_ai_reply_slot',
      {
        conversation_id: conversationId,
        max_replies: config.autoReplyMaxPerConversation,
      },
    )
    if (claimErr) {
      // A real error here (vs. losing the cap race) is almost always a
      // deploy issue — e.g. `claim_ai_reply_slot` not EXECUTE-able by the
      // service role, or the migration not applied. Log it loudly: a
      // silent return makes "auto-reply never fires" undiagnosable.
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
  } catch (err) {
    console.error('[ai auto-reply] dispatch failed:', err)
  }
}
