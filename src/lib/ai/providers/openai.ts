import { AiError } from '../types'
import { MAX_OUTPUT_TOKENS } from '../defaults'
import {
  mergeConsecutive,
  providerHttpError,
  toNetworkError,
  type ProviderArgs,
} from './shared'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

interface OpenAiResponse {
  choices?: { message?: { content?: string } }[]
}

/**
 * Call OpenAI's Chat Completions endpoint with the caller's own key.
 * Returns the raw assistant text (handoff parsing happens in
 * `generateReply`).
 */
export async function generateOpenAi(args: ProviderArgs): Promise<string> {
  const { apiKey, model, systemPrompt, messages, timeoutMs } = args

  const tools = [
    {
      type: 'function',
      function: {
        name: 'generate_payment_link',
        description: 'Generate a single Razorpay payment link for a customer to purchase one or more products.',
        parameters: {
          type: 'object',
          properties: {
            product_ids: {
              type: 'array',
              items: { type: 'string' },
              description: 'An array of UUIDs of the product(s) the customer wants to purchase (from the available products list).'
            }
          },
          required: ['product_ids']
        }
      }
    }
  ]

  const messagesPayload: any[] = [
    { role: 'system', content: systemPrompt },
    ...mergeConsecutive(messages).map(m => ({ role: m.role, content: m.content })),
  ]

  let currentAttempt = 0
  const maxAttempts = 3

  while (currentAttempt < maxAttempts) {
    currentAttempt++

    let res: Response
    try {
      const bodyPayload: any = {
        model,
        messages: messagesPayload,
        max_completion_tokens: MAX_OUTPUT_TOKENS,
      }
      if (args.razorpayEnabled && args.conversationId && args.accountId) {
        bodyPayload.tools = tools
      }

      res = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyPayload),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (err) {
      throw toNetworkError(err)
    }

    if (!res.ok) {
      throw await providerHttpError('OpenAI', res)
    }

    const data = (await res.json().catch(() => null)) as any
    const choice = data?.choices?.[0]
    const assistantMessage = choice?.message

    if (!assistantMessage) {
      throw new AiError('OpenAI returned an empty response.', {
        code: 'empty_response',
      })
    }

    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      messagesPayload.push(assistantMessage)

      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.function.name === 'generate_payment_link') {
          try {
            const params = JSON.parse(toolCall.function.arguments)
            const db = (await import('../admin-client')).supabaseAdmin()
            
            // Query the product catalog for all matching IDs
            const { data: matchedProducts, error: prodErr } = await db
              .from('ai_products')
              .select('name, price, file_url')
              .in('id', params.product_ids)

            if (prodErr || !matchedProducts || matchedProducts.length === 0) {
              throw new Error(`None of the product IDs [${params.product_ids?.join(',')}] were found in the catalog.`)
            }

            // Sum prices and combine names
            const totalAmount = matchedProducts.reduce((sum, p) => sum + Number(p.price), 0)
            const combinedName = matchedProducts.map((p) => p.name).join(' + ')
            const deliveryFiles = matchedProducts.map((p) => ({ name: p.name, url: p.file_url }))

            // Generate Razorpay Link
            const { createRazorpayLink } = await import('../../razorpay/link')
            const paymentLink = await createRazorpayLink({
              accountId: args.accountId!,
              conversationId: args.conversationId!,
              amount: totalAmount,
              productName: combinedName,
              deliveryFiles, // Array of { name, url } objects
            })

            // Fetch contactId for sending the interactive button
            const { data: conv } = await db
              .from('conversations')
              .select('contact_id')
              .eq('id', args.conversationId!)
              .maybeSingle()

            if (!conv || !conv.contact_id) {
              throw new Error('Contact not found for this conversation.')
            }

            // Deliver the payment button to WhatsApp directly
            const { engineSendCtaUrl } = await import('../../flows/meta-send')
            await engineSendCtaUrl({
              accountId: args.accountId!,
              userId: '00000000-0000-0000-0000-000000000000', // system bot
              conversationId: args.conversationId!,
              contactId: conv.contact_id,
              bodyText: `Aapke liye payment button ready hai! Niche *Pay Now* button par click karke ₹${totalAmount} pay karein.`,
              buttonDisplayText: 'Pay Now',
              buttonUrl: paymentLink,
            })

            messagesPayload.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: 'generate_payment_link',
              content: JSON.stringify({ success: true, status: 'Payment button sent directly to the customer on WhatsApp.' }),
            })
          } catch (toolErr: any) {
            console.error('[ai openai tool] failed to generate payment link:', toolErr)
            messagesPayload.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: 'generate_payment_link',
              content: JSON.stringify({ success: false, error: toolErr.message || 'Failed to generate link' }),
            })
          }
        } else {
          messagesPayload.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: JSON.stringify({ error: 'Unknown tool' }),
          })
        }
      }
      continue
    }

    const text = assistantMessage.content
    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new AiError('OpenAI returned an empty response.', {
        code: 'empty_response',
      })
    }
    return text
  }

  throw new AiError('OpenAI exceeded maximum tool call attempts.', {
    code: 'max_tool_attempts',
  })
}
