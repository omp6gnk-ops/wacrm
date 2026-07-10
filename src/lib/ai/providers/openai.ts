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
        description: 'Generate a Razorpay payment link for a customer to purchase a product.',
        parameters: {
          type: 'object',
          properties: {
            amount: {
              type: 'number',
              description: 'The product price in INR (e.g. 99 or 149).'
            },
            product_name: {
              type: 'string',
              description: 'The name of the product being purchased (e.g. "Physics PDF notes").'
            },
            delivery_files: {
              type: 'array',
              items: { type: 'string' },
              description: 'An array of URLs of files to deliver to the customer\'s WhatsApp number after successful payment (e.g., Google Drive links).'
            }
          },
          required: ['amount', 'product_name', 'delivery_files']
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
            const { createRazorpayLink } = await import('../../razorpay/link')
            const paymentLink = await createRazorpayLink({
              accountId: args.accountId!,
              conversationId: args.conversationId!,
              amount: params.amount,
              productName: params.product_name,
              deliveryFiles: params.delivery_files,
            })

            messagesPayload.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: 'generate_payment_link',
              content: JSON.stringify({ success: true, payment_link: paymentLink }),
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
