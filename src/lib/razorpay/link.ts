import { supabaseAdmin } from '../ai/admin-client'
import { decrypt } from '../whatsapp/encryption'

export async function createRazorpayLink(args: {
  accountId: string
  conversationId: string
  amount: number
  productName: string
  deliveryFiles: any[]
}): Promise<string> {
  const db = supabaseAdmin()
  const { data: config } = await db
    .from('ai_configs')
    .select('razorpay_key_id, razorpay_key_secret')
    .eq('account_id', args.accountId)
    .maybeSingle()

  if (!config || !config.razorpay_key_id || !config.razorpay_key_secret) {
    throw new Error('Razorpay is not configured for this account.')
  }

  const keyId = config.razorpay_key_id
  const keySecret = decrypt(config.razorpay_key_secret)

  // Fetch customer details from conversation
  const { data: conv } = await db
    .from('conversations')
    .select('contact_id')
    .eq('id', args.conversationId)
    .maybeSingle()

  let customerName = 'Customer'
  let customerPhone = ''

  if (conv?.contact_id) {
    const { data: contact } = await db
      .from('contacts')
      .select('name, phone')
      .eq('id', conv.contact_id)
      .maybeSingle()
    if (contact) {
      customerName = contact.name || 'Customer'
      customerPhone = contact.phone ? contact.phone.replace(/\D/g, '') : ''
    }
  }

  // Razorpay amount is in paise (1 INR = 100 paise)
  const amountInPaise = Math.round(args.amount * 100)

  // Ensure contact is valid for Razorpay (minimum length of 10 digits for phone)
  let phoneParam = customerPhone
  if (phoneParam.length > 10 && phoneParam.startsWith('91')) {
    phoneParam = phoneParam.substring(2)
  }
  if (phoneParam.length !== 10) {
    // If not a standard 10-digit number, don't pass it to prevent Razorpay validation errors
    phoneParam = ''
  }

  const res = await fetch('https://api.razorpay.com/v1/payment_links', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
    },
    body: JSON.stringify({
      amount: amountInPaise,
      currency: 'INR',
      accept_partial: false,
      description: args.productName,
      customer: {
        name: customerName,
        contact: phoneParam || undefined,
      },
      notify: {
        sms: false,
        email: false,
      },
      reminder_enable: false,
      notes: {
        conversation_id: args.conversationId,
        account_id: args.accountId,
        delivery_files: JSON.stringify(args.deliveryFiles),
      },
    }),
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw new Error(`Razorpay API error: ${errBody?.error?.description || res.statusText}`)
  }

  const payload = await res.json()
  return payload.short_url as string
}
