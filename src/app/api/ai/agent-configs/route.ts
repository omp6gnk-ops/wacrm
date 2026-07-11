import { NextResponse } from 'next/server'
import { getCurrentAccount, requireRole, toErrorResponse } from '@/lib/auth/account'

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * GET /api/ai/agent-configs
 *
 * Load all agent assistant configurations for the current account.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount()

    const { data, error } = await supabase
      .from('ai_agent_configs')
      .select('id, agent_id, system_prompt, max_replies, is_active, takeover_delay_minutes, created_at, updated_at')
      .eq('account_id', accountId)

    if (error) {
      console.error('[ai/agent-configs GET] error:', error)
      return NextResponse.json({ error: 'Failed to load agent configurations' }, { status: 500 })
    }

    return NextResponse.json({ configs: data || [] })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * POST /api/ai/agent-configs
 *
 * Upsert an agent's assistant configuration (admin+).
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin')

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return bad('Invalid request body')

    const agentId = body.agent_id
    if (!agentId || typeof agentId !== 'string') return bad('agent_id is required')

    const systemPrompt = typeof body.system_prompt === 'string' ? body.system_prompt.trim() : ''
    if (!systemPrompt) return bad('system_prompt is required')

    let maxReplies = Number(body.max_replies)
    if (!Number.isFinite(maxReplies)) maxReplies = 3
    maxReplies = Math.min(10, Math.max(1, Math.floor(maxReplies)))

    let takeoverDelayMinutes = Number(body.takeover_delay_minutes)
    if (!Number.isFinite(takeoverDelayMinutes)) takeoverDelayMinutes = 5
    takeoverDelayMinutes = Math.min(60, Math.max(1, Math.floor(takeoverDelayMinutes)))

    const isActive = body.is_active !== false

    const { data, error } = await supabase
      .from('ai_agent_configs')
      .upsert({
        account_id: accountId,
        agent_id: agentId,
        system_prompt: systemPrompt,
        max_replies: maxReplies,
        is_active: isActive,
        takeover_delay_minutes: takeoverDelayMinutes,
      }, {
        onConflict: 'account_id,agent_id',
      })
      .select()
      .single()

    if (error) {
      console.error('[ai/agent-configs POST] error:', error)
      return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 })
    }

    return NextResponse.json({ success: true, config: data })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * DELETE /api/ai/agent-configs
 *
 * Delete an agent assistant configuration (admin+).
 */
export async function DELETE(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin')

    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agent_id')

    if (!agentId) return bad('agent_id parameter is required')

    const { error } = await supabase
      .from('ai_agent_configs')
      .delete()
      .eq('account_id', accountId)
      .eq('agent_id', agentId)

    if (error) {
      console.error('[ai/agent-configs DELETE] error:', error)
      return NextResponse.json({ error: 'Failed to delete configuration' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}
