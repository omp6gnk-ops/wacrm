import { NextResponse } from 'next/server'
import { getCurrentAccount, requireRole, toErrorResponse } from '@/lib/auth/account'

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * GET /api/ai/products
 *
 * List all products in the account catalog.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount()

    const { data, error } = await supabase
      .from('ai_products')
      .select('id, name, price, file_url, created_at')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[ai/products GET] fetch error:', error)
      return NextResponse.json({ error: 'Failed to load products' }, { status: 500 })
    }

    return NextResponse.json({ products: data || [] })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * POST /api/ai/products
 *
 * Add a new product to the catalog (admin+).
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin')

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return bad('Invalid request body')

    if (Array.isArray(body)) {
      const productsToInsert = []
      for (const item of body) {
        if (!item || typeof item !== 'object') continue
        const name = typeof item.name === 'string' ? item.name.trim() : ''
        const price = Number(item.price)
        const fileUrl = typeof item.file_url === 'string' ? item.file_url.trim() : ''
        
        if (!name || isNaN(price) || price < 0 || !fileUrl) {
          return bad(`Invalid product data in bulk list`)
        }
        
        productsToInsert.push({
          account_id: accountId,
          name,
          price,
          file_url: fileUrl
        })
      }
      
      if (productsToInsert.length === 0) {
        return bad('No products to insert')
      }
      
      const { data, error } = await supabase
        .from('ai_products')
        .insert(productsToInsert)
        .select()
        
      if (error) {
        console.error('[ai/products POST bulk] insert error:', error)
        return NextResponse.json({ error: 'Failed to add products in bulk' }, { status: 500 })
      }
      
      return NextResponse.json({ success: true, products: data })
    }

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return bad('Product name is required')

    const price = Number(body.price)
    if (isNaN(price) || price < 0) return bad('Invalid product price')

    const fileUrl = typeof body.file_url === 'string' ? body.file_url.trim() : ''
    if (!fileUrl) return bad('Product file URL is required')

    const { data, error } = await supabase
      .from('ai_products')
      .insert({
        account_id: accountId,
        name,
        price,
        file_url: fileUrl,
      })
      .select()
      .single()

    if (error) {
      console.error('[ai/products POST] insert error:', error)
      return NextResponse.json({ error: 'Failed to add product' }, { status: 500 })
    }

    return NextResponse.json({ success: true, product: data })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * DELETE /api/ai/products
 *
 * Delete a product from the catalog (admin+).
 */
export async function DELETE(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin')

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return bad('Product id is required')

    const ids = id.split(',')
    const { error } = await supabase
      .from('ai_products')
      .delete()
      .eq('account_id', accountId)
      .in('id', ids)

    if (error) {
      console.error('[ai/products DELETE] delete error:', error)
      return NextResponse.json({ error: 'Failed to delete product(s)' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * PATCH /api/ai/products
 *
 * Bulk update products (admin+).
 */
export async function PATCH(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin')

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return bad('Invalid request body')

    const { ids, price, nameAction, prefix, suffix } = body
    if (!Array.isArray(ids) || ids.length === 0) return bad('Product ids array is required')

    let updateData: Record<string, any> = {}

    if (typeof price === 'number') {
      if (price < 0) return bad('Price cannot be negative')
      updateData.price = price
    }

    if (nameAction === 'prefix' || nameAction === 'suffix') {
      const { data: existingProducts, error: fetchError } = await supabase
        .from('ai_products')
        .select('id, name')
        .eq('account_id', accountId)
        .in('id', ids)
      
      if (fetchError) {
        console.error('[ai/products PATCH] fetch error:', fetchError)
        return NextResponse.json({ error: 'Failed to fetch existing products' }, { status: 500 })
      }

      const updatePromises = (existingProducts || []).map((p) => {
        const newName = nameAction === 'prefix' 
          ? `${prefix ?? ''}${p.name}` 
          : `${p.name}${suffix ?? ''}`
        
        return supabase
          .from('ai_products')
          .update({ ...updateData, name: newName })
          .eq('account_id', accountId)
          .eq('id', p.id)
      })

      const results = await Promise.all(updatePromises)
      const failed = results.find(r => r.error)
      if (failed) {
        console.error('[ai/products PATCH bulk rename] update error:', failed.error)
        return NextResponse.json({ error: 'Failed to update some products' }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    if (Object.keys(updateData).length > 0) {
      const { error } = await supabase
        .from('ai_products')
        .update(updateData)
        .eq('account_id', accountId)
        .in('id', ids)

      if (error) {
        console.error('[ai/products PATCH bulk] update error:', error)
        return NextResponse.json({ error: 'Failed to update products' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}
