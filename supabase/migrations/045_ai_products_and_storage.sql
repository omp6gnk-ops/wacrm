-- Add storage provider columns to ai_configs
ALTER TABLE ai_configs
  ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 'supabase',
  ADD COLUMN IF NOT EXISTS cloudinary_cloud_name TEXT,
  ADD COLUMN IF NOT EXISTS cloudinary_api_key TEXT,
  ADD COLUMN IF NOT EXISTS cloudinary_api_secret TEXT;

-- Create ai_products table for catalog management
CREATE TABLE IF NOT EXISTS ai_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE ai_products ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
DROP POLICY IF EXISTS ai_products_select ON ai_products;
CREATE POLICY ai_products_select ON ai_products FOR SELECT
  USING (account_id IN (SELECT account_id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS ai_products_insert ON ai_products;
CREATE POLICY ai_products_insert ON ai_products FOR INSERT
  WITH CHECK (account_id IN (SELECT account_id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS ai_products_update ON ai_products;
CREATE POLICY ai_products_update ON ai_products FOR UPDATE
  USING (account_id IN (SELECT account_id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS ai_products_delete ON ai_products;
CREATE POLICY ai_products_delete ON ai_products FOR DELETE
  USING (account_id IN (SELECT account_id FROM profiles WHERE user_id = auth.uid()));

-- Create Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_ai_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_products_updated_at ON ai_products;
CREATE TRIGGER ai_products_updated_at
  BEFORE UPDATE ON ai_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ai_products_updated_at();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_products_account ON ai_products(account_id);

-- Initialize Supabase Storage Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-delivery-files', 'product-delivery-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
CREATE POLICY "Allow public read access" ON storage.objects FOR SELECT
  USING (bucket_id = 'product-delivery-files');

DROP POLICY IF EXISTS "Allow authenticated users to upload" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-delivery-files');

DROP POLICY IF EXISTS "Allow authenticated users to delete" ON storage.objects;
CREATE POLICY "Allow authenticated users to delete" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-delivery-files');
