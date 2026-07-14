import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChatMessage } from './types'
import { aiContextMessageLimit } from './defaults'

interface DbMessage {
  sender_type: 'customer' | 'agent' | 'bot'
  content_type: string
  content_text: string | null
}

/**
 * Fetch the last N messages of a conversation (including text and media placeholding)
 * and map them to the provider-neutral chat shape. Customer messages become `user`;
 * agent and bot messages become `assistant`. Media/unsupported messages are mapped
 * to bracketed strings (e.g. [Image]) so the model is aware of them.
 *
 * Ordered oldest-first (chronological) so the transcript reads
 * naturally and the most recent customer message lands last.
 */
export async function buildConversationContext(
  db: SupabaseClient,
  conversationId: string,
  limit: number = aiContextMessageLimit(),
): Promise<ChatMessage[]> {
  const { data, error } = await db
    .from('messages')
    .select('sender_type, content_type, content_text')
    .eq('conversation_id', conversationId)
    .in('content_type', ['text', 'interactive', 'template', 'image', 'document', 'audio', 'video', 'sticker', 'location'])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  const rows = ((data ?? []) as DbMessage[]).reverse()
  return rows
    .map((m) => {
      let content = m.content_text?.trim() || '';
      if (!content) {
        if (m.content_type === 'image') content = '[Image]'
        else if (m.content_type === 'document') content = '[Document]'
        else if (m.content_type === 'audio') content = '[Voice Note]'
        else if (m.content_type === 'video') content = '[Video]'
        else if (m.content_type === 'sticker') content = '[Sticker]'
        else if (m.content_type === 'location') content = '[Location]'
      }
      return {
        role: (m.sender_type === 'customer' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: content,
      }
    })
    .filter((m) => m.content && m.content.trim())
}
