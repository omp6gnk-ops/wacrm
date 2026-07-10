import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { requireRole } from '@/lib/auth/account'
import { decrypt } from '@/lib/whatsapp/encryption'

export async function GET() {
  try {
    const { supabase, accountId } = await requireRole('admin')

    const { data: config, error } = await supabase
      .from('ai_configs')
      .select('cloudinary_api_key, cloudinary_api_secret')
      .eq('account_id', accountId)
      .maybeSingle()

    if (error || !config || !config.cloudinary_api_secret) {
      return NextResponse.json({ error: 'Cloudinary is not configured.' }, { status: 400 })
    }

    const apiSecret = decrypt(config.cloudinary_api_secret)
    const apiKey = config.cloudinary_api_key

    const timestamp = Math.round(Date.now() / 1000)
    const folder = 'product-delivery-files'

    // Cloudinary signature parameter string (must be sorted alphabetically)
    const stringToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`
    const signature = crypto.createHash('sha1').update(stringToSign).digest('hex')

    return NextResponse.json({
      signature,
      timestamp,
      folder,
      api_key: apiKey,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Signature generation failed' }, { status: 500 })
  }
}
