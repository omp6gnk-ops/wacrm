import { supabaseAdmin } from './admin-client'
import { type AiConfig, type ChatMessage } from './types'
import { generateReply } from './generate'
import { engineSendText, engineSendMedia } from '@/lib/flows/meta-send'

interface SalesAssessmentArgs {
  accountId: string
  conversationId: string
  contactId: string
  config: AiConfig
  messages: ChatMessage[]
  aiReply: string
}

interface ExtractedAssessment {
  interest_level: 'hot' | 'warm' | 'cold' | 'not_interested'
  collected_data: Record<string, string>
  reasoning: string
  ready_for_payment: boolean
}

/**
 * Runs the sales assessment on the conversation thread.
 * This is invoked asynchronously after the AI reply has been dispatched.
 */
export async function runSalesAssessment(args: SalesAssessmentArgs): Promise<void> {
  const { accountId, conversationId, contactId, config, messages, aiReply } = args
  const db = supabaseAdmin()

  try {
    // 1. Fetch custom fields catalogue to translate IDs for the LLM
    const { data: customFields } = await db
      .from('custom_fields')
      .select('id, field_name')
      .eq('account_id', accountId)

    const fieldMap: Record<string, string> = {}
    const reverseFieldMap: Record<string, string> = {}
    if (customFields) {
      for (const f of customFields) {
        fieldMap[`custom:${f.id}`] = f.field_name
        reverseFieldMap[f.field_name.toLowerCase()] = `custom:${f.id}`
      }
    }

    // 2. Build descriptions of fields to collect
    let fieldsDescription = '- name: Customer\'s name\n- email: Customer\'s email address\n- company: Customer\'s company name\n'
    if (config.collectFields && config.collectFields.length > 0) {
      for (const item of config.collectFields) {
        if (item.field.startsWith('custom:')) {
          const name = fieldMap[item.field]
          if (name) {
            fieldsDescription += `- ${name} (custom field): Extract this information if provided.\n`
          }
        }
      }
    }

    // 3. Format the conversation transcript
    // Include the bot's latest reply since it was already sent
    const fullTranscript = messages
      .map((m) => `${m.role === 'user' ? 'Customer' : 'Sales Agent'}: ${m.content}`)
      .join('\n') + `\nSales Agent: ${aiReply}`

    // 4. Construct System Prompt for structured extraction
    const systemPrompt = `You are a conversation analyzer for a WhatsApp Sales CRM.
Your task is to analyze the conversation between the Customer (user) and Sales Agent (assistant), and output a JSON object summarizing the conversation state.

Target fields to collect:
${fieldsDescription}

Determine:
1. The customer's interest level:
   - 'hot': Customer is asking to buy, asking for pricing/link, ready to pay, or showing high purchase intent.
   - 'warm': Customer is interested, asking product questions, showing intent, but not ready to buy yet.
   - 'cold': Customer is indifferent, unresponsive, or sending generic/short replies.
   - 'not_interested': Customer explicitly said they don't want the product, asked to stop, or showed clear disinterest.
2. Extract the values of target fields if they have been shared by the customer in the conversation. Use the exact field keys ('name', 'email', 'company', or the custom field names in lowercase).
3. Determine if the customer is ready for payment (e.g. asked for payment details, QR code, UPI, bank info, or explicitly said they want to make the purchase now).

Output ONLY a JSON object with this exact shape:
{
  "interest_level": "hot" | "warm" | "cold" | "not_interested",
  "collected_data": {
    "name": "extracted_name",
    "email": "extracted_email",
    "field_name_in_lowercase": "extracted_value"
  },
  "reasoning": "A concise explanation of your interest level and data extraction",
  "ready_for_payment": true | false
}

Do not include any Markdown formatting (no \`\`\`json blocks), only return the raw JSON string.`

    // 5. Query LLM for the assessment
    const assessmentResult = await generateReply({
      config,
      systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Here is the conversation transcript:\n\n${fullTranscript}\n\nGenerate the JSON assessment now.`,
        },
      ],
    })

    const parsedAssessment = parseJsonSafe(assessmentResult.text) as ExtractedAssessment
    if (!parsedAssessment) return

    // Map lowercase custom field names back to custom:<id> keys
    const finalCollectedData: Record<string, string> = {}
    for (const [key, val] of Object.entries(parsedAssessment.collected_data)) {
      if (['name', 'email', 'company'].includes(key)) {
        finalCollectedData[key] = val
      } else {
        const idKey = reverseFieldMap[key.toLowerCase()]
        if (idKey) {
          finalCollectedData[idKey] = val
        } else {
          finalCollectedData[key] = val
        }
      }
    }

    const actionsLog: Array<{ type: string; detail: string; timestamp: string }> = []

    // 6. Perform Auto-Categorization (Tags & Custom Statuses)
    if (config.autoCategorizeEnabled) {
      const isInterested = ['hot', 'warm'].includes(parsedAssessment.interest_level)

      // A. Update Tag
      const targetTagId = isInterested ? config.interestedTagId : config.notInterestedTagId
      if (targetTagId) {
        const { data: existingTag } = await db
          .from('contact_tags')
          .select('id')
          .eq('contact_id', contactId)
          .eq('tag_id', targetTagId)
          .maybeSingle()

        if (!existingTag) {
          const { error: tagErr } = await db
            .from('contact_tags')
            .insert({ contact_id: contactId, tag_id: targetTagId })
          if (!tagErr) {
            actionsLog.push({
              type: 'tag_added',
              detail: `Added tag ID ${targetTagId}`,
              timestamp: new Date().toISOString(),
            })
          }
        }
      }

      // B. Update Lead Status (custom_status_id)
      const targetStatusId = isInterested ? config.interestedStatusId : config.notInterestedStatusId
      if (targetStatusId) {
        const { error: statusErr } = await db
          .from('conversations')
          .update({ custom_status_id: targetStatusId })
          .eq('id', conversationId)
        if (!statusErr) {
          actionsLog.push({
            type: 'status_changed',
            detail: `Changed status to ID ${targetStatusId}`,
            timestamp: new Date().toISOString(),
          })
        }
      }

      // C. Save Extracted Contact Data
      const contactUpdates: Record<string, string> = {}
      if (finalCollectedData.name) contactUpdates.name = finalCollectedData.name
      if (finalCollectedData.email) contactUpdates.email = finalCollectedData.email
      if (finalCollectedData.company) contactUpdates.company = finalCollectedData.company

      if (Object.keys(contactUpdates).length > 0) {
        const { error: contactErr } = await db
          .from('contacts')
          .update(contactUpdates)
          .eq('id', contactId)
        if (!contactErr) {
          for (const k of Object.keys(contactUpdates)) {
            actionsLog.push({
              type: 'field_updated',
              detail: `Updated standard contact field: ${k}`,
              timestamp: new Date().toISOString(),
            })
          }
        }
      }

      // D. Save Extracted Custom Field Values
      for (const [key, val] of Object.entries(finalCollectedData)) {
        if (key.startsWith('custom:')) {
          const customFieldId = key.substring(7)
          
          // Check if value already exists
          const { data: existingVal } = await db
            .from('contact_custom_values')
            .select('id')
            .eq('contact_id', contactId)
            .eq('custom_field_id', customFieldId)
            .maybeSingle()

          if (existingVal) {
            await db
              .from('contact_custom_values')
              .update({ value: val })
              .eq('id', existingVal.id)
          } else {
            await db
              .from('contact_custom_values')
              .insert({
                contact_id: contactId,
                custom_field_id: customFieldId,
                value: val,
              })
          }
          actionsLog.push({
            type: 'field_updated',
            detail: `Updated custom field: ${fieldMap[key]}`,
            timestamp: new Date().toISOString(),
          })
        }
      }
    }

    // 7. Check and Send QR/Payment Details
    if (parsedAssessment.ready_for_payment) {
      // Avoid duplicate QR sending by checking if we sent it in a previous assessment in this conversation
      const { data: pastSends } = await db
        .from('ai_customer_assessments')
        .select('actions_taken')
        .eq('conversation_id', conversationId)

      let qrAlreadySent = false
      if (pastSends) {
        for (const row of pastSends) {
          const actions = (row.actions_taken || []) as Array<{ type: string }>
          if (actions.some((a) => a.type === 'qr_sent')) {
            qrAlreadySent = true
            break
          }
        }
      }

      if (!qrAlreadySent) {
        let sentAny = false

        // A. Send QR Image if configured
        if (config.paymentQrUrl && config.paymentQrUrl.trim()) {
          try {
            await engineSendMedia({
              accountId,
              userId: config.apiKey ? '00000000-0000-0000-0000-000000000000' : '00000000-0000-0000-0000-000000000000', // system role
              conversationId,
              contactId,
              kind: 'image',
              link: config.paymentQrUrl.trim(),
              caption: config.paymentInstructions || 'Scan this QR code to complete the payment.',
            })
            sentAny = true
            actionsLog.push({
              type: 'qr_sent',
              detail: `Sent payment QR code image: ${config.paymentQrUrl}`,
              timestamp: new Date().toISOString(),
            })
          } catch (qrErr) {
            console.error('[ai sales engine] QR send failed:', qrErr)
          }
        }

        // B. Send payment text instructions if QR image was not sent (or as fallback)
        if (!sentAny && config.paymentInstructions && config.paymentInstructions.trim()) {
          try {
            await engineSendText({
              accountId,
              userId: '00000000-0000-0000-0000-000000000000',
              conversationId,
              contactId,
              text: config.paymentInstructions.trim(),
            })
            sentAny = true
            actionsLog.push({
              type: 'qr_sent',
              detail: 'Sent text payment instructions',
              timestamp: new Date().toISOString(),
            })
          } catch (textErr) {
            console.error('[ai sales engine] Payment instructions text send failed:', textErr)
          }
        }
      }
    }

    // 8. Log the assessment to the database
    await db.from('ai_customer_assessments').insert({
      account_id: accountId,
      conversation_id: conversationId,
      contact_id: contactId,
      interest_level: parsedAssessment.interest_level,
      collected_data: finalCollectedData,
      ai_reasoning: parsedAssessment.reasoning,
      actions_taken: actionsLog,
    })

  } catch (err) {
    console.error('[ai sales engine] runSalesAssessment failed:', err)
  }
}

/**
 * Robust JSON parser that strips markdown wrapper blocks if the LLM includes them.
 */
function parseJsonSafe(text: string): ExtractedAssessment | null {
  let cleaned = text.trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.substring(7)
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.substring(3)
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3)
  }
  cleaned = cleaned.trim()

  try {
    return JSON.parse(cleaned) as ExtractedAssessment
  } catch (err) {
    console.error('[ai sales engine] Failed to parse JSON from AI response:', cleaned, err)
    return null
  }
}
