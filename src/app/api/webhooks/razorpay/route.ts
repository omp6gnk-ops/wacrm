import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/ai/admin-client'
import { engineSendText, engineSendMedia } from '@/lib/flows/meta-send'

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-razorpay-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Extract account_id from the notes metadata to fetch the correct webhook secret
  const paymentLink = payload.payload?.payment_link?.entity
  const notes = paymentLink?.notes

  const accountId = notes?.account_id
  const conversationId = notes?.conversation_id

  if (!accountId || !conversationId) {
    console.error('[razorpay webhook] Missing accountId or conversationId in notes metadata:', notes)
    return NextResponse.json({ error: 'Missing metadata in notes' }, { status: 400 })
  }

  const db = supabaseAdmin()

  // Load the account's AI config to get the webhook secret
  const { data: config, error: configErr } = await db
    .from('ai_configs')
    .select('razorpay_webhook_secret, interested_status_id')
    .eq('account_id', accountId)
    .maybeSingle()

  if (configErr || !config) {
    console.error('[razorpay webhook] Failed to fetch webhook config for account:', accountId, configErr)
    return NextResponse.json({ error: 'Config not found' }, { status: 404 })
  }

  // Verify Razorpay Webhook Signature
  const webhookSecret = config.razorpay_webhook_secret || ''
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex')

  if (expectedSignature !== signature) {
    console.error('[razorpay webhook] Signature verification failed. Expected:', expectedSignature, 'Got:', signature)
    return NextResponse.json({ error: 'Signature mismatch' }, { status: 400 })
  }

  // Handle successful payment
  const event = payload.event
  if (event === 'payment_link.paid') {
    try {
      // 1. Fetch conversation and contact info
      const { data: conv, error: convErr } = await db
        .from('conversations')
        .select('contact_id')
        .eq('id', conversationId)
        .maybeSingle()

      if (convErr || !conv) {
        throw new Error(`Conversation ${conversationId} not found`)
      }

      const contactId = conv.contact_id
      const productName = paymentLink.description || 'Product'

      // Parse delivery files
      let deliveryFiles: string[] = []
      if (notes.delivery_files) {
        try {
          deliveryFiles = JSON.parse(notes.delivery_files)
        } catch {
          // Fallback if not double-serialized
          if (typeof notes.delivery_files === 'string') {
            deliveryFiles = [notes.delivery_files]
          }
        }
      }

      console.log(`[razorpay webhook] Processing delivery for conv=${conversationId}, product=${productName}, files=`, deliveryFiles)

      // 2. Send thank you confirmation message
      await engineSendText({
        accountId,
        userId: '00000000-0000-0000-0000-000000000000', // system role
        conversationId,
        contactId,
        text: `✅ *Payment Successful!*\nThank you for purchasing *${productName}*. We are preparing your download links...`,
      })

      // 3. Deliver the files
      if (deliveryFiles && deliveryFiles.length > 0) {
        for (const fileLink of deliveryFiles) {
          if (!fileLink || typeof fileLink !== 'string') continue

          const isDirect = /\.(pdf|zip|png|jpe?g)$/i.test(fileLink.split('?')[0])

          if (isDirect) {
            try {
              // Try sending it as a direct document message
              await engineSendMedia({
                accountId,
                userId: '00000000-0000-0000-0000-000000000000',
                conversationId,
                contactId,
                kind: 'document',
                link: fileLink,
                caption: productName,
              })
              continue
            } catch (mediaErr) {
              console.error(`[razorpay webhook] Failed to send direct media document:`, fileLink, mediaErr)
              // Fallback to sending text link
            }
          }

          // Text message delivery
          await engineSendText({
            accountId,
            userId: '00000000-0000-0000-0000-000000000000',
            conversationId,
            contactId,
            text: `Download link for *${productName}*:\n👉 ${fileLink}`,
          })
        }
      } else {
        await engineSendText({
          accountId,
          userId: '00000000-0000-0000-0000-000000000000',
          conversationId,
          contactId,
          text: `No files were pre-configured for delivery. Our team will contact you shortly.`,
        })
      }

      // 4. Update Conversation status and disable AI auto-reply (Handoff to human)
      const updates: Record<string, any> = {
        ai_autoreply_disabled: true,
      }
      if (config.interested_status_id) {
        updates.custom_status_id = config.interested_status_id
      }

      await db
        .from('conversations')
        .update(updates)
        .eq('id', conversationId)

      // Log action in assessments
      await db.from('ai_customer_assessments').insert({
        account_id: accountId,
        conversation_id: conversationId,
        contact_id: contactId,
        interest_level: 'hot',
        collected_data: { paid: 'true', product: productName },
        ai_reasoning: 'Razorpay webhook received payment_link.paid event.',
        actions_taken: [
          {
            type: 'payment_verified',
            detail: `Verified payment for ${productName}`,
            timestamp: new Date().toISOString(),
          },
          {
            type: 'files_delivered',
            detail: `Delivered ${deliveryFiles.length} file links`,
            timestamp: new Date().toISOString(),
          },
          {
            type: 'status_changed',
            detail: 'Disabled AI auto-reply and set custom status',
            timestamp: new Date().toISOString(),
          },
        ],
      })

    } catch (deliveryErr: any) {
      console.error('[razorpay webhook] Error processing file delivery:', deliveryErr)
      return NextResponse.json({ error: 'Processing failed', details: deliveryErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
